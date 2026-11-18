import * as THREE from 'three';
import { globalUniforms } from './Materials';

/**
 * "Réaliste" material path. Every toon material in the scene is swapped (once, cached)
 * for a physically based MeshStandardMaterial that keeps the original colours, maps and
 * shader patches (wind, see-through, snow) and adds procedural micro-detail computed in
 * world space: bump-mapped surface normals, albedo grime/variation, roughness breakup,
 * wet darkening in the rain and a soft translucency term for foliage.
 */

const converted = new WeakMap<THREE.Material, THREE.Material>();

const REAL_COMMON = /* glsl */ `
  varying vec3 vRealW;
  float rHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float rNoise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(rHash(i), rHash(i + vec3(1,0,0)), f.x), mix(rHash(i + vec3(0,1,0)), rHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(rHash(i + vec3(0,0,1)), rHash(i + vec3(1,0,1)), f.x), mix(rHash(i + vec3(0,1,1)), rHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float rFbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * rNoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

function realPatch(mat: THREE.MeshStandardMaterial, src: THREE.Material, kind: { foliage: boolean; terrain: boolean; skin: boolean }): void {
  const prev = src.onBeforeCompile;
  const prevKey = src.customProgramCacheKey?.bind(src);
  const bump = kind.terrain ? 0.55 : kind.foliage ? 0.35 : kind.skin ? 0.06 : 0.28;
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.uWet = globalUniforms.uWet;
    shader.uniforms.uSunDirW = globalUniforms.uSunDir;
    shader.uniforms.uTimeR = globalUniforms.uTime;
    shader.uniforms.uDay = globalUniforms.uDay;
    shader.uniforms.uCloudShadow = globalUniforms.uCloudShadow;
    let vs = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vRealW;`);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 rw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          rw = instanceMatrix * rw;
        #endif
        vRealW = (modelMatrix * rw).xyz; }`);
    shader.vertexShader = vs;
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>
      ${REAL_COMMON}
      uniform float uWet; uniform vec3 uSunDirW; uniform float uTimeR; uniform float uDay; uniform float uCloudShadow;`);
    // albedo variation & grime in crevices (low areas get darker / dirtier)
    fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float g = rFbm(vRealW * ${kind.terrain ? '0.9' : '2.2'});
        float fine = rNoise(vRealW * 11.0);
        diffuseColor.rgb *= mix(0.78, 1.12, g) * mix(0.93, 1.04, fine);
        ${kind.terrain ? 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.82, 0.78, 0.7), smoothstep(0.55, 0.8, rFbm(vRealW * 0.35 + 3.0)) * 0.6);' : ''}
        // gentle de-pastelisation towards natural albedo
        float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(vec3(l), diffuseColor.rgb, 0.88) * 0.86;
        diffuseColor.rgb *= mix(1.0, 0.62, uWet * ${kind.skin ? '0.0' : '1.0'});
        ${kind.terrain || kind.foliage ? `
        // natural vegetation: pull neon greens toward olive, sprinkle sun-dried straw patches
        {
          vec3 c = diffuseColor.rgb;
          float green = smoothstep(0.015, 0.12, c.g - max(c.r, c.b));
          float lg = dot(c, vec3(0.2126, 0.7152, 0.0722));
          vec3 olive = mix(vec3(lg), c, 0.75) * vec3(0.92, 0.84, 0.55) * mix(0.85, 1.05, rNoise(vRealW * 0.7));
          c = mix(c, olive, green * 0.7);
          float dry = smoothstep(0.5, 0.72, rFbm(vRealW * 0.18 + 11.0)) * green;
          c = mix(c, c * vec3(1.45, 1.05, 0.55), dry * 0.35);
          float lush = smoothstep(0.55, 0.75, rFbm(vRealW * 0.25 - 4.0)) * green;
          c = mix(c, c * vec3(0.75, 0.9, 0.7), lush * 0.5);
          diffuseColor.rgb = c;
        }` : ''}
      }`);
    fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor * mix(0.75, 1.15, rNoise(vRealW * 5.0)) - uWet * ${kind.skin ? '0.0' : '0.45'}, 0.05, 1.0);`);
    // procedural bump: perturb the view-space normal by the world-space noise gradient
    fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        float f = ${kind.terrain ? '3.2' : kind.foliage ? '6.0' : '4.5'};
        float e = 0.04;
        float n0 = rFbm(vRealW * f);
        vec3 grad = vec3(rFbm((vRealW + vec3(e,0,0)) * f) - n0, rFbm((vRealW + vec3(0,e,0)) * f) - n0, rFbm((vRealW + vec3(0,0,e)) * f) - n0) / e;
        vec3 gv = (viewMatrix * vec4(grad, 0.0)).xyz;
        normal = normalize(normal - (gv - dot(gv, normal) * normal) * ${bump.toFixed(3)} * 0.12);
      }`);
    // moving cloud shadows sweeping over the land in daylight
    fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      if (uCloudShadow > 0.001) {
        vec2 cp = vRealW.xz * 0.035 + vec2(uTimeR * 0.012, uTimeR * 0.007);
        float cn = rFbm(vec3(cp, 0.5)) + 0.25 * rNoise(vec3(cp * 4.0, 1.5));
        float cs = smoothstep(0.5, 0.68, cn) * uCloudShadow;
        reflectedLight.directDiffuse *= 1.0 - cs * 0.6;
        reflectedLight.directSpecular *= 1.0 - cs * 0.8;
      }
      ${kind.terrain || kind.foliage ? `
      // sky-light sheen on vegetation at grazing angles (dew / waxy blades)
      {
        vec3 vDirS = normalize(cameraPosition - vRealW);
        float graze = pow(1.0 - clamp(dot(vDirS, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 4.0);
        reflectedLight.indirectSpecular += vec3(0.6, 0.75, 0.9) * graze * 0.015 * uDay;
      }` : ''}`);
    if (kind.foliage) {
      // light bleeding through leaves when backlit by the sun
      fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          vec3 vDirW = normalize(cameraPosition - vRealW);
          float back = pow(clamp(dot(-vDirW, normalize(uSunDirW)), 0.0, 1.0), 3.0);
          reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(1.0, 0.95, 0.6) * back * 0.9;
        }`);
    }
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}_real_${kind.foliage}_${kind.terrain}_${kind.skin}`;
}

