import * as THREE from 'three';
import { mb, cachedGeo } from '../models/Builder';
import { treeGeo, rockGeo, bushGeo, forageGeo, weedsGeo, stumpGeo, chestGeo, driftwoodGeo, claySpotGeo } from '../models/Nature';
import { propModel } from '../models/Props';
import { DECOR_BY_ID } from '../data/decor';
import { vcMat } from '../render/Materials';
import type { Season } from '../state/types';

/** Shared glowing material for lamps, crystals... its emissive intensity follows the night. */
export const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
export const glowState = { night: 0 };
export function updateGlow(night: number): void {
  glowState.night = night;
  const k = 0.75 + night * 0.6;
  glowMat.color.setScalar(k);
}

export const windowMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false });
export function updateWindows(night: number): void {
  windowMat.color.setRGB(0.55 + night * 0.6, 0.62 + night * 0.45, 0.68 + night * 0.1);
}

export function regionTheme(regionId: string): 'normal' | 'snow' | 'ember' | 'cave' {
  return regionId === 'frosty' ? 'snow' : regionId === 'ember' ? 'ember' : regionId === 'mine' ? 'cave' : 'normal';
}

/** Geometry for a node visual key. Keys: 'node:<kind>[:extra]' */
export function nodeGeo(key: string, season: Season, regionId: string): THREE.BufferGeometry | null {
  const [, kind, extra] = key.split(':');
  const theme = regionTheme(regionId);
  return cachedGeo(`${key}|${season}|${theme}`, () => {
    if (kind.startsWith('tree_')) return treeGeo(kind, season);
    if (kind === 'stump') return treeGeo('stump', season);
    if (kind === 'stump_small') return stumpGeo();
    if (kind === 'bush_berry' || kind === 'bush_snow') return bushGeo(kind, season, extra === 'full');
    if (kind === 'rock' || kind === 'rock_big' || kind === 'boulder' || kind.startsWith('ore_') || kind === 'geode_node') return rockGeo(kind, 1, theme);
    if (kind === 'forage') return forageGeo(extra ?? 'herb');
    if (kind === 'weeds') return weedsGeo(season);
    if (kind === 'chest') return chestGeo(extra === 'open');
    if (kind === 'driftwood') return driftwoodGeo();
    if (kind === 'clay_spot') return claySpotGeo();
    return mb().sphere(0.2, 0xff00ff).build();
  });
}

