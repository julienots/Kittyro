import * as THREE from 'three';
import { mb, ModelBuilder } from './Builder';
import type { Season } from '../state/types';
import { CROP_BY_ID } from '../data/crops';

/** Trees, rocks, ores, forage, grass and crops — all procedural, season-aware. */

const FOLIAGE: Record<string, Record<Season, number[]>> = {
  oak: { spring: [0x7ccf5a, 0x8ad86a, 0x6cbf4c], summer: [0x4fae4a, 0x5cbf50, 0x46a043], autumn: [0xe8903a, 0xd8602a, 0xf2b84a], winter: [] },
  birch: { spring: [0xa8e07a, 0x98d870], summer: [0x8ad06a, 0x9ad86a], autumn: [0xffd03a, 0xf2b82a], winter: [] },
  pine: { spring: [0x3f8a5a, 0x4a9a62], summer: [0x3a8455, 0x438f5e], autumn: [0x3f7a52, 0x4a8a5a], winter: [0x3a7050, 0x3a7050] },
};

function canopy(b: ModelBuilder, colors: number[], y: number, scale = 1, blossom?: number): void {
  const blobs: [number, number, number, number][] = [
    [0, 0, 0, 0.62], [0.42, -0.12, 0.12, 0.45], [-0.4, -0.08, -0.1, 0.47], [0.05, 0.32, -0.08, 0.45], [-0.12, -0.1, 0.42, 0.42], [0.12, -0.05, -0.42, 0.4],
  ];
  blobs.forEach(([x, yy, z, r], i) => b.ico(r * scale, [colors[i % colors.length], colors[(i + 1) % colors.length]], { pos: [x * scale, y + yy * scale, z * scale] }, 1));
  if (blossom !== undefined) {
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39, h = (i % 5) / 5;
      b.sphere(0.07 * scale, blossom, { pos: [Math.sin(a) * 0.6 * scale, y + (h - 0.2) * 0.7 * scale, Math.cos(a) * 0.6 * scale] }, 5);
    }
  }
}

function bareBranches(b: ModelBuilder, y: number, trunk: number, snow: boolean): void {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.cyl(0.03, 0.06, 0.7, trunk, { pos: [Math.sin(a) * 0.25, y + 0.1, Math.cos(a) * 0.25], rot: [Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7] }, 5);
    if (snow) b.sphere(0.12, 0xffffff, { pos: [Math.sin(a) * 0.48, y + 0.38, Math.cos(a) * 0.48], scale: [1, 0.45, 1] }, 6);
  }
}

