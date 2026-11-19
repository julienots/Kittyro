import * as THREE from 'three';
import type { RegionId, Season } from '../state/types';
import { T, type RegionLayout } from './Layout';
import { RECTS, WORLD_BOUNDS, regionAt, type Rect } from './WorldMap';
import { terrainMat, vcMat } from '../render/Materials';
import { treeGeo } from '../models/Nature';
import { Noise2D } from '../core/Random';
import { REGION_BY_ID } from '../data/regions';
import { waterMaterial, tileColor, seasonGrass, groundShade, grassPatch } from './Terrain';

/**
 * The land between and around the regions of the open world: one continuous
 * ground that picks up each region's edge (height, road and soil colour), rivers
 * that keep flowing, the open sea past the coast, rolling hills, a ring of far
 * mountains and thousands of trees. It is scenery only: you walk in the regions.
 */

const TREES: Partial<Record<RegionId, string[]>> = {
  frosty: ['tree_snow', 'tree_snow', 'tree_pine'],
  mountains: ['tree_pine', 'tree_pine', 'tree_snow', 'tree_birch'],
  ember: ['tree_ash'],
  coast: ['tree_palm', 'tree_oak', 'tree_palm'],
  woods: ['tree_pine', 'tree_oak', 'tree_pine', 'tree_birch'],
  highlands: ['tree_oak', 'tree_pine', 'tree_birch', 'tree_pine'],
};
const AMP: Partial<Record<RegionId, number>> = { mountains: 14, frosty: 15, ember: 5, coast: 3, highlands: 9, woods: 7 };

const isWet = (t: number) => t === T.WATER || t === T.DEEP;
const isRoad = (t: number) => t === T.PATH || t === T.BRIDGE || t === T.PLAZA;