export function toRealistic(src: THREE.Material): THREE.Material {
  if (!(src as THREE.MeshToonMaterial).isMeshToonMaterial) return src;
  const hit = converted.get(src);
  if (hit) return hit;
  const t = src as THREE.MeshToonMaterial;
  const key = t.customProgramCacheKey ? t.customProgramCacheKey() : '';
  const foliage = key.startsWith('mm_') && !key.startsWith('mm_0_'); // has wind sway
  const terrain = !!t.map && t.vertexColors;
  const lum = t.color.r * 0.3 + t.color.g * 0.59 + t.color.b * 0.11;
  const skin = !t.vertexColors && !t.map && lum > 0.55 && t.color.r > t.color.b;
  const m = new THREE.MeshStandardMaterial({
    color: t.color,
    vertexColors: t.vertexColors,
    map: t.map,
    transparent: t.transparent,
    opacity: t.opacity,
    side: t.side,
    alphaTest: t.alphaTest,
    depthWrite: t.depthWrite,
    emissive: t.emissive,
    emissiveIntensity: t.emissiveIntensity * 2.5, // HDR glow feeds the bloom
    roughness: terrain ? 0.92 : foliage ? 0.7 : skin ? 0.55 : 0.78,
    metalness: 0,
    envMapIntensity: 1,
  });
  m.name = t.name;
  realPatch(m, t, { foliage, terrain, skin });
  converted.set(src, m);
  return m;
}

/** Swap every toon material under `root` for its PBR twin (cheap after the first pass). */
export function realifyScene(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material;
    if (Array.isArray(m)) {
      for (let i = 0; i < m.length; i++) m[i] = toRealistic(m[i]);
    } else if (m && (m as THREE.MeshToonMaterial).isMeshToonMaterial) {
      mesh.material = toRealistic(m);
    }
  });
}

/**
 * Image based lighting: the sky dome is re-captured into a PMREM cube every so often so
 * PBR surfaces pick up the real sky colour (sunsets tint everything, nights go blue).
 */
export class SkyEnvironment {
  private pmrem: THREE.PMREMGenerator;
  private envScene = new THREE.Scene();
  private rt: THREE.WebGLRenderTarget | null = null;
  private timer = 0;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  update(dt: number, scene: THREE.Scene, dome: THREE.Mesh | null, force = false): void {
    this.timer -= dt;
    if (!dome || (!force && this.timer > 0)) return;
    this.timer = 1.0;
    const copy = new THREE.Mesh(dome.geometry, dome.material);
    copy.scale.setScalar(0.1);
    this.envScene.add(copy);
    const next = this.pmrem.fromScene(this.envScene, 0, 0.1, 100, { size: 128 });
    this.envScene.remove(copy);
    this.rt?.dispose();
    this.rt = next;
    scene.environment = next.texture;
    scene.environmentIntensity = 0.5 + 0.15 * globalUniforms.uDay.value;
  }

  dispose(scene: THREE.Scene): void {
    this.rt?.dispose();
    this.rt = null;
    scene.environment = null;
  }
}
