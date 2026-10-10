import * as THREE from 'three';

/**
 * Shared materials for the Mossy Meadows look: soft 3-band toon shading on vertex
 * colours, a painterly noise texture, wind sway for foliage and a "see-through"
 * dither that hides geometry standing between the camera and the player.
 */

export const globalUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uPlayerScreen: { value: new THREE.Vector2(0.5, 0.5) },
  uPlayerDepth: { value: 20 },
  uSeeThrough: { value: 1 },
  uAspect: { value: 1 },
  uWet: { value: 0 },
  uSnow: { value: 0 },
  /** strength of drifting cloud shadows on the ground (0 indoors / at night) */
  uCloud: { value: 0 },
};

let gradientMap: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  // 4 soft bands: shadow, mid, light, highlight
  const data = new Uint8Array([110, 110, 110, 255, 170, 170, 170, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

let paintTex: THREE.CanvasTexture | null = null;
/** Soft painterly blotches used to break up flat colours on terrain. */
export function paintTexture(): THREE.CanvasTexture {
  if (paintTex) return paintTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 2 + rnd() * 9;
    const v = 225 + Math.floor(rnd() * 30);
    g.fillStyle = `rgba(${v},${v},${v - 6},${0.25 + rnd() * 0.35})`;
    g.beginPath();
    g.ellipse(x, y, r * 1.6, r, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
    // wrap
    for (const [dx, dy] of [[256, 0], [-256, 0], [0, 256], [0, -256]]) {
      g.beginPath();
      g.ellipse(x + dx, y + dy, r * 1.6, r, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // tiny strokes
  for (let i = 0; i < 500; i++) {
    const x = rnd() * 256, y = rnd() * 256;
    g.strokeStyle = `rgba(255,255,240,${0.2 + rnd() * 0.3})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rnd() * 4 - 2, y - 3 - rnd() * 3);
    g.stroke();
  }
  paintTex = new THREE.CanvasTexture(c);
  paintTex.wrapS = paintTex.wrapT = THREE.RepeatWrapping;
  paintTex.colorSpace = THREE.SRGBColorSpace;
  return paintTex;
}

export interface MatOptions {
  wind?: number; // sway amount (0 none)
  seeThrough?: boolean;
  transparent?: boolean;
  opacity?: number;
  emissive?: number;
  emissiveIntensity?: number;
  side?: THREE.Side;
  worldUvPaint?: boolean;
  snowCap?: boolean; // whitens up-facing surfaces when it snows
  textured?: boolean; // procedural surface patterns from the `aPat` attribute (planks, bricks, shingles...)
  clouds?: boolean; // drifting cloud shadows (default on)
}

const CLOUD_GLSL = `
float cHashMM(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
float cNoiseMM(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(cHashMM(i), cHashMM(i+vec2(1,0)), f.x), mix(cHashMM(i+vec2(0,1)), cHashMM(i+vec2(1,1)), f.x), f.y); }
float cloudShadeMM(vec3 wp){
  vec2 p = wp.xz * 0.045 + vec2(uTime * 0.018, uTime * 0.009);
  float n = cNoiseMM(p) * 0.6 + cNoiseMM(p * 2.3 + 7.1) * 0.3 + cNoiseMM(p * 5.1 + 3.3) * 0.1;
  return 1.0 - smoothstep(0.52, 0.72, n) * 0.26 * uCloud;
}`;

/** GLSL for the procedural building surfaces. Returns a brightness multiplier. */
const TEX_GLSL = `
float hashMM(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noiseMM(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hashMM(i), hashMM(i+vec2(1,0)), f.x), mix(hashMM(i+vec2(0,1)), hashMM(i+vec2(1,1)), f.x), f.y); }
vec3 cellMM(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0);
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){ vec2 g = vec2(x,y); vec2 o = vec2(hashMM(i+g), hashMM(i+g+17.3))*0.8+0.1;
    float d = length(g+o-f); if (d<d1){ d2=d1; d1=d; id=i+g; } else if (d<d2) d2=d; }
  return vec3(d2-d1, hashMM(id), 0.0); }
float texMM(float id, vec3 p, vec3 n){
  if (id < 0.5) return 1.0;
  vec2 uv = abs(n.y) > 0.72 ? p.xz : (abs(n.x) > abs(n.z) ? vec2(p.z, p.y) : vec2(p.x, p.y));
  float k = 1.0;
  if (id < 1.5) { // planks
    float row = floor(uv.y / 0.17); float r = fract(uv.y / 0.17);
    float rh = hashMM(vec2(row, 3.1));
    float joint = fract((uv.x + rh * 1.7) / 1.35);
    k = mix(0.72, 1.0, smoothstep(0.0, 0.1, r) * smoothstep(1.0, 0.9, r)) * mix(0.75, 1.0, smoothstep(0.0, 0.015, joint) * smoothstep(1.0, 0.985, joint));
    k *= 0.93 + rh * 0.12 + sin(uv.x * 34.0 + rh * 20.0 + sin(uv.y * 60.0) * 0.8) * 0.025;
  } else if (id < 2.5) { // bricks
    float row = floor(uv.y / 0.14);
    float x = uv.x / 0.3 + mod(row, 2.0) * 0.5;
    vec2 f = vec2(fract(x), fract(uv.y / 0.14));
    float m = smoothstep(0.0, 0.06, f.x) * smoothstep(1.0, 0.94, f.x) * smoothstep(0.0, 0.1, f.y) * smoothstep(1.0, 0.9, f.y);
    float b = hashMM(vec2(floor(x), row));
    k = mix(1.12, 0.88 + b * 0.2, m);
  } else if (id < 3.5) { // stone masonry
    vec3 c = cellMM(uv * vec2(3.0, 4.2));
    k = mix(0.68, 0.9 + c.y * 0.22, smoothstep(0.02, 0.12, c.x)) * (0.96 + noiseMM(uv * 14.0) * 0.08);
  } else if (id < 4.5) { // roof shingles
    float row = floor(uv.y / 0.11); float fy = fract(uv.y / 0.11);
    float x = uv.x / 0.2 + mod(row, 2.0) * 0.5;
    float fx = fract(x);
    float edge = 1.0 - abs(fx - 0.5) * 2.0;
    float lip = smoothstep(0.0, 0.22 + (1.0 - edge) * 0.25, fy);
    float sh = hashMM(vec2(floor(x), row));
    k = mix(0.72, 1.0, lip) * (0.9 + sh * 0.18) * mix(0.8, 1.0, smoothstep(0.0, 0.05, fx) * smoothstep(1.0, 0.95, fx));
  } else if (id < 5.5) { // thatch
    float s = noiseMM(vec2(uv.x * 38.0, uv.y * 3.0)) * 0.6 + noiseMM(vec2(uv.x * 90.0, uv.y * 8.0)) * 0.4;
    float band = fract(uv.y / 0.22);
    k = (0.8 + s * 0.3) * mix(0.82, 1.0, smoothstep(0.0, 0.3, band));
  } else if (id < 6.5) { // plaster
    k = 0.95 + noiseMM(uv * 3.5) * 0.06 + noiseMM(uv * 17.0) * 0.03;
  } else if (id < 7.5) { // cobbles
    vec3 c = cellMM(uv * 5.5);
    k = mix(0.7, 0.9 + c.y * 0.2, smoothstep(0.03, 0.14, c.x));
  } else { // stacked logs
    float r = fract(uv.y / 0.2);
    k = 0.78 + sin(r * 3.14159) * 0.26 + noiseMM(vec2(uv.x * 20.0, uv.y * 4.0)) * 0.05;
  }
  return k;
}`;

function patch(mat: THREE.Material, o: MatOptions): void {
  const wind = o.wind ?? 0;
  const see = !!o.seeThrough;
  const snow = !!o.snowCap;
  const tex = !!o.textured;
  const clouds = o.clouds !== false;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: globalUniforms.uTime,
      uWind: globalUniforms.uWind,
      uPlayerScreen: globalUniforms.uPlayerScreen,
      uPlayerDepth: globalUniforms.uPlayerDepth,
      uSeeThrough: globalUniforms.uSeeThrough,
      uAspect: globalUniforms.uAspect,
      uSnow: globalUniforms.uSnow,
      uCloud: globalUniforms.uCloud,
    });
    let vs = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform float uTime; uniform float uWind;
      varying vec3 vWorldNormalMM; varying vec4 vClipMM;
      varying vec3 vWorldPosMM;
      ${tex ? 'attribute float aPat; varying float vPatMM; varying vec3 vObjPosMM; varying vec3 vObjNMM;' : ''}`);
    if (wind) {
      vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec4 wp0 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp0 = instanceMatrix * wp0;
        #endif
        wp0 = modelMatrix * wp0;
        float h = max(0.0, position.y);
        float sway = sin(uTime * 1.7 + wp0.x * 0.35 + wp0.z * 0.27) * 0.6 + sin(uTime * 3.1 + wp0.x * 0.9) * 0.25;
        transformed.x += sway * ${wind.toFixed(3)} * uWind * h * h;
        transformed.z += cos(uTime * 1.3 + wp0.z * 0.31) * ${(wind * 0.6).toFixed(3)} * uWind * h * h;
      }`);
    }
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      vClipMM = gl_Position;
      vWorldNormalMM = normalize(mat3(modelMatrix) * objectNormal);
      { vec4 wpMM = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpMM = instanceMatrix * wpMM;
        #endif
        vWorldPosMM = (modelMatrix * wpMM).xyz; }
      ${tex ? 'vPatMM = aPat; vObjPosMM = position; vObjNMM = normal;' : ''}`);
    shader.vertexShader = vs;

    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec2 uPlayerScreen; uniform float uPlayerDepth; uniform float uSeeThrough; uniform float uAspect; uniform float uSnow;
      uniform float uTime; uniform float uCloud;
      varying vec3 vWorldNormalMM; varying vec4 vClipMM; varying vec3 vWorldPosMM;
      ${CLOUD_GLSL}
      float bayer4(vec2 p){ int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0)); int i = x + y * 4;
        float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return m[i] / 16.; }
      ${tex ? `varying float vPatMM; varying vec3 vObjPosMM; varying vec3 vObjNMM; ${TEX_GLSL}` : ''}`);
    if (tex) {
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= texMM(floor(vPatMM + 0.5), vObjPosMM, normalize(vObjNMM));`);
    }
    if (clouds) {
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= cloudShadeMM(vWorldPosMM);`);
    }
    if (see) {
      fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (uSeeThrough > 0.5) {
        vec2 ndc = vClipMM.xy / vClipMM.w * 0.5 + 0.5;
        vec2 d = (ndc - uPlayerScreen) * vec2(uAspect, 1.0);
        float r = length(d);
        if (vClipMM.w < uPlayerDepth - 1.0 && r < 0.16) {
          float fade = smoothstep(0.16, 0.07, r);
          if (bayer4(gl_FragCoord.xy) < fade * 0.88) discard;
        }
      }`);
    }
    if (snow) {
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      { float up = clamp(vWorldNormalMM.y, 0.0, 1.0); float s = smoothstep(0.5, 0.85, up) * uSnow; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.98, 1.0), s); }`);
    }
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `mm_${wind}_${see}_${snow}_${tex}_${clouds}`;
}

const cache = new Map<string, THREE.Material>();

/** Toon material driven by vertex colours (most models). */
export function vcMat(o: MatOptions = {}): THREE.MeshToonMaterial {
  const key = `vc_${JSON.stringify(o)}`;
  let m = cache.get(key) as THREE.MeshToonMaterial | undefined;
  if (m) return m;
  m = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: toonGradient(),
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
  });
  if (o.emissive !== undefined) {
    m.emissive = new THREE.Color(o.emissive);
    m.emissiveIntensity = o.emissiveIntensity ?? 1;
  }
  patch(m, o);
  cache.set(key, m);
  return m;
}

/** Plain colour toon material (characters, animals: parts recoloured often). */
export function colorMat(color: number, o: MatOptions = {}): THREE.MeshToonMaterial {
  const key = `c_${color}_${JSON.stringify(o)}`;
  let m = cache.get(key) as THREE.MeshToonMaterial | undefined;
  if (m) return m;
  m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
  if (o.emissive !== undefined) {
    m.emissive = new THREE.Color(o.emissive);
    m.emissiveIntensity = o.emissiveIntensity ?? 1;
  }
  patch(m, o);
  cache.set(key, m);
  return m;
}

/** Unlit material for glows, eyes highlights, sprites. */
export function basicMat(color: number, o: { transparent?: boolean; opacity?: number; additive?: boolean; depthWrite?: boolean } = {}): THREE.MeshBasicMaterial {
  const key = `b_${color}_${JSON.stringify(o)}`;
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (m) return m;
  m = new THREE.MeshBasicMaterial({
    color,
    transparent: !!o.transparent || !!o.additive,
    opacity: o.opacity ?? 1,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: o.depthWrite ?? !o.additive,
  });
  cache.set(key, m);
  return m;
}

/** Inverted-hull outline material for characters (illustrated look). */
export const outlineMat = new THREE.MeshBasicMaterial({ color: 0x3a2a30, side: THREE.BackSide });

export function terrainMat(): THREE.MeshToonMaterial {
  const key = 'terrain';
  let m = cache.get(key) as THREE.MeshToonMaterial | undefined;
  if (m) return m;
  m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), map: paintTexture() });
  patch(m, {});
  cache.set(key, m);
  return m;
}