export function buildBackdrop(layouts: Map<RegionId, RegionLayout>, season: Season): THREE.Group {
  const group = new THREE.Group();
  group.name = 'backdrop';
  const noise = new Noise2D(9137);
  const M = 110;
  const X0 = WORLD_BOUNDS.x0 - M, Z0 = WORLD_BOUNDS.z0 - M, X1 = WORLD_BOUNDS.x1 + M, Z1 = WORLD_BOUNDS.z1 + M;
  const STEP = 2;

  const nearest = (x: number, z: number): { r: Rect; dist: number } => {
    let best = RECTS[0], bd = Infinity;
    for (const r of RECTS) {
      const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
      const d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; best = r; }
    }
    return { r: best, dist: bd };
  };
  const edgeTile = (r: Rect, x: number, z: number) => {
    const L = layouts.get(r.id)!;
    const lx = Math.max(0, Math.min(L.w - 1, Math.floor(x - r.x0)));
    const lz = Math.max(0, Math.min(L.d - 1, Math.floor(z - r.z0)));
    const i = lz * L.w + lx;
    return { L, t: L.tiles[i], h: L.heights[i] };
  };
  const hills = (x: number, z: number) => noise.get(x * 0.03, z * 0.03) * 0.65 + noise.get(x * 0.085 + 40, z * 0.085) * 0.35;
  const reachOf = (id: RegionId) => (id === 'coast' ? 120 : 16);
  const heightOut = (x: number, z: number) => {
    const { r, dist } = nearest(x, z);
    const { t, h: eh } = edgeTile(r, x, z);
    if (dist === 0) return eh;
    const wet = isWet(t);
    const start = wet ? reachOf(r.id) : isRoad(t) ? 7 : 2.5;
    const rise = THREE.MathUtils.smoothstep(dist, start, start + 32);
    const base = wet ? Math.min(eh, -0.5) : Math.max(eh, -0.1) + (noise.get(x * 0.4, z * 0.4) - 0.5) * 0.12 * Math.min(1, dist);
    const far = r.id === 'coast' ? 0 : THREE.MathUtils.smoothstep(dist, 45, 105) * (10 + hills(x + 300, z) * 16);
    return base + rise * (0.6 + hills(x, z) * (AMP[r.id] ?? 6)) + far;
  };

  // ---------------- ground ----------------
  const NX = Math.floor((X1 - X0) / STEP) + 1, NZ = Math.floor((Z1 - Z0) / STEP) + 1;
  const pos = new Float32Array(NX * NZ * 3), col = new Float32Array(NX * NZ * 3), uv = new Float32Array(NX * NZ * 2);
  const c = new THREE.Color(), e = new THREE.Color(), hillC = new THREE.Color(), rockC = new THREE.Color(), snowC = new THREE.Color(0xf2f6fc);
  const groundCols = new Map<RegionId, THREE.Color>();
  for (const r of RECTS) {
    const def = REGION_BY_ID[r.id];
    const winter = season === 'winter' && layouts.get(r.id)!.seasonal;
    groundCols.set(r.id, new THREE.Color(winter ? 0xe8eef6 : def.ground2));
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + i * STEP, z = Z0 + j * STEP, k = j * NX + i;
    const { r, dist } = nearest(x, z);
    const { L, t } = edgeTile(r, x, z);
    // inside a region: a low-res copy of its own terrain, just under the real ground
    const inside = dist === 0;
    const y = inside ? edgeTile(r, x, z).h - 0.45 : heightOut(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    uv[k * 2] = x * 0.18; uv[k * 2 + 1] = z * 0.18;
    const gc = seasonGrass(season, r.id);
    const ltx = Math.floor(x), ltz = Math.floor(z);
    e.setHex(isWet(t) ? 0x3a8aa8 : t === T.GRASS && grassPatch(ltx, ltz) ? gc.grass2 : tileColor(t, season, gc, L.seasonal, r.id));
    if (inside) {
      const sh = groundShade(x, z);
      col[k * 3] = e.r * sh; col[k * 3 + 1] = e.g * sh; col[k * 3 + 2] = e.b * sh;
      continue;
    }
    const g = groundCols.get(r.id)!;
    const fadeEdge = THREE.MathUtils.smoothstep(dist, isRoad(t) ? 5 : 1.5, isRoad(t) ? 14 : 9);
    c.copy(e).lerp(g, fadeEdge);
    const amp = AMP[r.id] ?? 6;
    hillC.copy(g).multiplyScalar(0.84).lerp(new THREE.Color(r.id === 'ember' ? 0x3a2a2a : r.id === 'frosty' ? 0xe8f0fa : 0x4f8344), 0.3);
    rockC.setHex(r.id === 'ember' ? 0x4a3a3a : 0x8f8b96);
    const up = THREE.MathUtils.clamp((y - 1) / (amp + 8), 0, 1);
    c.lerp(hillC, up * 0.8);
    c.lerp(rockC, THREE.MathUtils.smoothstep(y, 9, 16) * 0.75);
    if (r.id !== 'ember' && r.id !== 'coast') c.lerp(snowC, THREE.MathUtils.smoothstep(y, 15, 22));
    const shade = groundShade(x, z);
    col[k * 3] = c.r * shade; col[k * 3 + 1] = c.g * shade; col[k * 3 + 2] = c.b * shade;
  }
  const idx: number[] = [];
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i, b = a + 1, cc = a + NX, ee = cc + 1;
    idx.push(a, cc, b, b, cc, ee);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, terrainMat());
  ground.receiveShadow = true;
  ground.name = 'backdrop_ground';
  group.add(ground);

  // ---------------- rivers & sea flowing past the region borders ----------------
  for (const r of RECTS) {
    const L = layouts.get(r.id)!;
    const R = reachOf(r.id) + 14;
    const p: number[] = [], sh: number[] = [], ii: number[] = [];
    const wl = L.waterLevel;
    const quad = (x0: number, z0: number, x1: number, z1: number) => {
      const base = p.length / 3;
      p.push(x0, wl, z0, x1, wl, z0, x0, wl, z1, x1, wl, z1);
      sh.push(0, 0, 0, 0);
      ii.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    };
    const open = (gx: number, gz: number) => !regionAt(gx, gz);
    const { w, d, tiles } = L;
    for (let x = 0; x < w; x++) {
      if (isWet(tiles[x]) && open(r.x0 + x + 0.5, r.z0 - 0.5)) quad(r.x0 + x - 0.5, r.z0 - R, r.x0 + x + 1.5, r.z0);
      if (isWet(tiles[(d - 1) * w + x]) && open(r.x0 + x + 0.5, r.z1 + 0.5)) quad(r.x0 + x - 0.5, r.z1, r.x0 + x + 1.5, r.z1 + R);
    }
    for (let z = 0; z < d; z++) {
      if (isWet(tiles[z * w]) && open(r.x0 - 0.5, r.z0 + z + 0.5)) quad(r.x0 - R, r.z0 + z - 0.5, r.x0, r.z0 + z + 1.5);
      if (isWet(tiles[z * w + w - 1]) && open(r.x1 + 0.5, r.z0 + z + 0.5)) quad(r.x1, r.z0 + z - 0.5, r.x1 + R, r.z0 + z + 1.5);
    }
    if (r.id === 'coast') {
      // the open sea fills the corners too
      for (const [cx, cz, sx, sz] of [[r.x1, r.z0, 1, -1], [r.x0, r.z1, -1, 1], [r.x1, r.z1, 1, 1]] as const) {
        quad(Math.min(cx, cx + sx * R), Math.min(cz, cz + sz * R), Math.max(cx, cx + sx * R), Math.max(cz, cz + sz * R));
      }
    }
    if (!p.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('aShore', new THREE.Float32BufferAttribute(sh, 1));
    g.setIndex(ii);
    const wm = new THREE.Mesh(g, waterMaterial(REGION_BY_ID[r.id].water));
    wm.renderOrder = 1;
    wm.name = 'backdrop_water';
    group.add(wm);
  }

  // ---------------- stand-ins for regions that are not loaded ----------------
  const impostors = new Map<RegionId, THREE.Group>();
  const m0 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s0 = new THREE.Vector3(), p0 = new THREE.Vector3(), y0 = new THREE.Vector3(0, 1, 0);
  for (const r of RECTS) {
    const L = layouts.get(r.id)!;
    const byKind = new Map<string, THREE.Matrix4[]>();
    const add = (kind: string, x: number, z: number, s: number, rot: number) => {
      const h = L.heights[Math.max(0, Math.min(L.d - 1, Math.floor(z))) * L.w + Math.max(0, Math.min(L.w - 1, Math.floor(x)))];
      p0.set(r.x0 + x, h - 0.05, r.z0 + z);
      q0.setFromAxisAngle(y0, rot);
      s0.setScalar(s);
      let list = byKind.get(kind);
      if (!list) byKind.set(kind, (list = []));
      list.push(m0.compose(p0, q0, s0).clone());
    };
    for (const n of L.nodes) if (n.kind.startsWith('tree_') && n.kind !== 'tree_giant') add(n.kind, n.x, n.z, 1, n.x * 3.1);
    for (const pr of L.props) if (pr.model.startsWith('tree:')) add(pr.model === 'tree:pine' && r.id === 'frosty' ? 'tree_snow' : `tree_${pr.model.slice(5)}`, pr.x, pr.z, pr.scale ?? 1, pr.rot ?? 0);
    const g = new THREE.Group();
    g.name = `impostor_${r.id}`;
    for (const [kind, mats] of byKind) {
      const im = new THREE.InstancedMesh(treeGeo(kind, season, 1), vcMat({ wind: 0.02, foliage: true }), mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.name = 'backdrop_trees';
      g.add(im);
    }
    impostors.set(r.id, g);
    group.add(g);
  }
  group.userData.impostors = impostors;

  // ---------------- forests ----------------
  const per = new Map<string, THREE.Matrix4[]>();
  let seed = 424242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  for (let n = 0, tries = 0; n < 2600 && tries < 40000; tries++) {
    const x = X0 + rnd() * (X1 - X0), z = Z0 + rnd() * (Z1 - Z0);
    const { r, dist } = nearest(x, z);
    if (dist < 2.4 || dist > 100) continue;
    if (rnd() > 0.3 + dist / 35) continue;
    // keep roads, rivers and the sea clear near the borders
    const { t } = edgeTile(r, x, z);
    if ((isRoad(t) && dist < 10) || (isWet(t) && dist < reachOf(r.id) + 8)) continue;
    const y = heightOut(x, z);
    if (y > 17) continue; // above the tree line
    const kinds = y > 11 ? ['tree_pine', 'tree_snow'] : TREES[r.id] ?? ['tree_oak', 'tree_pine', 'tree_oak', 'tree_birch'];
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    const s = (1.1 + rnd() * 0.6) * (1 + Math.min(1.1, dist / 35));
    pv.set(x, y - 0.05, z);
    q.setFromAxisAngle(yAxis, rnd() * Math.PI * 2);
    sc.setScalar(s);
    m4.compose(pv, q, sc);
    let list = per.get(kind);
    if (!list) per.set(kind, (list = []));
    list.push(m4.clone());
    n++;
  }
  for (const [kind, mats] of per) {
    const im = new THREE.InstancedMesh(treeGeo(kind, season, 1), vcMat({ wind: 0.02, foliage: true }), mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true;
    im.name = 'backdrop_trees';
    group.add(im);
  }
  return group;
}

export function disposeBackdrop(g: THREE.Group): void {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && m.name !== 'backdrop_trees') m.geometry.dispose();
  });
}