export function treeGeo(kind: string, season: Season, variant = 0): THREE.BufferGeometry {
  const b = mb();
  const trunkC = 0x9a6a42;
  switch (kind) {
    case 'tree_oak':
    case 'tree_giant': {
      const s = kind === 'tree_giant' ? 1.8 : 1 + (variant % 3) * 0.08;
      b.cyl(0.13 * s, 0.2 * s, 1.1 * s, [0x7a5232, trunkC], { pos: [0, 0.55 * s, 0] }, 7);
      b.cyl(0.05 * s, 0.08 * s, 0.5 * s, trunkC, { pos: [0.18 * s, 0.95 * s, 0], rot: [0, 0, -0.7] }, 5);
      if (season === 'winter') bareBranches(b, 1.15 * s, trunkC, true);
      else canopy(b, FOLIAGE.oak[season], 1.55 * s, 1.05 * s, season === 'spring' && variant % 2 === 0 ? 0xffc8e0 : undefined);
      if (kind === 'tree_giant') for (let i = 0; i < 4; i++) b.cyl(0.06, 0.12, 0.6, trunkC, { pos: [Math.sin(i * 1.6) * 0.35, 0.15, Math.cos(i * 1.6) * 0.35], rot: [Math.cos(i * 1.6) * 0.9, 0, -Math.sin(i * 1.6) * 0.9] }, 5);
      break;
    }
    case 'tree_birch': {
      b.cyl(0.09, 0.12, 1.5, [0xe8e8e0, 0xf8f8f0], { pos: [0, 0.75, 0] }, 7);
      for (let i = 0; i < 4; i++) b.box(0.1, 0.03, 0.02, 0x3a3a3a, { pos: [0, 0.3 + i * 0.3, 0.1], rot: [0, i, 0] });
      if (season === 'winter') bareBranches(b, 1.3, 0xd8d8d0, true);
      else {
        const c = FOLIAGE.birch[season];
        b.ico(0.42, [c[0], c[1]], { pos: [0, 1.65, 0], scale: [1, 1.35, 1] }, 1);
        b.ico(0.32, [c[1], c[0]], { pos: [0.22, 1.35, 0.1] }, 1);
      }
      break;
    }
    case 'tree_pine':
    case 'tree_snow': {
      const snowy = kind === 'tree_snow' || season === 'winter';
      const c = FOLIAGE.pine[season];
      b.cyl(0.09, 0.14, 0.6, 0x7a5232, { pos: [0, 0.3, 0] }, 6);
      for (let i = 0; i < 3; i++) {
        const r = 0.75 - i * 0.2, y = 0.75 + i * 0.5;
        b.cone(r, 0.8, [c[0], c[1]], { pos: [0, y, 0], rot: [0, i * 0.5, 0] }, 9);
        if (snowy) b.cone(r * 0.62, 0.32, 0xf4f8ff, { pos: [0, y + 0.26, 0], rot: [0, i * 0.5, 0] }, 9);
      }
      break;
    }
    case 'tree_palm': {
      for (let i = 0; i < 5; i++) b.cyl(0.1 - i * 0.008, 0.11 - i * 0.008, 0.36, i % 2 ? 0xa8845a : 0x9a7a52, { pos: [i * 0.06, 0.18 + i * 0.34, 0], rot: [0, 0, -0.12] }, 7);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        b.sphere(0.5, [0x3f9a4a, 0x6ac85a], { pos: [0.3 + Math.sin(a) * 0.45, 1.75, Math.cos(a) * 0.45], rot: [Math.cos(a) * 0.5, a, -Math.sin(a) * 0.5], scale: [0.25, 0.08, 1] }, 6);
      }
      b.sphere(0.09, 0x6a4a2a, { pos: [0.3, 1.66, 0.08] });
      b.sphere(0.09, 0x6a4a2a, { pos: [0.22, 1.64, -0.06] });
      break;
    }
    case 'tree_ash': {
      b.cyl(0.12, 0.2, 1.2, [0x2a2020, 0x3a3030], { pos: [0, 0.6, 0] }, 6);
      for (let i = 0; i < 4; i++) b.cyl(0.03, 0.06, 0.6, 0x2a2020, { pos: [Math.sin(i * 1.7) * 0.25, 1.25, Math.cos(i * 1.7) * 0.25], rot: [Math.cos(i * 1.7) * 0.8, 0, -Math.sin(i * 1.7) * 0.8] }, 5);
      canopy(b, [0xff8a3a, 0xff5a2a, 0xffb04a], 1.6, 0.75);
      break;
    }
    case 'stump': {
      b.cyl(0.32, 0.4, 0.35, [0x7a5232, 0x9a6a42], { pos: [0, 0.17, 0] }, 9);
      b.cyl(0.3, 0.3, 0.02, 0xd8b07a, { pos: [0, 0.35, 0] }, 9);
      b.torus(0.18, 0.012, 0xb08a5a, { pos: [0, 0.362, 0], rot: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 3; i++) b.cyl(0.05, 0.1, 0.35, 0x7a5232, { pos: [Math.sin(i * 2.1) * 0.38, 0.06, Math.cos(i * 2.1) * 0.38], rot: [Math.cos(i * 2.1) * 1.2, 0, -Math.sin(i * 2.1) * 1.2] }, 5);
      b.sphere(0.06, 0xe85a4a, { pos: [0.25, 0.4, 0.1], scale: [1, 0.5, 1] });
      break;
    }
  }
  return b.build();
}

