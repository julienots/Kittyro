import * as THREE from 'three';
import { T, type RegionLayout } from './Layout';
import type { Season } from '../state/types';
import { terrainMat, vcMat } from '../render/Materials';
import { treeGeo } from '../models/Nature';
import { Noise2D } from '../core/Random';

/**
 * The land around a region: the ground keeps going past the playable area
 * (roads and rivers continue, then rolling hills and a distant forest), so the
 * world never ends on a cliff over the void, in first person or overhead.
 */

const RINGS = [1, 2.5, 4.5, 7, 10, 14, 19, 25, 33, 43, 56, 72, 92];

const TREES: Record<string, string[]> = {
  frosty: ['tree_snow', 'tree_snow', 'tree_pine'],
  mountains: ['tree_pine', 'tree_pine', 'tree_snow', 'tree_birch'],
  ember: ['tree_ash'],
  coast: ['tree_palm', 'tree_oak', 'tree_palm'],
  woods: ['tree_pine', 'tree_oak', 'tree_pine', 'tree_birch'],
};

export interface OutskirtsInput {
  L: RegionLayout;
  season: Season;
  heightAt: (x: number, z: number) => number;
  colorOf: (tile: number) => number;
  water: THREE.Mesh | null;
}

export function buildOutskirts({ L, season, heightAt, colorOf, water }: OutskirtsInput): THREE.Group {
  const { w, d, tiles } = L;
  const group = new THREE.Group();
  group.name = 'outskirts';
  const noise = new Noise2D(w * 71 + d * 3 + 11);
  const tileAt = (x: number, z: number) => tiles[Math.max(0, Math.min(d - 1, Math.floor(z))) * w + Math.max(0, Math.min(w - 1, Math.floor(x)))];
  const isWet = (t: number) => t === T.WATER || t === T.DEEP;
  const isRoad = (t: number) => t === T.PATH || t === T.BRIDGE || t === T.PLAZA;
  const coast = L.id === 'coast';
  const reach = coast ? 70 : 16; // how far water keeps going before the hills close it

  // dominant ground along the border (the colour the hills take)
  const counts = new Map<number, number>();
  for (let x = 0; x < w; x++) for (const z of [0, d - 1]) { const t = tiles[z * w + x]; if (!isRoad(t) && !isWet(t) && t !== T.VOID) counts.set(t, (counts.get(t) ?? 0) + 1); }
  for (let z = 0; z < d; z++) for (const x of [0, w - 1]) { const t = tiles[z * w + x]; if (!isRoad(t) && !isWet(t) && t !== T.VOID) counts.set(t, (counts.get(t) ?? 0) + 1); }
  let ground: number = T.GRASS, best = -1;
  for (const [t, n] of counts) if (n > best) { best = n; ground = t; }
  const groundC = new THREE.Color(colorOf(ground));
  const hillC = groundC.clone().multiplyScalar(0.86).lerp(new THREE.Color(L.id === 'ember' ? 0x3a2a2a : L.id === 'frosty' ? 0xe8f0fa : 0x5a8a4a), 0.25);
  const rockC = new THREE.Color(L.id === 'frosty' || (L.seasonal && season === 'winter') ? 0xf0f6ff : L.id === 'ember' ? 0x4a3a3a : 0x9a96a0);
  const hillAmp = L.id === 'mountains' || L.id === 'frosty' ? 13 : L.id === 'coast' ? 5 : L.id === 'ember' ? 9 : 7;

  const info = (x: number, z: number) => {
    const cx = Math.max(0, Math.min(w, x)), cz = Math.max(0, Math.min(d, z));
    const dist = Math.hypot(x - cx, z - cz);
    const t = tileAt(cx - (cx >= w ? 0.01 : 0), cz - (cz >= d ? 0.01 : 0));
    return { cx, cz, dist, t };
  };
  const hills = (x: number, z: number) => noise.get(x * 0.035, z * 0.035) * 0.65 + noise.get(x * 0.09 + 40, z * 0.09) * 0.35;
  const heightOut = (x: number, z: number) => {
    const { cx, cz, dist, t } = info(x, z);
    const edge = heightAt(cx, cz);
    if (dist === 0) return edge;
    const wet = isWet(t);
    const start = wet ? reach : isRoad(t) ? 9 : 3;
    const rise = THREE.MathUtils.smoothstep(dist, start, start + 30);
    const base = wet ? edge : Math.max(edge, -0.1) + (noise.get(x * 0.4, z * 0.4) - 0.5) * 0.12 * Math.min(1, dist);
    return base + rise * (0.6 + hills(x, z) * hillAmp);
  };

  // ---- ground: a grid whose inner rows match the island's own vertices ----
  const axis = (n: number) => {
    const a: number[] = [];
    for (let i = RINGS.length - 1; i >= 0; i--) a.push(-RINGS[i]);
    for (let v = 0; v <= n + 1e-6; v += 0.5) a.push(v);
    for (const r of RINGS) a.push(n + r);
    return a;
  };
  const xs = axis(w), zs = axis(d);
  const NX = xs.length, NZ = zs.length;
  const pos = new Float32Array(NX * NZ * 3), col = new Float32Array(NX * NZ * 3), uv = new Float32Array(NX * NZ * 2);
  const c = new THREE.Color(), e = new THREE.Color();
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = xs[i], z = zs[j], k = j * NX + i;
    const { dist, t } = info(x, z);
    const y = heightOut(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    uv[k * 2] = x * 0.18; uv[k * 2 + 1] = z * 0.18;
    // the edge tile's colour carries on (roads, sand, river banks) then fades into the hills
    e.setHex(colorOf(t));
    const fadeEdge = THREE.MathUtils.smoothstep(dist, isRoad(t) ? 6 : 1.5, isRoad(t) ? 16 : 8);
    c.copy(e).lerp(groundC, fadeEdge);
    const up = THREE.MathUtils.clamp((y - 1) / hillAmp, 0, 1);
    c.lerp(hillC, up * 0.8);
    if (hillAmp > 8) c.lerp(rockC, THREE.MathUtils.smoothstep(up, 0.55, 0.9) * 0.7);
    const shade = 0.92 + noise.get(x * 0.6 + 20, z * 0.6) * 0.16;
    col[k * 3] = c.r * shade; col[k * 3 + 1] = c.g * shade; col[k * 3 + 2] = c.b * shade;
  }
  const idx: number[] = [];
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const mx = (xs[i] + xs[i + 1]) / 2, mz = (zs[j] + zs[j + 1]) / 2;
    if (mx > 0 && mx < w && mz > 0 && mz < d) continue; // the island itself
    const a = j * NX + i, b = a + 1, cc = a + NX, ee = cc + 1;
    idx.push(a, cc, b, b, cc, ee);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, terrainMat());
  mesh.receiveShadow = true;
  mesh.name = 'outskirts_ground';
  group.add(mesh);

  // ---- rivers and the sea flow on past the border ----
  if (water) {
    const p: number[] = [], sh: number[] = [], ii: number[] = [];
    const quad = (x0: number, z0: number, x1: number, z1: number) => {
      const base = p.length / 3;
      p.push(x0, L.waterLevel, z0, x1, L.waterLevel, z0, x0, L.waterLevel, z1, x1, L.waterLevel, z1);
      sh.push(0, 0, 0, 0);
      ii.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    };
    const R = reach + 14;
    for (let x = 0; x < w; x++) {
      if (isWet(tiles[x])) quad(x - 0.5, -R, x + 1.5, 0);
      if (isWet(tiles[(d - 1) * w + x])) quad(x - 0.5, d, x + 1.5, d + R);
    }
    for (let z = 0; z < d; z++) {
      if (isWet(tiles[z * w])) quad(-R, z - 0.5, 0, z + 1.5);
      if (isWet(tiles[z * w + w - 1])) quad(w, z - 0.5, w + R, z + 1.5);
    }
    // corners of a sea coast
    if (coast) {
      for (const [cx, cz, sx, sz] of [[0, 0, -1, -1], [w, 0, 1, -1], [0, d, -1, 1], [w, d, 1, 1]] as const) {
        if (isWet(tileAt(cx - (sx > 0 ? 1 : 0), cz - (sz > 0 ? 1 : 0)))) quad(Math.min(cx, cx + sx * R), Math.min(cz, cz + sz * R), Math.max(cx, cx + sx * R), Math.max(cz, cz + sz * R));
      }
    }
    if (p.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('aShore', new THREE.Float32BufferAttribute(sh, 1));
      g.setIndex(ii);
      const wm = new THREE.Mesh(g, water.material);
      wm.renderOrder = 1;
      wm.name = 'outskirts_water';
      group.add(wm);
    }
  }

  // ---- distant forest ----
  const kinds = TREES[L.id] ?? ['tree_oak', 'tree_pine', 'tree_oak', 'tree_birch'];
  const per = new Map<string, THREE.Matrix4[]>();
  let seed = w * 977 + d;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  const W = w + 2 * 48, D = d + 2 * 48;
  for (let n = 0, tries = 0; n < 170 && tries < 2400; tries++) {
    const x = -48 + rnd() * W, z = -48 + rnd() * D;
    const { cx, cz, dist } = info(x, z);
    if (dist < 2.2 || dist > 46) continue;
    // denser farther out, keep roads, rivers and the sea open
    if (rnd() > 0.35 + dist / 40) continue;
    let open = false;
    for (let o = -2; o <= 2 && !open; o++) {
      const t = cx === 0 || cx === w ? tileAt(cx, cz + o) : tileAt(cx + o, cz);
      if (isRoad(t) || isWet(t)) open = true;
    }
    if (open && dist < (coast ? reach + 12 : 28)) continue;
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    const s = (1.1 + rnd() * 0.5) * (1 + Math.min(1.2, dist / 30));
    pv.set(x, heightOut(x, z) - 0.05, z);
    q.setFromAxisAngle(yAxis, rnd() * Math.PI * 2);
    sc.setScalar(s);
    m4.compose(pv, q, sc);
    let list = per.get(kind);
    if (!list) per.set(kind, (list = []));
    list.push(m4.clone());
    n++;
  }
  for (const [kind, mats] of per) {
    const im = new THREE.InstancedMesh(treeGeo(kind, season, 1), vcMat({ wind: 0.02 }), mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.name = 'outskirts_trees';
    group.add(im);
  }
  return group;
}