/** Geometry for static decorative prop models. */
export function staticPropGeo(model: string, season: Season, regionId: string): { geo: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } | null {
  if (model === 'none' || model === 'waterfall') return null;
  const theme = regionTheme(regionId);
  if (model.startsWith('tree:')) {
    const kind = model.slice(5);
    const k = kind === 'pine' && (regionId === 'frosty') ? 'tree_snow' : `tree_${kind}`;
    return { geo: cachedGeo(`sp:${k}|${season}`, () => treeGeo(k, season, 1)), glow: null };
  }
  const simple = (make: () => THREE.BufferGeometry) => ({ geo: cachedGeo(`sp:${model}|${season}|${theme}`, make), glow: null });
  switch (model) {
    case 'rocks_small':
      return simple(() => {
        const b = mb();
        const c = theme === 'ember' ? 0x4a3a3a : theme === 'snow' ? 0xb8c0d0 : theme === 'cave' ? 0x7a6a68 : 0xa8a49a;
        b.dodeca(0.12, c, { pos: [0, 0.05, 0], scale: [1.2, 0.6, 1] });
        b.dodeca(0.08, c, { pos: [0.15, 0.03, 0.08], scale: [1, 0.6, 1] });
        return b.build();
      });
    case 'log_small':
      return simple(() => mb().cyl(0.14, 0.14, 1.1, 0x8a5a3a, { pos: [0, 0.12, 0], rot: [0, 0, Math.PI / 2] }, 8).cyl(0.12, 0.12, 0.02, 0xd8b07a, { pos: [0.56, 0.12, 0], rot: [0, 0, Math.PI / 2] }, 8).sphere(0.1, 0x6aa84f, { pos: [-0.1, 0.25, 0], scale: [2, 0.4, 1] }, 6).build());
    case 'mushrooms':
      return simple(() => {
        const b = mb();
        for (let i = 0; i < 3; i++) {
          const x = Math.sin(i * 2.1) * 0.12, z = Math.cos(i * 2.1) * 0.12, s = 0.7 + i * 0.2;
          b.cyl(0.03 * s, 0.04 * s, 0.12 * s, 0xf4ecd8, { pos: [x, 0.06 * s, z] }, 5);
          b.sphere(0.08 * s, i % 2 ? 0xe85a4a : 0xd8a86a, { pos: [x, 0.13 * s, z], scale: [1, 0.6, 1] }, 7);
        }
        return b.build();
      });
    case 'fern':
      return simple(() => {
        const b = mb();
        const c = season === 'autumn' ? [0x8a8a3a, 0xc8b04a] : season === 'winter' ? [0x6a8a6a, 0xa8c0a8] : [0x3f8a46, 0x7ccf5a];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          b.sphere(0.2, [c[0], c[1]], { pos: [Math.sin(a) * 0.17, 0.12, Math.cos(a) * 0.17], rot: [Math.cos(a) * -0.6, a, Math.sin(a) * 0.6], scale: [0.25, 0.08, 1] }, 5);
        }
        return b.build();
      });
    case 'shells':
      return simple(() => mb().sphere(0.07, 0xffd8e8, { pos: [0, 0.02, 0], scale: [1, 0.4, 0.9] }, 6).sphere(0.05, 0xfff0d0, { pos: [0.12, 0.02, 0.06], scale: [1, 0.5, 1] }, 6).cone(0.04, 0.1, 0xe8b8a0, { pos: [-0.1, 0.03, 0.05], rot: [0, 0, 1.4] }, 5).build());
    case 'ice_shards':
      return simple(() => {
        const b = mb();
        for (let i = 0; i < 3; i++) b.cone(0.07, 0.3 + i * 0.1, [0xa8d8f0, 0xffffff], { pos: [Math.sin(i * 2.1) * 0.1, 0.15, Math.cos(i * 2.1) * 0.1], rot: [Math.cos(i * 2.1) * 0.3, 0, Math.sin(i * 2.1) * 0.3] }, 5);
        return b.build();
      });
    case 'crystals_small':
      return simple(() => {
        const b = mb();
        for (let i = 0; i < 3; i++) b.cone(0.06, 0.28 + i * 0.08, [0x9a7ad8, 0xd8c8ff], { pos: [Math.sin(i * 2.1) * 0.1, 0.13, Math.cos(i * 2.1) * 0.1], rot: [Math.cos(i * 2.1) * 0.3, 0, Math.sin(i * 2.1) * 0.3] }, 5);
        return b.build();
      });
    case 'cliff_rock':
      return simple(() => {
        const b = mb();
        const c = theme === 'ember' ? 0x4a3a3a : theme === 'snow' ? 0xb8c4d8 : theme === 'cave' ? 0x6a5a58 : 0x9a96a0;
        const c2 = theme === 'ember' ? 0x2e2424 : theme === 'snow' ? 0x9aa8c0 : theme === 'cave' ? 0x4a3e3c : 0x7a7680;
        b.dodeca(0.7, [c2, c], { pos: [0, 0.35, 0], scale: [1, 1.3, 0.9] });
        b.dodeca(0.45, c, { pos: [0.45, 0.2, 0.2], rot: [0.5, 1, 0] });
        if (theme === 'snow') b.sphere(0.5, 0xffffff, { pos: [0, 1.15, 0], scale: [1.1, 0.35, 1] }, 8);
        else if (theme === 'normal') b.sphere(0.35, 0x7aa860, { pos: [-0.1, 1.15, 0], scale: [1.3, 0.3, 1] }, 7);
        return b.build();
      });
    case 'ember_rocks':
      return simple(() => mb().dodeca(0.14, 0x2a2020, { pos: [0, 0.07, 0], scale: [1.2, 0.7, 1] }).sphere(0.05, 0xff6a2a, { pos: [0.05, 0.12, 0.05] }, 5).build());
  }
  const def = DECOR_BY_ID[model];
  if (def) {
    const key = `decor:${model}|${season}`;
    const geo = cachedGeo(key, () => propModel(def, season).geo);
    const glowGeo = def.light ? cachedGeo(`${key}|glow`, () => propModel(def, season).glow ?? new THREE.BufferGeometry()) : null;
    return { geo, glow: glowGeo && glowGeo.attributes.position ? glowGeo : null };
  }
  return null;
}

export const propMat = () => vcMat({ seeThrough: true, snowCap: true });
export const foliageMat = () => vcMat({ wind: 0.035, seeThrough: true, snowCap: true });
export const cropMat = () => vcMat({ wind: 0.25 });
export const grassMat = () => vcMat({ wind: 0.9 });