/** Small stump displayed while a chopped tree regrows. */
export function stumpGeo(): THREE.BufferGeometry {
  return mb().cyl(0.14, 0.18, 0.18, 0x8a5a3a, { pos: [0, 0.09, 0] }, 7).cyl(0.13, 0.13, 0.01, 0xd8b07a, { pos: [0, 0.185, 0] }, 7).build();
}

export function bushGeo(kind: string, season: Season, hasBerries: boolean): THREE.BufferGeometry {
  const b = mb();
  const snow = kind === 'bush_snow';
  const leaf = snow ? [0x5a8a7a, 0x6a9a8a] : season === 'autumn' ? [0xb8a03a, 0xc8b04a] : season === 'winter' ? [0x6a8a5a, 0x7a9a6a] : [0x4f9e46, 0x6cbf4c];
  b.ico(0.35, [leaf[0], leaf[1]], { pos: [0, 0.3, 0], scale: [1.2, 0.9, 1.1] }, 1);
  b.ico(0.25, [leaf[1], leaf[0]], { pos: [0.25, 0.22, 0.1] }, 1);
  b.ico(0.24, [leaf[0], leaf[1]], { pos: [-0.22, 0.2, -0.05] }, 1);
  if (snow) b.sphere(0.25, 0xffffff, { pos: [0, 0.55, 0], scale: [1.3, 0.4, 1.2] }, 8);
  if (hasBerries) {
    const c = snow ? 0x8ab8ff : 0xe83a5a;
    for (let i = 0; i < 9; i++) b.sphere(0.055, c, { pos: [Math.sin(i * 2.4) * 0.34, 0.25 + (i % 3) * 0.12, Math.cos(i * 2.4) * 0.3] }, 6);
  }
  return b.build();
}

const ORE_COLORS: Record<string, number> = {
  ore_copper: 0xe8843a, ore_coal: 0x2a2a30, ore_iron: 0xd8dce8, ore_gold: 0xffd03a, ore_crystal: 0x9ae8ff, ore_frost: 0xcfeaff, ore_ember: 0xff5a1a, geode_node: 0xb08ae8,
};

export function rockGeo(kind: string, variant = 0, theme: 'normal' | 'snow' | 'ember' | 'cave' = 'normal'): THREE.BufferGeometry {
  const b = mb();
  const base = theme === 'ember' ? 0x5a4a4a : theme === 'cave' ? 0x8a7a78 : theme === 'snow' ? 0xa8b0c0 : 0xa8a49a;
  const dark = theme === 'ember' ? 0x3a2e2e : theme === 'cave' ? 0x6a5a58 : 0x8a867c;
  switch (kind) {
    case 'rock':
      b.dodeca(0.32, [dark, base], { pos: [0, 0.2, 0], rot: [variant, variant * 2, 0], scale: [1.1, 0.75, 1] });
      b.dodeca(0.16, base, { pos: [0.25, 0.1, 0.12], rot: [variant * 3, 0, 1] });
      if (theme === 'snow') b.sphere(0.24, 0xffffff, { pos: [0, 0.38, 0], scale: [1.2, 0.35, 1.1] }, 8);
      if (theme === 'normal' && variant % 2) b.sphere(0.12, 0x6aa84f, { pos: [-0.1, 0.38, 0.05], scale: [1.4, 0.4, 1.2] }, 6); // moss
      break;
    case 'rock_big':
    case 'boulder': {
      const s = kind === 'boulder' ? 1.7 : 1;
      b.dodeca(0.6 * s, [dark, base], { pos: [0, 0.45 * s, 0], rot: [0.3, variant, 0.2], scale: [1.15, 0.85, 1] });
      b.dodeca(0.35 * s, base, { pos: [0.45 * s, 0.25 * s, 0.25 * s], rot: [1, 0, 0.5] });
      b.dodeca(0.3 * s, dark, { pos: [-0.4 * s, 0.2 * s, -0.25 * s] });
      b.sphere(0.22 * s, 0x6aa84f, { pos: [0, 0.85 * s, 0], scale: [1.5, 0.35, 1.3] }, 8);
      if (kind === 'boulder') for (let i = 0; i < 4; i++) b.box(0.05, 0.3, 0.05, 0x5a4a3a, { pos: [Math.sin(i) * 0.6, 0.9, Math.cos(i) * 0.6], rot: [0.5, i, 0.3] });
      break;
    }
    default: {
      const c = ORE_COLORS[kind] ?? 0xffffff;
      b.dodeca(0.34, [dark, base], { pos: [0, 0.22, 0], rot: [variant, variant * 2, 0], scale: [1.1, 0.8, 1] });
      if (kind === 'ore_crystal' || kind === 'ore_frost' || kind === 'ore_ember' || kind === 'geode_node') {
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3;
          b.cone(0.08 + (i % 2) * 0.03, 0.45 + (i % 3) * 0.12, [c, 0xffffff], { pos: [Math.sin(a) * 0.15, 0.4 + (i % 2) * 0.05, Math.cos(a) * 0.15], rot: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5] }, 6);
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const a = i * 1.1;
          b.dodeca(0.075, c, { pos: [Math.sin(a) * 0.3, 0.2 + (i % 3) * 0.1, Math.cos(a) * 0.28] });
        }
      }
    }
  }
  return b.build();
}

