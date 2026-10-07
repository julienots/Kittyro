import * as THREE from 'three';
import { T, type RegionLayout } from './Layout';
import type { Season } from '../state/types';
import { terrainMat, globalUniforms } from '../render/Materials';
import { Noise2D } from '../core/Random';

/**
 * Terrain = a floating diorama tile: soft vertex-coloured ground with painterly
 * texture, layered soil sides ("cake slice" edges), plus animated water/lava.
 */

const S = 2; // subdivisions per tile

export interface TerrainColors {
  grass: number;
  grass2: number;
}

export function seasonGrass(season: Season, regionId: string, theme?: [number, number]): TerrainColors {
  if (regionId === 'farm' && theme && season !== 'winter') return { grass: theme[0], grass2: theme[1] };
  switch (season) {
    case 'spring': return { grass: 0xa6d97e, grass2: 0x90cc6c };
    case 'summer': return { grass: 0x98cc6c, grass2: 0x84bf5e };
    case 'autumn': return { grass: 0xd8c47c, grass2: 0xc4ae68 };
    case 'winter': return { grass: 0xeef4fb, grass2: 0xdde8f4 };
  }
}

function tileColor(t: number, season: Season, gc: TerrainColors, seasonal: boolean, regionId: string): number {
  const winter = seasonal && season === 'winter';
  switch (t) {
    case T.GRASS: return gc.grass;
    case T.FOREST: return winter ? 0xe4ecf4 : season === 'autumn' ? 0xb0a058 : 0x7cb866;
    case T.PATH: return regionId === 'ember' ? 0x8a6a5e : regionId === 'frosty' ? 0xd8d0c8 : winter ? 0xe0d8d0 : 0xd8b88a;
    case T.DIRT: return 0xa8845a;
    case T.SAND: return winter && regionId !== 'coast' ? 0xf0ece0 : 0xf4e0a8;
    case T.WATER: return 0x7aa890;
    case T.DEEP: return 0x4a7a80;
    case T.ROCK: return regionId === 'ember' ? 0x4a3a3a : regionId === 'frosty' ? 0xb8c4d8 : regionId === 'mine' ? 0x5a4a48 : 0x9a96a0;
    case T.SNOW: return 0xf4f8ff;
    case T.LAVA: return 0x3a1a1a;
    case T.FLOOR: return regionId === 'mine' ? 0x8a7a70 : 0xc8925a;
    case T.BRIDGE: return 0x6a8a7a;
    case T.ASH: return 0x6a5450;
    case T.PLAZA: return 0xddd4c4;
    case T.ICE: return 0xd4ecf8;
    default: return 0x3a3030;
  }
}

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

export interface TerrainResult {
  ground: THREE.Mesh;
  skirt: THREE.Mesh;
  water: THREE.Mesh | null;
  lava: THREE.Mesh | null;
  heightAt: (x: number, z: number) => number;
}

