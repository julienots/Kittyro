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
}

function patch(mat: THREE.Material, o: MatOptions): void {
  const wind = o.wind ?? 0;
  const see = !!o.seeThrough;
  const snow = !!o.snowCap;
  if (!wind && !see && !snow) return;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: globalUniforms.uTime,
      uWind: globalUniforms.uWind,
      uPlayerScreen: globalUniforms.uPlayerScreen,
      uPlayerDepth: globalUniforms.uPlayerDepth,
      uSeeThrough: globalUniforms.uSeeThrough,
      uAspect: globalUniforms.uAspect,
      uSnow: globalUniforms.uSnow,
    });
    let vs = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform float uTime; uniform float uWind;
      varying vec3 vWorldNormalMM; varying vec4 vClipMM;`);
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
      vWorldNormalMM = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.vertexShader = vs;

    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec2 uPlayerScreen; uniform float uPlayerDepth; uniform float uSeeThrough; uniform float uAspect; uniform float uSnow;
      varying vec3 vWorldNormalMM; varying vec4 vClipMM;
      float bayer4(vec2 p){ int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0)); int i = x + y * 4;
        float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return m[i] / 16.; }`);
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
  mat.customProgramCacheKey = () => `mm_${wind}_${see}_${snow}`;
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
  cache.set(key, m);
  return m;
}