export function forageGeo(itemId: string): THREE.BufferGeometry {
  const b = mb();
  const mush = (cap: number, stem = 0xf4ecd8, s = 1) => {
    b.cyl(0.04 * s, 0.05 * s, 0.14 * s, stem, { pos: [0, 0.07 * s, 0] }, 6);
    b.sphere(0.11 * s, cap, { pos: [0, 0.15 * s, 0], scale: [1, 0.6, 1] }, 8);
  };
  const flower = (petal: number, center = 0xffd03a) => {
    b.cyl(0.012, 0.012, 0.25, 0x4f9e46, { pos: [0, 0.12, 0] }, 4);
    for (let i = 0; i < 5; i++) b.sphere(0.045, petal, { pos: [Math.sin(i * 1.256) * 0.06, 0.26, Math.cos(i * 1.256) * 0.06], scale: [1, 0.5, 1] }, 5);
    b.sphere(0.035, center, { pos: [0, 0.27, 0] }, 5);
    b.sphere(0.05, 0x5cb85c, { pos: [0.05, 0.05, 0], scale: [1.5, 0.3, 0.7] }, 5);
  };
  switch (itemId) {
    case 'button_mushroom': mush(0xf4ecd8); b.geo(new THREE.SphereGeometry(0.06, 6, 5), 0xf4ecd8, { pos: [0.12, 0.05, 0.05], scale: [1, 0.6, 1] }); break;
    case 'chanterelle': mush(0xffb02a, 0xffc84a); break;
    case 'red_cap': mush(0xe83a3a); b.sphere(0.02, 0xffffff, { pos: [0.04, 0.21, 0.04] }); b.sphere(0.02, 0xffffff, { pos: [-0.05, 0.2, 0] }); break;
    case 'glowcap': mush(0x7af0ff, 0xd8fff8, 1.2); break;
    case 'daisy': flower(0xffffff); break;
    case 'bluebell': flower(0x6a8aff, 0x8aa8ff); break;
    case 'poppy': flower(0xff3a3a, 0x2a1e1a); break;
    case 'edelweiss': flower(0xf4f4ec, 0xe8e0a0); break;
    case 'hibiscus': flower(0xff5a8a); break;
    case 'ash_bloom': flower(0x8a7a8a, 0xff8a3a); break;
    case 'lotus': flower(0xffb8d8, 0xffe0a0); break;
    case 'seashell': b.sphere(0.12, [0xffd8c8, 0xfff0e8], { pos: [0, 0.04, 0], scale: [1, 0.4, 0.9] }, 8); for (let i = 0; i < 5; i++) b.box(0.01, 0.02, 0.2, 0xe8b8a8, { pos: [-0.08 + i * 0.04, 0.08, 0], rot: [0, (i - 2) * 0.2, 0] }); break;
    case 'coral': for (let i = 0; i < 4; i++) b.cyl(0.025, 0.035, 0.25, 0xff7a8a, { pos: [Math.sin(i * 1.6) * 0.06, 0.1, Math.cos(i * 1.6) * 0.06], rot: [Math.cos(i * 1.6) * 0.4, 0, Math.sin(i) * 0.4] }, 5); break;
    case 'seaweed': for (let i = 0; i < 3; i++) b.box(0.04, 0.3, 0.01, 0x3a8a4a, { pos: [i * 0.05 - 0.05, 0.15, 0], rot: [0, i, 0.2 * (i - 1)] }); break;
    case 'snowberry': b.sphere(0.06, 0x8ab8ff, { pos: [0, 0.06, 0] }); b.sphere(0.05, 0x9ac8ff, { pos: [0.07, 0.05, 0.03] }); b.sphere(0.08, 0x5a8a7a, { pos: [-0.03, 0.03, -0.05], scale: [1.4, 0.3, 1] }); break;
    case 'ice_lichen': b.sphere(0.12, 0x9ad8c8, { pos: [0, 0.03, 0], scale: [1.3, 0.3, 1] }, 7); break;
    case 'fire_pepper': b.cyl(0.04, 0.015, 0.16, 0xff3a1a, { pos: [0, 0.1, 0], rot: [0.3, 0, 0.4] }); b.sphere(0.12, 0x4f8a3a, { pos: [0, 0.04, 0], scale: [1.4, 0.4, 1] }, 6); break;
    case 'acorn': b.sphere(0.06, 0xb07a4a, { pos: [0, 0.06, 0], scale: [1, 1.2, 1] }); b.sphere(0.065, 0x6a4a2a, { pos: [0, 0.11, 0], scale: [1, 0.5, 1] }); break;
    case 'pinecone': b.cone(0.08, 0.18, 0x8a5a3a, { pos: [0, 0.09, 0], rot: [Math.PI, 0, 0] }, 7); break;
    case 'wild_berry': b.sphere(0.13, 0x4f9e46, { pos: [0, 0.08, 0], scale: [1.3, 0.6, 1.2] }, 7); for (let i = 0; i < 4; i++) b.sphere(0.04, 0xe83a5a, { pos: [Math.sin(i * 1.6) * 0.08, 0.14, Math.cos(i * 1.6) * 0.08] }, 5); break;
    case 'frost_crystal': b.cone(0.06, 0.25, 0xcfeaff, { pos: [0, 0.12, 0] }, 6); b.cone(0.04, 0.16, 0xffffff, { pos: [0.06, 0.08, 0.03], rot: [0, 0, -0.4] }, 6); break;
    case 'coal': b.dodeca(0.08, 0x2a2a30, { pos: [0, 0.06, 0] }); break;
    default: // herbs, mint
      for (let i = 0; i < 5; i++) b.sphere(0.06, itemId === 'mint' ? 0x7ad8a0 : 0x5cb85c, { pos: [Math.sin(i * 1.3) * 0.06, 0.06 + i * 0.03, Math.cos(i * 1.3) * 0.06], scale: [1.3, 0.4, 0.8] }, 5);
  }
  return b.build();
}

