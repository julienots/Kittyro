import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { globalUniforms } from './Materials';

/**
 * Cinematic HDR post-processing chain for the "Réaliste" quality tier.
 *
 *  scene ─▶ HDR (MSAA + depth) ─┬─▶ SSAO (½ res, depth-reconstructed normals)
 *                               ├─▶ volumetric sun shafts (½ res, radial march)
 *                               └─▶ composite (bilateral AO, shafts, aerial haze)
 *                                     ─▶ bloom (mip chain) ─▶ final: depth of field,
 *                                        chromatic aberration, ACES filmic, grading,
 *                                        vignette, grain, dithering ─▶ screen
 */

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const DEPTH_COMMON = /* glsl */ `
  uniform sampler2D tDepth; uniform mat4 uProjInv; uniform float uNear, uFar;
  vec3 viewPos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vec4 v = uProjInv * c; return v.xyz / v.w; }
  float linDepth(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
  float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

const AO_FRAG = /* glsl */ `
  ${DEPTH_COMMON}
  uniform vec2 uRes; uniform float uRadius, uIntensity; uniform mat4 uProj;
  varying vec2 vUv;
  void main(){
    float d = texture2D(tDepth, vUv).x;
    if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
    vec3 p = viewPos(vUv);
    vec2 px = 1.0 / uRes;
    vec3 pr = viewPos(vUv + vec2(px.x, 0.0)), pl = viewPos(vUv - vec2(px.x, 0.0));
    vec3 pu = viewPos(vUv + vec2(0.0, px.y)), pd = viewPos(vUv - vec2(0.0, px.y));
    vec3 dx = abs(pr.z - p.z) < abs(p.z - pl.z) ? pr - p : p - pl;
    vec3 dy = abs(pu.z - p.z) < abs(p.z - pd.z) ? pu - p : p - pd;
    vec3 n = normalize(cross(dx, dy));
    float rs = uRadius * uProj[1][1] / max(0.1, -p.z) * 0.5;
    float rot = ign(gl_FragCoord.xy) * 6.2831853;
    float ao = 0.0;
    const int N = 16;
    for (int i = 0; i < N; i++){
      float fi = float(i) + 0.5;
      float a = fi * 2.39996323 + rot;
      float r = sqrt(fi / float(N)) * rs;
      vec2 suv = vUv + vec2(cos(a), sin(a)) * r;
      vec3 q = viewPos(suv);
      vec3 v = q - p;
      float l2 = dot(v, v);
      float fall = 1.0 - smoothstep(0.0, uRadius * uRadius, l2);
      ao += max(0.0, dot(n, v) * inversesqrt(l2 + 1e-4) - 0.08) * fall;
    }
    ao = clamp(1.0 - ao / float(N) * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(ao, ao, ao, 1.0);
  }`;

const RAYS_FRAG = /* glsl */ `
  uniform sampler2D tDepth; uniform sampler2D tColor; uniform vec2 uSun; uniform float uAspect;
  varying vec2 vUv;
  float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  void main(){
    const int N = 40;
    vec2 delta = (uSun - vUv) / float(N) * 0.92;
    vec2 uv = vUv + delta * ign(gl_FragCoord.xy);
    float illum = 1.0, acc = 0.0;
    for (int i = 0; i < N; i++){
      uv += delta;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { illum *= 0.96; continue; }
      float sky = step(0.99999, texture2D(tDepth, uv).x);
      vec3 c = texture2D(tColor, uv).rgb;
      float b = max(0.0, dot(c, vec3(0.3, 0.59, 0.11)) - 0.55);
      vec2 dd = (uv - uSun) * vec2(uAspect, 1.0);
      float glow = exp(-dot(dd, dd) * 3.0);
      acc += sky * (b * 0.6 + glow * 0.35) * illum;
      illum *= 0.965;
    }
    gl_FragColor = vec4(vec3(acc / float(N)), 1.0);
  }`;

const COMPOSITE_FRAG = /* glsl */ `
  ${DEPTH_COMMON}
  uniform sampler2D tColor; uniform sampler2D tAO; uniform sampler2D tRays;
  uniform vec2 uAoRes; uniform vec3 uSunColor; uniform float uRays; uniform float uAo; uniform vec3 uHaze; uniform float uHazeK;
  varying vec2 vUv;
  void main(){
    vec3 col = texture2D(tColor, vUv).rgb;
    float d = texture2D(tDepth, vUv).x;
    if (d < 0.99999) {
      // depth-aware 3x3 upsample/blur of the half-res AO
      float z0 = linDepth(vUv), ao = 0.0, w = 0.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
        vec2 o = vec2(float(x), float(y)) / uAoRes;
        float zs = linDepth(vUv + o);
        float ww = 1.0 / (1e-3 + abs(zs - z0) * 4.0);
        ao += texture2D(tAO, vUv + o).r * ww; w += ww;
      }
      ao /= w;
      col *= mix(1.0, ao, uAo);
      // aerial perspective: distant geometry picks up a cool atmospheric haze
      float z = linDepth(vUv);
      float h = 1.0 - exp(-max(0.0, z - 18.0) * uHazeK);
      col = mix(col, uHaze, h * 0.55);
    }
    vec3 rays = texture2D(tRays, vUv).rgb;
    col += rays * uSunColor * uRays;
    gl_FragColor = vec4(col, 1.0);
  }`;

const FINAL_FRAG = /* glsl */ `
  ${DEPTH_COMMON}
  uniform sampler2D tColor; uniform vec2 uRes; uniform float uFocus, uDof, uTime, uExposure, uNight;
  varying vec2 vUv;
  vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
  vec3 aces(vec3 c){
    const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    return clamp(O * RRTAndODTFit(I * c), 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  float coc(vec2 uv){
    float z = linDepth(uv);
    if (texture2D(tDepth, uv).x >= 0.99999) z = uFar;
    return clamp(abs(z - uFocus) / max(uFocus, 1.0) * 1.6 - 0.12, 0.0, 1.0) * uDof;
  }
  void main(){
    vec2 px = 1.0 / uRes;
    vec2 q = vUv - 0.5;
    // depth of field (golden-angle bokeh) with scatter-as-gather weighting
    float c0 = coc(vUv);
    float maxR = 9.0;
    vec3 acc = vec3(0.0); float wsum = 0.0;
    float ca = 0.0018 * dot(q, q) * 4.0;
    vec3 base = vec3(texture2D(tColor, vUv + q * ca).r, texture2D(tColor, vUv).g, texture2D(tColor, vUv - q * ca).b);
    acc += base; wsum += 1.0;
    if (c0 > 0.02) {
      const int N = 28;
      for (int i = 0; i < N; i++){
        float fi = float(i) + 0.5;
        float a = fi * 2.39996323;
        float r = sqrt(fi / float(N)) * c0 * maxR;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r * px;
        float cs = coc(uv);
        float w = smoothstep(0.0, 1.0, cs * maxR - r + 1.0);
        vec3 s = texture2D(tColor, uv).rgb;
        float bright = 1.0 + max(0.0, dot(s, vec3(0.33)) - 1.0) * 1.5; // bokeh highlights pop
        acc += s * w * bright; wsum += w * bright;
      }
    }
    vec3 col = acc / wsum;
    // exposure + filmic tone curve
    col *= uExposure;
    col = aces(col);
    // grading: cool shadows, warm highlights, a touch of extra contrast and vibrance
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 shadowT = mix(vec3(0.94, 1.0, 1.08), vec3(0.85, 0.95, 1.2), uNight);
    vec3 highT = vec3(1.06, 1.01, 0.93);
    col *= mix(shadowT, highT, smoothstep(0.1, 0.8, l));
    col = mix(vec3(l), col, 1.0);
    col = clamp((col - 0.5) * 1.06 + 0.5, 0.0, 1.0);
    // lens vignette
    col *= 1.0 - smoothstep(0.35, 0.95, length(q * vec2(uRes.x / uRes.y, 1.0)) * 0.9) * 0.45;
    // film grain (luma weighted) and dithering against banding
    float g = fract(sin(dot(vUv * uRes + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    col += g * 0.022 * (0.35 + l * 0.65);
    col = toSRGB(clamp(col, 0.0, 1.0));
    col += (ign(gl_FragCoord.xy + uTime * 60.0) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }`;

function rt(w: number, h: number, opts: THREE.RenderTargetOptions = {}): THREE.WebGLRenderTarget {
  const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, ...opts });
  t.texture.colorSpace = THREE.LinearSRGBColorSpace;
  return t;
}

export class Cinematic {
  readonly sceneRT: THREE.WebGLRenderTarget;
  private aoRT: THREE.WebGLRenderTarget;
  private raysRT: THREE.WebGLRenderTarget;
  private compRT: THREE.WebGLRenderTarget;
  private bloom: UnrealBloomPass;
  private quad: THREE.Mesh;
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private aoMat: THREE.ShaderMaterial;
  private raysMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private finalMat: THREE.ShaderMaterial;
  private w = 1;
  private h = 1;
  private tmp = new THREE.Vector3();
  /** Weather/time driven knobs set by the game each frame. */
  haze = new THREE.Color(0xc8d8e8);
  night = 0;
  overcast = 0;
  exposure = 0.78;
  dof = 1;

  constructor(w: number, h: number, samples: number) {
    const depth = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthTexture: depth, depthBuffer: true });
    this.sceneRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.aoRT = rt(w >> 1, h >> 1);
    this.raysRT = rt(w >> 1, h >> 1);
    this.compRT = rt(w, h);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.6, 1.35);
    const dU = () => ({ tDepth: { value: depth }, uProjInv: { value: new THREE.Matrix4() }, uNear: { value: 0.5 }, uFar: { value: 600 } });
    this.aoMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: AO_FRAG,
      uniforms: { ...dU(), uRes: { value: new THREE.Vector2(w >> 1, h >> 1) }, uRadius: { value: 1.1 }, uIntensity: { value: 2.2 }, uProj: { value: new THREE.Matrix4() } },
    });
    this.raysMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: RAYS_FRAG,
      uniforms: { tDepth: { value: depth }, tColor: { value: this.sceneRT.texture }, uSun: { value: new THREE.Vector2(0.5, 1.2) }, uAspect: { value: w / h } },
    });
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        ...dU(), tColor: { value: this.sceneRT.texture }, tAO: { value: this.aoRT.texture }, tRays: { value: this.raysRT.texture },
        uAoRes: { value: new THREE.Vector2(w >> 1, h >> 1) }, uSunColor: { value: new THREE.Color(1, 0.95, 0.85) }, uRays: { value: 1 }, uAo: { value: 0.85 },
        uHaze: { value: new THREE.Color() }, uHazeK: { value: 0.012 },
      },
    });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FINAL_FRAG,
      uniforms: { ...dU(), tColor: { value: this.compRT.texture }, uRes: { value: new THREE.Vector2(w, h) }, uFocus: { value: 20 }, uDof: { value: 1 }, uTime: { value: 0 }, uExposure: { value: 1 }, uNight: { value: 0 } },
    });
    for (const m of [this.aoMat, this.raysMat, this.compMat, this.finalMat]) { m.depthTest = false; m.depthWrite = false; }
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.finalMat);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
    this.setSize(w, h);
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.sceneRT.setSize(w, h);
    this.aoRT.setSize(w >> 1, h >> 1);
    this.raysRT.setSize(w >> 1, h >> 1);
    this.compRT.setSize(w, h);
    this.bloom.setSize(w, h);
    (this.aoMat.uniforms.uRes.value as THREE.Vector2).set(w >> 1, h >> 1);
    (this.compMat.uniforms.uAoRes.value as THREE.Vector2).set(w >> 1, h >> 1);
    (this.finalMat.uniforms.uRes.value as THREE.Vector2).set(w, h);
    this.raysMat.uniforms.uAspect.value = w / h;
  }

  private pass(r: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = mat;
    r.setRenderTarget(target);
    r.render(this.qScene, this.qCam);
  }

  render(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    // 1. HDR scene
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);
    // shared camera uniforms
    for (const m of [this.aoMat, this.compMat, this.finalMat]) {
      (m.uniforms.uProjInv.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
      m.uniforms.uNear.value = camera.near;
      m.uniforms.uFar.value = camera.far;
    }
    (this.aoMat.uniforms.uProj.value as THREE.Matrix4).copy(camera.projectionMatrix);
    // 2. ambient occlusion
    this.pass(r, this.aoMat, this.aoRT);
    // 3. sun shafts: project the sun into screen space
    const sd = globalUniforms.uSunDir.value;
    this.tmp.copy(camera.position).addScaledVector(sd, 300).project(camera);
    const facing = this.tmp.z < 1 ? 1 : 0;
    (this.raysMat.uniforms.uSun.value as THREE.Vector2).set(this.tmp.x * 0.5 + 0.5, this.tmp.y * 0.5 + 0.5);
    this.pass(r, this.raysMat, this.raysRT);
    // 4. composite
    const cu = this.compMat.uniforms;
    (cu.uSunColor.value as THREE.Color).copy(globalUniforms.uSunColor.value);
    cu.uRays.value = facing * (1 - this.overcast * 0.85) * (0.35 + (1 - this.night) * 1.4);
    (cu.uHaze.value as THREE.Color).copy(this.haze);
    cu.uHazeK.value = 0.01 + this.overcast * 0.02;
    this.pass(r, this.compMat, this.compRT);
    // 5. bloom (composited back into compRT)
    this.bloom.strength = 0.28 + this.night * 0.45;
    this.bloom.render(r, null as any, this.compRT, 0, false);
    // 6. final grade to screen
    const fu = this.finalMat.uniforms;
    fu.uFocus.value = globalUniforms.uPlayerDepth.value;
    fu.uDof.value = this.dof;
    fu.uTime.value = globalUniforms.uTime.value;
    fu.uExposure.value = this.exposure;
    fu.uNight.value = this.night;
    this.pass(r, this.finalMat, null);
  }

  dispose(): void {
    this.sceneRT.depthTexture?.dispose();
    for (const t of [this.sceneRT, this.aoRT, this.raysRT, this.compRT]) t.dispose();
    this.bloom.dispose();
    for (const m of [this.aoMat, this.raysMat, this.compMat, this.finalMat]) m.dispose();
  }

  get size(): [number, number] {
    return [this.w, this.h];
  }
}