export function buildTerrain(L: RegionLayout, season: Season, theme?: [number, number]): TerrainResult {
  const { w, d, tiles, heights } = L;
  const gc = seasonGrass(season, L.id, theme);
  const noise = new Noise2D(w * 131 + d);
  const VW = w * S + 1, VD = d * S + 1;

  const tileH = (x: number, z: number) => {
    x = Math.max(0, Math.min(w - 1, x));
    z = Math.max(0, Math.min(d - 1, z));
    return heights[z * w + x];
  };
  // height at continuous position (bilinear between tile centres)
  const sampleH = (px: number, pz: number) => {
    const fx = px - 0.5, fz = pz - 0.5;
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const tx = fx - x0, tz = fz - z0;
    const a = tileH(x0, z0), b = tileH(x0 + 1, z0), c = tileH(x0, z0 + 1), e = tileH(x0 + 1, z0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
  };

  const pos = new Float32Array(VW * VD * 3);
  const col = new Float32Array(VW * VD * 3);
  const uv = new Float32Array(VW * VD * 2);
  const vh = new Float32Array(VW * VD);
  for (let iz = 0; iz < VD; iz++) {
    for (let ix = 0; ix < VW; ix++) {
      const px = ix / S, pz = iz / S;
      const i = iz * VW + ix;
      let h = sampleH(px, pz);
      // tiny surface noise
      h += (noise.get(px * 1.7, pz * 1.7) - 0.5) * 0.05;
      vh[i] = h;
      pos[i * 3] = px;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = pz;
      uv[i * 2] = px * 0.18;
      uv[i * 2 + 1] = pz * 0.18;
      // colour: average neighbouring tiles
      let r = 0, g = 0, bl = 0, n = 0;
      for (const [ox, oz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
        const tx = Math.floor(px + ox), tz = Math.floor(pz + oz);
        if (tx < 0 || tz < 0 || tx >= w || tz >= d) continue;
        const t = tiles[tz * w + tx];
        let c = tileColor(t, season, gc, L.seasonal, L.id);
        if (t === T.GRASS && noise.get(tx * 0.35 + 50, tz * 0.35) > 0.62) c = gc.grass2;
        tmpA.setHex(c);
        r += tmpA.r; g += tmpA.g; bl += tmpA.b; n++;
      }
      if (!n) { tmpA.setHex(0x3a3030); r = tmpA.r; g = tmpA.g; bl = tmpA.b; n = 1; }
      const shade = 0.92 + noise.get(px * 0.6 + 20, pz * 0.6) * 0.16;
      // rocks get darker where they are steep
      col[i * 3] = (r / n) * shade;
      col[i * 3 + 1] = (g / n) * shade;
      col[i * 3 + 2] = (bl / n) * shade;
    }
  }
  const idx: number[] = [];
  for (let iz = 0; iz < VD - 1; iz++) {
    for (let ix = 0; ix < VW - 1; ix++) {
      const a = iz * VW + ix, b = a + 1, c = a + VW, e = c + 1;
      // skip quads entirely outside (VOID)
      const tx = Math.floor(ix / S), tz = Math.floor(iz / S);
      if (tiles[Math.min(d - 1, tz) * w + Math.min(w - 1, tx)] === T.VOID) continue;
      if ((ix + iz) % 2 === 0) idx.push(a, c, b, b, c, e);
      else idx.push(a, c, e, a, e, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // darken steep slopes a touch for depth
  const nrm = geo.attributes.normal;
  for (let i = 0; i < VW * VD; i++) {
    const k = 0.75 + 0.25 * Math.max(0, nrm.getY(i));
    col[i * 3] *= k;
    col[i * 3 + 1] *= k;
    col[i * 3 + 2] *= k;
  }
  const ground = new THREE.Mesh(geo, terrainMat());
  ground.receiveShadow = true;
  ground.name = 'ground';

  // ------- skirt (diorama sides) -------
  const sp: number[] = [], sc: number[] = [], si: number[] = [];
  const layers = L.skirt;
  const bottom = -3.4;
  const layerYs = [0, -0.25, -1.3, -2.4, bottom];
  const addEdge = (pts: [number, number][]) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const ha = sampleH(ax, az), hb = sampleH(bx, bz);
      for (let l = 0; l < 4; l++) {
        const base = sp.length / 3;
        const ya0 = l === 0 ? ha : Math.min(ha, layerYs[l]);
        const yb0 = l === 0 ? hb : Math.min(hb, layerYs[l]);
        const ya1 = Math.min(ya0 - 0.01, layerYs[l + 1]);
        const yb1 = Math.min(yb0 - 0.01, layerYs[l + 1]);
        sp.push(ax, ya0, az, bx, yb0, bz, ax, ya1, az, bx, yb1, bz);
        tmpA.setHex(l === 0 ? (L.seasonal && season === 'winter' ? 0xf4f8ff : layers[0]) : layers[l]);
        tmpB.copy(tmpA).multiplyScalar(0.82);
        for (const c of [tmpA, tmpA, tmpB, tmpB]) sc.push(c.r, c.g, c.b);
        si.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
  };
  const step = 1 / S;
  const north: [number, number][] = [], south: [number, number][] = [], west: [number, number][] = [], east: [number, number][] = [];
  for (let x = 0; x <= w + 1e-6; x += step) { north.push([x, 0]); south.push([w - x, d]); }
  for (let z = 0; z <= d + 1e-6; z += step) { east.push([w, z]); west.push([0, d - z]); }
  // winding so faces point outward
  addEdge(north.slice().reverse());
  addEdge(south.slice().reverse());
  addEdge(east.slice().reverse());
  addEdge(west.slice().reverse());
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  sg.setIndex(si);
  sg.computeVertexNormals();
  const skirtMat = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, gradientMap: (terrainMat() as THREE.MeshToonMaterial).gradientMap });
  const skirt = new THREE.Mesh(sg, skirtMat);
  skirt.name = 'skirt';
  if (L.indoor) skirt.visible = L.id === 'house';

  // ------- water & lava -------
  const isWater = (x: number, z: number) => {
    if (x < 0 || z < 0 || x >= w || z >= d) return false;
    const t = tiles[z * w + x];
    return t === T.WATER || t === T.DEEP;
  };
  const isLava = (x: number, z: number) => x >= 0 && z >= 0 && x < w && z < d && tiles[z * w + x] === T.LAVA;
  const buildPlane = (test: (x: number, z: number) => boolean, bridgeTest: (x: number, z: number) => boolean, y: number) => {
    const p: number[] = [], shore: number[] = [], ii: number[] = [];
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      const t = tiles[z * w + x];
      const isB = t === T.BRIDGE && bridgeTest(x, z);
      // dilate by one tile: the terrain bank hides the extra part, giving smooth shorelines
      const near = test(x - 1, z) || test(x + 1, z) || test(x, z - 1) || test(x, z + 1) || test(x - 1, z - 1) || test(x + 1, z + 1) || test(x - 1, z + 1) || test(x + 1, z - 1);
      if (!test(x, z) && !isB && !near) continue;
      const base = p.length / 3;
      const corners: [number, number][] = [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]];
      for (const [cx, cz] of corners) {
        p.push(cx, y, cz);
        // shore factor: corner touches land?
        let land = 0;
        for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const tx = cx + ox, tz = cz + oz;
          if (tx < 0 || tz < 0 || tx >= w || tz >= d) continue;
          const tt = tiles[tz * w + tx];
          if (!test(tx, tz) && tt !== T.BRIDGE) land++;
        }
        shore.push(Math.min(1, land / 2));
      }
      ii.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    if (!p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
    g.setIndex(ii);
    return g;
  };
  const nearAny = (x: number, z: number, f: (x: number, z: number) => boolean) => f(x - 1, z) || f(x + 1, z) || f(x, z - 1) || f(x, z + 1) || f(x - 2, z) || f(x + 2, z) || f(x, z - 2) || f(x, z + 2);
  let water: THREE.Mesh | null = null, lava: THREE.Mesh | null = null;
  const wg = buildPlane(isWater, (x, z) => nearAny(x, z, isWater) && !nearAny(x, z, isLava), L.waterLevel);
  if (wg) {
    water = new THREE.Mesh(wg, waterMaterial(L.id === 'coast' ? 0x2ab8d8 : L.id === 'frosty' ? 0x8ad0f0 : L.id === 'mine' ? 0x3a90a8 : 0x4ac0d8, season === 'winter' && L.seasonal));
    water.name = 'water';
    water.renderOrder = 1;
  }
  const lg = buildPlane(isLava, (x, z) => nearAny(x, z, isLava), -0.15);
  if (lg) {
    lava = new THREE.Mesh(lg, lavaMaterial());
    lava.name = 'lava';
  }
  return {
    ground, skirt, water, lava,
    heightAt: (x, z) => {
      const fx = Math.max(0, Math.min(VW - 1.001, x * S)), fz = Math.max(0, Math.min(VD - 1.001, z * S));
      const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
      const a = vh[z0 * VW + x0], b = vh[z0 * VW + x0 + 1], c = vh[(z0 + 1) * VW + x0], e = vh[(z0 + 1) * VW + x0 + 1];
      return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
    },
  };
}

export function waterMaterial(color: number, frozenTint = false): THREE.ShaderMaterial {
  const c = new THREE.Color(frozenTint ? 0x9ad0e8 : color);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uColor: { value: c }, uDeep: { value: c.clone().multiplyScalar(0.55) }, uLight: { value: 1 }, uSky: { value: new THREE.Color(0xffffff) } },
    ]) as any,
    vertexShader: `
      attribute float aShore;
      varying float vShore; varying vec3 vW;
      uniform float uTime;
      #include <fog_pars_vertex>
      void main(){
        vShore = aShore;
        vec3 p = position;
        p.y += sin(uTime*1.3 + p.x*0.9 + p.z*0.7)*0.025;
        vW = (modelMatrix*vec4(p,1.0)).xyz;
        vec4 mvPosition = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uDeep; uniform float uTime; uniform float uLight; uniform vec3 uSky;
      varying float vShore; varying vec3 vW;
      #include <fog_pars_fragment>
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        float ripple = sin(vW.x*2.1 + uTime*1.2 + sin(vW.z*1.7 + uTime*0.8)*1.4) * sin(vW.z*1.9 - uTime*1.0);
        vec3 col = mix(uDeep, uColor, 0.55 + 0.25*ripple);
        float band = smoothstep(0.82, 0.95, ripple);
        col += vec3(0.35)*band*0.6;
        float foam = smoothstep(0.35, 1.0, vShore) * (0.55 + 0.45*sin(uTime*2.0 + vW.x*3.0 + vW.z*2.0));
        col = mix(col, vec3(1.0), foam*0.7);
        float sp = step(0.985, hash(floor(vW.xz*6.0) + floor(uTime*2.0)));
        col += sp*0.5*uLight;
        col *= mix(0.45, 1.0, uLight);
        col = mix(col, uSky, 0.08);
        gl_FragColor = vec4(col, 0.84 + foam*0.12);
        #include <fog_fragment>
      }`,
  });
  m.uniforms.uTime = globalUniforms.uTime;
  return m;
}

export function lavaMaterial(): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]) as any,
    vertexShader: `
      varying vec3 vW; uniform float uTime;
      #include <fog_pars_vertex>
      void main(){ vec3 p = position; vW = (modelMatrix*vec4(p,1.0)).xyz;
        vec4 mvPosition = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying vec3 vW; uniform float uTime;
      #include <fog_pars_fragment>
      void main(){
        float n = sin(vW.x*1.7 + uTime*0.6) * sin(vW.z*1.3 - uTime*0.5) + sin((vW.x+vW.z)*3.1 + uTime*1.4)*0.4;
        vec3 hot = vec3(1.0, 0.75, 0.25), mid = vec3(1.0, 0.35, 0.08), crust = vec3(0.35, 0.08, 0.05);
        vec3 col = mix(mid, hot, smoothstep(0.2, 0.9, n));
        col = mix(col, crust, smoothstep(-0.5, -0.9, n));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  m.uniforms.uTime = globalUniforms.uTime;
  return m;
}