export function weedsGeo(season: Season): THREE.BufferGeometry {
  const b = mb();
  const c = season === 'autumn' ? [0x9a8a3a, 0xc8b04a] : season === 'winter' ? [0x8a9a8a, 0xd8e0e0] : [0x4f9e46, 0x9ad86a];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    b.cone(0.05, 0.35 + (i % 3) * 0.1, [c[0], c[1]], { pos: [Math.sin(a) * 0.12, 0.17, Math.cos(a) * 0.12], rot: [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3] }, 4);
  }
  return b.build();
}

export function grassTuftGeo(): THREE.BufferGeometry {
  const b = mb();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.ConeGeometry(0.035, 0.28 + (i % 2) * 0.08, 3);
    b.geo(g, [0xffffff, 0xffffff], { pos: [Math.sin(a) * 0.07, 0.13, Math.cos(a) * 0.07], rot: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35] });
  }
  // gradient baked darker at bottom via vertex colours
  const g = b.build();
  const pos = g.attributes.position, col = g.attributes.color;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, pos.getY(i) / 0.36));
    const k = 0.55 + 0.45 * t;
    col.setXYZ(i, k, k, k);
  }
  return g;
}

export function flowerTuftGeo(): THREE.BufferGeometry {
  const b = mb();
  b.cyl(0.01, 0.012, 0.22, 0x4f9e46, { pos: [0, 0.11, 0] }, 4);
  b.sphere(0.04, 0x5cb85c, { pos: [0.04, 0.04, 0], scale: [1.5, 0.35, 0.7] }, 5);
  for (let i = 0; i < 5; i++) b.sphere(0.04, 0xffffff, { pos: [Math.sin(i * 1.256) * 0.05, 0.23, Math.cos(i * 1.256) * 0.05], scale: [1, 0.45, 1] }, 5);
  b.sphere(0.028, 0xffe27a, { pos: [0, 0.24, 0] }, 5);
  return b.build();
}

// --------------- crops ---------------
export function cropGeo(cropId: string, stage: number, dormant = false): THREE.BufferGeometry {
  const def = CROP_BY_ID[cropId];
  const b = mb();
  const leaf = dormant ? 0x9a9a6a : def.leaf;
  const leaf2 = dormant ? 0x8a8a5a : 0x8ad86a;
  if (stage === 0) {
    b.sphere(0.12, 0x6a4a32, { pos: [0, 0.02, 0], scale: [1, 0.35, 1] }, 7);
    b.sphere(0.03, 0x8ad86a, { pos: [0, 0.06, 0] }, 5);
    return b.build();
  }
  if (stage === 1) {
    b.cyl(0.012, 0.015, 0.14, leaf, { pos: [0, 0.07, 0] }, 4);
    b.sphere(0.055, [leaf, leaf2], { pos: [-0.04, 0.14, 0], scale: [1.4, 0.35, 0.8], rot: [0, 0, 0.4] }, 6);
    b.sphere(0.055, [leaf, leaf2], { pos: [0.04, 0.14, 0], scale: [1.4, 0.35, 0.8], rot: [0, 0, -0.4] }, 6);
    return b.build();
  }
  const grown = stage >= 3;
  const ready = stage === 4;
  const s = stage === 2 ? 0.6 : 1;
  switch (def.shape) {
    case 'leafy': {
      const n = grown ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        b.sphere(0.13 * s, [leaf, ready ? def.color : leaf2], { pos: [Math.sin(a) * 0.09 * s, 0.1 * s, Math.cos(a) * 0.09 * s], rot: [Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7], scale: [1, 0.55, 1.1] }, 7);
      }
      b.sphere(0.12 * s, ready ? def.color : leaf2, { pos: [0, 0.14 * s, 0] }, 8);
      break;
    }
    case 'root': {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        b.cone(0.05 * s, 0.4 * s, [leaf, leaf2], { pos: [Math.sin(a) * 0.05, 0.2 * s, Math.cos(a) * 0.05], rot: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35] }, 4);
      }
      if (grown) b.sphere(0.1, def.color, { pos: [0, 0.03, 0], scale: [1, ready ? 0.9 : 0.5, 1] }, 8);
      break;
    }
    case 'grain': {
      const n = grown ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const a = i * 2.4, r = 0.04 + (i % 3) * 0.05;
        const h = (0.5 + (i % 2) * 0.1) * s;
        b.cyl(0.01, 0.014, h, [leaf, ready ? 0xe8c85a : leaf2], { pos: [Math.sin(a) * r, h / 2, Math.cos(a) * r], rot: [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12] }, 4);
        if (grown) b.capsule(0.025, 0.09, ready ? def.color : 0xb8d86a, { pos: [Math.sin(a) * r * 1.2, h + 0.03, Math.cos(a) * r * 1.2] });
      }
      break;
    }
    case 'tall': {
      const h = (cropId === 'corn' ? 0.95 : 0.65) * s;
      b.cyl(0.025, 0.035, h, [leaf, leaf2], { pos: [0, h / 2, 0] }, 5);
      for (let i = 0; i < 4; i++) b.sphere(0.1 * s, leaf, { pos: [Math.sin(i * 1.6) * 0.1, h * (0.3 + i * 0.17), Math.cos(i * 1.6) * 0.1], rot: [0, i * 1.6, 0.5], scale: [1.4, 0.3, 0.6] }, 6);
      if (cropId === 'tomato') b.cyl(0.01, 0.01, h + 0.1, 0xb08a5a, { pos: [0.1, (h + 0.1) / 2, 0] }, 4);
      if (grown) {
        if (cropId === 'corn') {
          b.capsule(0.05, 0.16, ready ? def.color : 0x9ad86a, { pos: [0.07, h * 0.6, 0.02], rot: [0, 0, -0.3] });
          b.capsule(0.05, 0.16, ready ? def.color : 0x9ad86a, { pos: [-0.07, h * 0.48, -0.02], rot: [0, 0, 0.3] });
        } else {
          for (let i = 0; i < 4; i++) b.sphere(0.055, ready ? def.color : 0x8ad06a, { pos: [Math.sin(i * 2) * 0.11, h * (0.35 + i * 0.12), Math.cos(i * 2) * 0.11] }, 7);
        }
      }
      break;
    }
    case 'bush': {
      b.ico(0.17 * s, [leaf, leaf2], { pos: [0, 0.14 * s, 0], scale: [1.2, 0.85, 1.1] }, 1);
      b.ico(0.12 * s, [leaf2, leaf], { pos: [0.12 * s, 0.1 * s, 0.05] }, 0);
      if (grown) for (let i = 0; i < (cropId === 'blueberry' ? 9 : 6); i++) b.sphere(cropId === 'blueberry' ? 0.035 : 0.045, ready ? def.color : 0xf0f0f0, { pos: [Math.sin(i * 2.4) * 0.16, 0.12 + (i % 3) * 0.06, Math.cos(i * 2.4) * 0.15] }, 6);
      break;
    }
    case 'ground': {
      for (let i = 0; i < 5; i++) b.sphere(0.09, [leaf, leaf2], { pos: [Math.sin(i * 1.3) * 0.2, 0.05, Math.cos(i * 1.3) * 0.2], rot: [0, i, 0], scale: [1.4, 0.35, 1] }, 6);
      if (grown) {
        const r = ready ? 0.2 : 0.11;
        if (cropId === 'watermelon') {
          b.sphere(r, [0x2f7a3a, def.color], { pos: [0, r * 0.8, 0], scale: [1.2, 0.9, 1] }, 12);
          for (let i = 0; i < 5; i++) b.box(0.015, r * 1.6, r * 2, 0x1f5a2a, { pos: [-r + i * r * 0.5, r * 0.8, 0], scale: [1, 1, 1] });
        } else {
          for (let i = 0; i < 6; i++) b.sphere(r * 0.55, def.color, { pos: [Math.sin(i * 1.047) * r * 0.45, r * 0.75, Math.cos(i * 1.047) * r * 0.45], scale: [0.85, 1, 0.85] }, 8);
          b.cyl(0.02, 0.03, 0.08, 0x5a7a3a, { pos: [0, r * 1.5, 0] }, 5);
        }
      }
      break;
    }
    case 'flower': {
      const h = (cropId === 'sunflower' ? 0.85 : 0.45) * s;
      b.cyl(0.014, 0.018, h, leaf, { pos: [0, h / 2, 0] }, 4);
      b.sphere(0.07, leaf2, { pos: [0.06, h * 0.35, 0], scale: [1.6, 0.3, 0.7], rot: [0, 0, 0.4] }, 6);
      b.sphere(0.07, leaf2, { pos: [-0.06, h * 0.55, 0], scale: [1.6, 0.3, 0.7], rot: [0, 0, -0.4] }, 6);
      if (grown) {
        const pc = ready ? def.color : 0xc8e8a8;
        if (cropId === 'sunflower') {
          for (let i = 0; i < 10; i++) b.sphere(0.07, pc, { pos: [Math.sin(i * 0.628) * 0.13, h + Math.cos(i * 0.628) * 0.13, 0.04], scale: [0.6, 0.6, 0.3] }, 5);
          b.cyl(0.1, 0.1, 0.05, 0x6a4a2a, { pos: [0, h, 0.06], rot: [Math.PI / 2, 0, 0] }, 10);
        } else if (cropId === 'tulip') {
          b.sphere(0.08, pc, { pos: [0, h + 0.04, 0], scale: [1, 1.3, 1] }, 8);
          for (let i = 0; i < 3; i++) b.cone(0.035, 0.08, pc, { pos: [Math.sin(i * 2.1) * 0.04, h + 0.13, Math.cos(i * 2.1) * 0.04] }, 4);
        } else if (cropId === 'frostbell' || cropId === 'moonbloom') {
          for (let i = 0; i < 3; i++) b.lathe([[0, 0], [0.06, -0.02], [0.07, -0.1], [0.04, -0.12]], pc, { pos: [Math.sin(i * 2.1) * 0.07, h + 0.05 - i * 0.04, Math.cos(i * 2.1) * 0.07] }, 8);
        } else {
          for (let i = 0; i < 6; i++) b.sphere(0.06, pc, { pos: [Math.sin(i * 1.047) * 0.06, h + 0.02, Math.cos(i * 1.047) * 0.06], scale: [1, 0.7, 1] }, 6);
          b.sphere(0.05, ready ? 0xffe27a : 0xd8f0b8, { pos: [0, h + 0.05, 0] }, 6);
        }
      }
      break;
    }
  }
  return b.build();
}

export function soilGeo(): THREE.BufferGeometry {
  const b = mb();
  // full-tile slab + furrows running edge to edge: neighbouring plots join into
  // one continuous field instead of a grid of separate squares
  b.box(1.0, 0.08, 1.0, 0xffffff, { pos: [0, 0.03, 0] });
  for (let i = 0; i < 3; i++) {
    const z = -1 / 3 + i / 3;
    b.box(1.0, 0.035, 0.13, 0xe6e6e6, { pos: [0, 0.085, z] });
    b.box(1.0, 0.02, 0.05, 0xc4c4c4, { pos: [0, 0.075, z + 1 / 6] });
  }
  return b.build();
}

export function chestGeo(open = false): THREE.BufferGeometry {
  const b = mb();
  b.rbox(0.62, 0.36, 0.42, 0xb07a3a, { pos: [0, 0.18, 0] }, 0.2);
  b.box(0.66, 0.05, 0.46, 0xffc84a, { pos: [0, 0.18, 0] });
  if (open) b.rbox(0.62, 0.12, 0.42, 0xc88a4a, { pos: [0, 0.48, -0.22], rot: [-1.2, 0, 0] }, 0.3);
  else b.rbox(0.62, 0.16, 0.42, 0xc88a4a, { pos: [0, 0.42, 0] }, 0.4);
  b.box(0.1, 0.12, 0.05, 0xffd03a, { pos: [0, 0.32, 0.23] });
  return b.build();
}

export function driftwoodGeo(): THREE.BufferGeometry {
  return mb().cyl(0.06, 0.09, 0.8, 0xc8b8a0, { pos: [0, 0.07, 0], rot: [0, 0.4, Math.PI / 2] }, 6).cyl(0.03, 0.04, 0.3, 0xc8b8a0, { pos: [0.15, 0.12, 0.1], rot: [0.6, 0, 1] }, 5).build();
}

export function claySpotGeo(): THREE.BufferGeometry {
  return mb().sphere(0.3, 0xb8785a, { pos: [0, 0, 0], scale: [1.2, 0.18, 1] }, 9).sphere(0.08, 0xc8886a, { pos: [0.1, 0.05, 0.05], scale: [1, 0.6, 1] }).build();
}
