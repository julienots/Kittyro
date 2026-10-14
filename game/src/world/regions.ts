import type { GameState, RegionId } from '../state/types';
import { LayoutBuilder, T, type RegionLayout } from './Layout';
import { FARM } from '../state/newGame';
import { VILLAGE_BUILDINGS } from '../data/village';
import { HOUSE_W, HOUSE_D } from './houseLayout';
import type { MineFloor } from '../systems/Mining';
import { MINE_SIZE } from '../systems/Mining';
import { HAMLET_AREA } from '../data/hamlet';

/**
 * Hand-designed region layouts with procedural detail. Deterministic for a given
 * save seed, so trees and rocks stay where the player left them.
 */

function treeEdge(b: LayoutBuilder, kinds: string[], gaps: [number, number, number, number][] = [], thickness = 2): void {
  const { w, d } = b.L;
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const edge = x < thickness || z < thickness || x >= w - thickness || z >= d - thickness;
    if (!edge || gaps.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1)) continue;
    if (b.isReserved(x, z)) continue;
    if ((x + z * 3) % 2 === 0 || b.r.chance(0.5)) b.prop(`tree:${b.r.pick(kinds)}`, x + 0.5 + b.r.range(-0.2, 0.2), z + 0.5 + b.r.range(-0.2, 0.2), { blocks: true, scale: b.r.range(0.95, 1.35) });
    else b.reserve(x, z, x + 1, z + 1);
  }
  // make sure edges block even where no tree was placed
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const edge = x < thickness || z < thickness || x >= w - thickness || z >= d - thickness;
    if (edge && !gaps.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1)) b.L.props.push({ model: 'none', x: x + 0.5, z: z + 0.5, blocks: true });
  }
}

/** Decorative boulders along rock ridges so cliffs read as solid stone. */
function cliffRocks(b: LayoutBuilder, density = 0.45): void {
  const { w, d } = b.L;
  for (let z = 1; z < d - 1; z++) for (let x = 1; x < w - 1; x++) {
    if (b.get(x, z) !== T.ROCK) continue;
    const edge = [b.get(x + 1, z), b.get(x - 1, z), b.get(x, z + 1), b.get(x, z - 1)].some((t) => t !== T.ROCK);
    if (!edge || !b.r.chance(density)) continue;
    b.L.props.push({ model: 'cliff_rock', x: x + 0.5 + b.r.range(-0.2, 0.2), z: z + 0.5 + b.r.range(-0.2, 0.2), rot: b.r.range(0, 6.28), scale: b.r.range(0.9, 1.6) });
  }
}

function sprinkle(b: LayoutBuilder, model: string, count: number, x0: number, z0: number, x1: number, z1: number, allowed?: number[]): void {
  for (let i = 0; i < count; i++) {
    const x = b.r.range(x0, x1), z = b.r.range(z0, z1);
    if (b.free(Math.floor(x), Math.floor(z), allowed)) b.prop(model, x, z, { scale: b.r.range(0.8, 1.2) });
  }
}

export function buildFarm(seed: number, st: GameState): RegionLayout {
  const b = new LayoutBuilder('farm', 52, 46, seed);
  b.L.grass = 0.75;
  b.L.flowers = [0xffffff, 0xffd03a, 0xff8ab8, 0xb08ae8];
  // north stream & east river
  b.line([[-1, 4], [12, 4.5], [26, 3.8], [38, 4.5], [45, 6]], 2.4, T.WATER, 0.25);
  b.line([[45, -1], [45.5, 6], [44, 16], [45, 28], [44, 38], [45, 47]], 3.2, T.WATER, 0.2);
  b.circle(5, 41, 3, T.WATER);
  // paths
  b.line([[FARM.house.x + 2.8, FARM.house.z + 4.5], [18, 20], [30, 22], [40, 24], [52, 24]], 1.6, T.PATH, 0.15);
  b.line([[14, 15], [10, 9], [9.5, 0]], 1.5, T.PATH, 0.15);
  b.line([[24, 12], [30, 8], [30.5, 0]], 1.5, T.PATH, 0.15);
  // bridges
  b.rect(43, 22, 48, 26, T.BRIDGE);
  b.structure({ kind: 'bridge', x: 43, z: 22, w: 5, d: 4, blocks: false, params: { span: 'x' } });
  const woodsOpen = st.regions.woods.unlocked;
  b.rect(8, 2, 12, 7, woodsOpen ? T.BRIDGE : T.WATER);
  b.structure({ kind: 'bridge', id: 'woods_bridge', x: 8, z: 2, w: 4, d: 5, blocks: !woodsOpen, params: { span: 'z', broken: !woodsOpen } });
  b.rect(29, 2, 32, 6, T.BRIDGE);
  b.structure({ kind: 'bridge', x: 29, z: 2, w: 3, d: 4, blocks: false, params: { span: 'z', stone: true } });
  // reserve farm core
  b.reserve(FARM.house.x, FARM.house.z, FARM.house.x + 5, FARM.house.z + 5);
  b.reserve(FARM.shippingBin.x, FARM.shippingBin.z, FARM.shippingBin.x + 1, FARM.shippingBin.z + 1);
  b.reserve(19, 17, 25, 21);
  b.reserve(12, 15, 18, 19);
  // edges
  treeEdge(b, ['oak', 'oak', 'pine', 'birch'], [[8, 0, 12, 3], [29, 0, 32, 3], [49, 21, 52, 27], [43, 0, 48, 2], [43, 44, 48, 46]]);
  // portals
  b.portal({ x0: 8, z0: 0, x1: 12, z1: 1, to: 'woods', anchor: 'farm_entry', label: 'Whispering Woods' });
  b.portal({ x0: 29, z0: 0, x1: 32, z1: 1, to: 'mountains', anchor: 'farm_entry', label: 'Crystal Mountains' });
  b.portal({ x0: 51, z0: 21, x1: 52, z1: 27, to: 'village', anchor: 'farm_entry', label: 'Willowbrook' });
  b.anchor('woods_entry', 10, 7.6);
  b.anchor('mountains_entry', 30.5, 7.5);
  b.anchor('village_entry', 49.5, 24);
  b.anchor('house_entry', FARM.house.x + 2.8, FARM.house.z + 4.4);
  b.anchor('moss_bench', 17, 15.5);
  b.anchor('meadow', 32, 33);
  b.anchor('mine_entry', 30, 8);
  b.anchor('spawn', FARM.spawn.x, FARM.spawn.z);
  // story boulder blocks the mountain path
  b.node('boulder', 30.5, 3.0 + 4.2, { once: true });
  // signposts
  b.structure({ kind: 'signpost', x: 12, z: 7, w: 1, d: 1, params: { label: 'Forêt' } });
  b.structure({ kind: 'signpost', x: 32, z: 8, w: 1, d: 1, params: { label: 'Montagnes' } });
  b.structure({ kind: 'signpost', x: 41, z: 21, w: 1, d: 1, params: { label: 'Village' } });
  // debris inside the farm (cleared once)
  const fx0 = FARM.minX, fz0 = FARM.minZ, fx1 = FARM.maxX, fz1 = FARM.maxZ;
  const debris = (kind: string, n: number) => {
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 40) {
      tries++;
      const x = b.r.int(fx0, fx1 - 1), z = b.r.int(fz0, fz1 - 1);
      if (!b.free(x, z, [T.GRASS])) continue;
      if (st.farm.plots[`${x},${z}`] || st.farm.placed.some((p) => x >= p.x && z >= p.z && x < p.x + 5 && z < p.z + 5)) continue;
      b.node(kind, x + 0.5, z + 0.5, { once: true });
      placed++;
    }
  };
  debris('weeds', 34);
  debris('rock', 12);
  debris('tree_oak', 5);
  debris('stump', 3);
  // nature around
  b.scatter(['tree_oak', 'tree_oak', 'tree_birch', 'tree_pine'], 16, 2, 8, 8, 44);
  b.scatter(['tree_oak', 'tree_birch'], 10, 8, 38, 42, 44);
  b.scatter(['tree_oak', 'tree_pine'], 6, 40, 8, 43, 44);
  b.scatter(['tree_oak', 'tree_birch'], 6, 12, 6, 28, 10);
  b.scatter(['rock', 'rock', 'ore_copper'], 8, 2, 8, 8, 44, undefined, 1);
  b.scatter('bush_berry', 5, 2, 8, 44, 44);
  b.scatter('forage', 10, 2, 6, 44, 44);
  b.scatter('clay_spot', 3, 2, 30, 10, 44);
  b.scatter('weeds', 8, 32, 6, 44, 10);
  sprinkle(b, 'rocks_small', 10, 2, 2, 50, 44);
  sprinkle(b, 'log_small', 4, 2, 8, 8, 44);
  // south trail to the hamlet — added last so the rest of the farm stays identical for existing saves
  b.line([[23.5, 37.5], [23.5, 47]], 1.6, T.PATH, 0.1);
  b.L.props = b.L.props.filter((p) => !(p.x >= 20.5 && p.x < 26.5 && p.z >= 38));
  b.L.nodes = b.L.nodes.filter((n) => !(n.z >= 37 && b.get(Math.floor(n.x), Math.floor(n.z)) === T.PATH) && !(n.x >= 20.5 && n.x < 26.5 && n.z >= 42));
  b.portal({ x0: 21, z0: 45, x1: 26, z1: 46, to: 'hamlet', anchor: 'farm_entry', label: 'Clairefontaine' });
  b.anchor('hamlet_entry', 23.5, 42.5);
  b.L.structures.push({ kind: 'signpost', x: 25, z: 40, w: 1, d: 1, params: { label: 'Hameau' } });
  return b.done({ hills: 0.22 });
}

export function buildVillage(seed: number, st: GameState): RegionLayout {
  const b = new LayoutBuilder('village', 48, 42, seed);
  b.L.grass = 0.55;
  b.L.flowers = [0xffffff, 0xff8ab8, 0xffd03a, 0x8ad8ff];
  b.line([[34, -1], [35, 10], [34.5, 22], [36, 32], [35.5, 43]], 2.6, T.WATER, 0.2);
  b.circle(24, 20, 6.5, T.PLAZA, 0.05);
  b.line([[-1, 20.5], [17.5, 20.5]], 2, T.PATH, 0.1);
  b.line([[24, 26], [24, 34]], 1.6, T.PATH, 0.1);
  b.line([[29, 23], [40, 34], [41, 43]], 1.6, T.PATH, 0.1);
  b.line([[29, 17], [40, 8], [42, -1]], 1.6, T.PATH, 0.1);
  b.line([[30, 20.5], [41, 20.5]], 1.8, T.PATH, 0.1);
  b.line([[17, 15], [15.5, 13.5]], 1.4, T.PATH, 0.1);
  b.line([[20, 18], [21, 12.5]], 1.4, T.PATH, 0.1);
  b.line([[27, 16], [27, 12.5]], 1.4, T.PATH, 0.1);
  b.line([[18, 22], [12, 31]], 1.4, T.PATH, 0.1);
  b.line([[18, 17], [10, 9]], 1.4, T.PATH, 0.1);
  b.rect(33, 19, 38, 22, T.BRIDGE);
  b.structure({ kind: 'bridge', x: 33, z: 19, w: 5, d: 3, blocks: false, params: { span: 'x' } });
  b.rect(33, 30, 39, 33, T.BRIDGE);
  b.structure({ kind: 'bridge', x: 33, z: 30, w: 6, d: 3, blocks: false, params: { span: 'x' } });
  b.rect(33, 9, 38, 12, T.BRIDGE);
  b.structure({ kind: 'bridge', x: 33, z: 9, w: 5, d: 3, blocks: false, params: { span: 'x' } });
  // pier into the stream
  b.rect(33, 25, 35, 27, T.BRIDGE);
  b.structure({ kind: 'pier', x: 33, z: 25, w: 2, d: 2, blocks: false });
  const pos: Record<string, [number, number]> = {
    shop: [13, 9], bakery: [19, 8], florist: [25, 9], workshop: [8, 15], market: [20, 28], houses: [7, 31],
    fishing_shop: [28, 24], stable: [39, 15], fountain: [22, 18], park: [4, 2],
  };
  for (const def of VILLAGE_BUILDINGS) {
    const [x, z] = pos[def.id];
    const [w, d] = def.size;
    b.structure({ kind: 'village', id: def.id, x, z, w, d, blocks: def.id !== 'park', params: { restored: st.village[def.id]?.restored } });
    b.anchor(def.anchor, x + w / 2, z + d + 0.9);
    b.anchor(`${def.id}_front`, x + w / 2, z + d + 0.9);
  }
  b.anchor('plaza', 24, 24.5);
  b.anchor('pier', 34, 26);
  b.anchor('park', 9, 9);
  b.anchor('farm_entry', 2.5, 20.5);
  b.anchor('coast_entry', 40.5, 39);
  b.anchor('ember_entry', 41.5, 3);
  b.anchor('moss_home', 9, 36.5);
  b.anchor('mallow_home', 12, 36.5);
  b.anchor('pippa_home', 15, 36.5);
  b.anchor('toma_home', 6, 24);
  b.anchor('brie_home', 18, 36);
  b.anchor('bibi_home', 28, 36);
  b.anchor('map_board', 29, 15.5);
  b.anchor('board', 18.5, 16);
  b.structure({ kind: 'request_board', id: 'board', x: 18, z: 14, w: 1, d: 1 });
  b.structure({ kind: 'signpost', x: 29, z: 14, w: 1, d: 1, params: { label: 'Carte de Bibi' } });
  treeEdge(b, ['oak', 'birch', 'oak'], [[0, 18, 3, 24], [38, 39, 45, 42], [39, 0, 46, 3]]);
  b.portal({ x0: 0, z0: 18, x1: 1, z1: 24, to: 'farm', anchor: 'village_entry', label: 'Green Valley' });
  b.portal({ x0: 38, z0: 41, x1: 45, z1: 42, to: 'coast', anchor: 'village_entry', label: 'Sunny Coast' });
  b.portal({ x0: 39, z0: 0, x1: 46, z1: 1, to: 'ember', anchor: 'village_entry', label: 'Ember Valley' });
  if (!st.regions.ember.unlocked) b.structure({ kind: 'lava_gate', x: 40, z: 1, w: 4, d: 1 });
  // lamp posts & benches (static decor)
  const lamps: [number, number][] = [[17, 18], [30.5, 18], [17, 23], [30.5, 23], [8, 21.5], [40, 25], [24, 30]];
  for (const [x, z] of lamps) b.prop('lamp_post', x + 0.5, z + 0.5, { rot: 0, blocks: true });
  b.prop('bench', 20.5, 25.5, { rot: 0, blocks: true });
  b.prop('bench', 27.5, 25.5, { rot: 0, blocks: true });
  b.prop('flowerbed_red', 18.5, 24.5, { rot: 0 });
  b.prop('flowerbed_yellow', 29.5, 24.5, { rot: 0 });
  b.prop('barrel', 12.5, 14.5, { blocks: true });
  b.prop('crates', 18.5, 13.5, { blocks: true });
  b.scatter(['tree_oak', 'tree_birch'], 8, 3, 25, 18, 40);
  b.scatter('forage', 8, 2, 2, 46, 40);
  b.scatter('bush_berry', 3, 38, 24, 46, 38);
  sprinkle(b, 'rocks_small', 8, 2, 2, 46, 40);
  return b.done({ hills: 0.12 });
}

export function buildWoods(seed: number): RegionLayout {
  const b = new LayoutBuilder('woods', 56, 52, seed, T.FOREST);
  b.L.grass = 0.9;
  b.L.flowers = [0xb08ae8, 0xffffff, 0x8ad8ff];
  b.L.skirt = [0x5fae5a, 0x7a5a3a, 0x5a4232, 0x4a3a38];
  b.rect(0, 0, 56, 5, T.ROCK);
  cliffRocks(b, 0.5);
  b.line([[10, 4], [14, 14], [26, 20], [38, 22], [57, 26]], 2.8, T.WATER, 0.25);
  b.circle(35, 41, 3.4, T.WATER);
  b.circle(20, 32, 4.5, T.GRASS);
  b.circle(12, 12, 4.2, T.GRASS);
  b.circle(45, 11, 3.2, T.GRASS);
  b.line([[49, 51], [44, 42], [32, 36], [21, 33]], 1.6, T.PATH, 0.2);
  b.line([[21, 30], [24, 22], [16, 15], [12, 13]], 1.4, T.PATH, 0.2);
  b.line([[38, 40], [36, 38]], 1.2, T.PATH, 0.2);
  // log bridge over the river on the path
  b.rect(22, 19, 26, 24, T.BRIDGE);
  b.structure({ kind: 'bridge', x: 22, z: 19, w: 4, d: 5, blocks: false, params: { span: 'z', log: true } });
  b.structure({ kind: 'tent', id: 'camp', x: 17, z: 29, w: 2, d: 2 });
  b.structure({ kind: 'campfire', x: 20, z: 32, w: 1, d: 1, blocks: true });
  b.anchor('camp', 21.5, 30.5);
  b.anchor('farm_entry', 48, 48.5);
  b.anchor('grove', 12, 14);
  b.anchor('secret', 45, 11);
  b.node('tree_giant', 12, 10.5);
  b.reserve(42, 7, 49, 15);
  treeEdge(b, ['pine', 'oak', 'pine'], [[46, 49, 51, 52]]);
  b.portal({ x0: 46, z0: 51, x1: 51, z1: 52, to: 'farm', anchor: 'woods_entry', label: 'Green Valley' });
  b.scatter(['tree_oak', 'tree_pine', 'tree_pine', 'tree_birch'], 110, 2, 5, 54, 50, [T.FOREST], 1);
  // the secret grove: a ring of trees with one narrow gap
  for (let a = 0; a < 26; a++) {
    const ang = (a / 26) * Math.PI * 2;
    if (ang > 1.9 && ang < 2.3) continue;
    b.prop('tree:pine', 45 + Math.sin(ang) * 4.6, 11 + Math.cos(ang) * 4.6, { blocks: true, scale: 1.2 });
  }
  b.L.props.push({ model: 'shroom_ring', x: 45, z: 11, rot: 0 });
  b.node('chest', 45, 9.5, { once: true });
  b.node('chest', 36, 46, { once: true });
  b.scatter('bush_berry', 12, 3, 6, 53, 49);
  b.scatter('forage', 26, 3, 6, 53, 49, [T.FOREST, T.GRASS]);
  b.scatter(['rock', 'rock_big'], 9, 3, 6, 53, 49);
  b.scatter('stump', 5, 3, 6, 53, 49);
  b.scatter('clay_spot', 3, 30, 36, 42, 46);
  sprinkle(b, 'mushrooms', 26, 3, 6, 53, 49, [T.FOREST]);
  sprinkle(b, 'fern', 50, 3, 6, 53, 49, [T.FOREST]);
  sprinkle(b, 'log_small', 6, 3, 6, 53, 49);
  b.L.props.push({ model: 'waterfall', x: 10.5, z: 4.6, rot: 0 });
  return b.done({ hills: 0.3, rockHeight: 3 });
}

export function buildMountains(seed: number, st: GameState): RegionLayout {
  const b = new LayoutBuilder('mountains', 52, 48, seed);
  b.L.grass = 0.45;
  b.L.flowers = [0xffffff, 0x8ab8ff, 0xb08ae8];
  b.L.skirt = [0x9ab87a, 0x8a8a98, 0x6a6a78, 0x5a5a68];
  b.border(T.ROCK, 3, [[25, 44, 31, 48], [49, 19, 52, 25]]);
  // ridges
  for (let x = 3; x < 49; x++) for (let z = 3; z < 45; z++) {
    const n = b.noise.fbm(x * 0.08, z * 0.08, 3);
    if (n > 0.66 && !(x > 22 && x < 34 && z > 4)) b.set(x, z, T.ROCK);
  }
  b.rect(3, 3, 49, 7, T.ROCK);
  b.circle(37, 29, 4.2, T.WATER);
  b.line([[37, 7], [37, 25]], 1.6, T.WATER, 0.1);
  b.line([[28, 46], [28, 30], [25, 18], [24.5, 8]], 1.8, T.PATH, 0.2);
  b.line([[28, 26], [40, 22], [51, 22]], 1.6, T.PATH, 0.2);
  b.rect(35, 20, 40, 24, T.BRIDGE);
  b.structure({ kind: 'bridge', x: 35, z: 20, w: 5, d: 4, blocks: false, params: { span: 'x', stone: true } });
  b.rect(22, 7, 28, 9, T.PATH);
  b.structure({ kind: 'mine_entrance', id: 'mine', x: 23, z: 5, w: 3, d: 2 });
  b.anchor('mine_door', 24.5, 8.4);
  b.anchor('farm_entry', 28, 44.5);
  b.anchor('frosty_entry', 48.5, 22);
  b.anchor('lake', 33, 29);
  b.portal({ x0: 25, z0: 47, x1: 31, z1: 48, to: 'farm', anchor: 'mountains_entry', label: 'Green Valley' });
  b.portal({ x0: 51, z0: 19, x1: 52, z1: 25, to: 'frosty', anchor: 'mountains_entry', label: 'Frosty Peaks' });
  if (!st.regions.frosty.unlocked) b.structure({ kind: 'ice_gate', x: 49, z: 20, w: 1, d: 4 });
  b.reserve(22, 7, 28, 10);
  b.scatter('tree_pine', 22, 3, 7, 49, 45, [T.GRASS], 1);
  b.scatter(['ore_copper', 'ore_copper', 'ore_coal', 'ore_iron'], 22, 3, 7, 49, 45, [T.GRASS], 1);
  b.scatter(['rock', 'rock', 'rock_big'], 16, 3, 7, 49, 45, [T.GRASS], 1);
  b.scatter('ore_crystal', 3, 30, 22, 45, 36, [T.GRASS], 1);
  b.scatter('geode_node', 2, 3, 7, 49, 45, [T.GRASS], 1);
  b.scatter('forage', 12, 3, 7, 49, 45, [T.GRASS]);
  b.node('chest', 41.5, 10.5, { once: true });
  b.L.props.push({ model: 'waterfall', x: 37, z: 7.2, rot: 0 });
  sprinkle(b, 'rocks_small', 20, 3, 7, 49, 45, [T.GRASS]);
  cliffRocks(b);
  return b.done({ hills: 0.35, rockHeight: 3.2 });
}

export function buildCoast(seed: number): RegionLayout {
  const b = new LayoutBuilder('coast', 56, 48, seed, T.SAND);
  b.L.grass = 0.4;
  b.L.flowers = [0xff5a8a, 0xffd03a, 0xffffff];
  b.L.skirt = [0xf4e0a8, 0xd8b880, 0xb89a6a, 0x8a7a6a];
  b.rect(0, 0, 56, 13, T.GRASS);
  for (let x = 0; x < 56; x++) {
    const shore = 34 + Math.sin(x * 0.18) * 2 + b.noise.get(x * 0.2, 3) * 2;
    for (let z = Math.floor(shore); z < 48; z++) b.set(x, z, z > shore + 4 ? T.DEEP : T.WATER);
  }
  for (let z = 0; z < 48; z++) {
    const shore = 47 + Math.sin(z * 0.2) * 1.5;
    for (let x = Math.floor(shore); x < 56; x++) b.set(x, z, x > shore + 3 ? T.DEEP : T.WATER);
  }
  b.circle(14, 43, 3.6, T.SAND, 0.15);
  b.line([[14, 33], [14, 41]], 2, T.SAND, 0.15);
  b.circle(40, 43, 3, T.SAND, 0.15);
  b.rect(39, 35, 42, 41, T.BRIDGE);
  b.structure({ kind: 'pier', id: 'island_pier', x: 39, z: 35, w: 3, d: 6, blocks: false });
  b.rect(27, 34, 29, 41, T.BRIDGE);
  b.structure({ kind: 'pier', id: 'pier', x: 27, z: 34, w: 2, d: 7, blocks: false });
  b.circle(22, 26, 1.4, T.WATER, 0.1);
  b.circle(33, 24, 1.1, T.WATER, 0.1);
  b.line([[0, 7], [16, 10], [28, 18], [28, 33]], 1.6, T.PATH, 0.2);
  b.structure({ kind: 'lighthouse', id: 'lighthouse', x: 48, z: 6, w: 3, d: 3 });
  b.structure({ kind: 'boat', x: 29, z: 39, w: 1, d: 2, blocks: true });
  b.anchor('village_entry', 3, 7.5);
  b.anchor('pier_end', 28, 40);
  b.anchor('beach', 22, 30);
  treeEdge(b, ['palm', 'oak'], [[0, 4, 3, 11], [0, 30, 56, 48], [44, 0, 56, 48]]);
  b.portal({ x0: 0, z0: 4, x1: 1, z1: 11, to: 'village', anchor: 'coast_entry', label: 'Willowbrook' });
  b.scatter('tree_palm', 16, 2, 10, 46, 32, [T.SAND, T.GRASS], 1);
  b.scatter(['tree_oak', 'tree_birch'], 8, 2, 2, 44, 12, [T.GRASS], 1);
  b.scatter('driftwood', 7, 2, 24, 46, 36, [T.SAND]);
  b.scatter('forage', 24, 2, 14, 46, 46, [T.SAND]);
  b.scatter('rock', 6, 2, 14, 46, 34, [T.SAND]);
  b.node('chest', 40, 43.5, { once: true });
  sprinkle(b, 'shells', 20, 2, 14, 46, 34, [T.SAND]);
  return b.done({ hills: 0.12 });
}

export function buildFrosty(seed: number): RegionLayout {
  const b = new LayoutBuilder('frosty', 48, 46, seed, T.SNOW);
  b.L.grass = 0.1;
  b.L.flowers = [0xcfe8ff, 0xffffff];
  b.L.skirt = [0xf0f6ff, 0xa8b8d0, 0x8a9ab8, 0x6a7a98];
  b.L.seasonal = false;
  b.border(T.ROCK, 3, [[0, 19, 3, 25]]);
  for (let x = 3; x < 45; x++) for (let z = 3; z < 43; z++) if (b.noise.fbm(x * 0.1, z * 0.1, 3) > 0.68) b.set(x, z, T.ROCK);
  b.circle(23, 21, 6.5, T.ICE, 0.1);
  b.circle(23, 21, 1.4, T.WATER, 0);
  b.line([[-1, 22], [10, 22], [16, 21]], 1.8, T.PATH, 0.2);
  b.circle(36, 8, 3, T.SNOW);
  b.anchor('mountains_entry', 3.5, 22);
  b.anchor('lake', 21, 21);
  b.anchor('peak', 36, 8);
  b.portal({ x0: 0, z0: 19, x1: 1, z1: 25, to: 'mountains', anchor: 'frosty_entry', label: 'Crystal Mountains' });
  b.structure({ kind: 'igloo', id: 'igloo', x: 9, z: 30, w: 3, d: 3 });
  b.scatter('tree_snow', 30, 3, 3, 45, 43, [T.SNOW], 1);
  b.scatter(['ore_frost', 'ore_frost', 'ore_iron', 'ore_crystal'], 14, 3, 3, 45, 43, [T.SNOW], 1);
  b.scatter('bush_snow', 8, 3, 3, 45, 43, [T.SNOW]);
  b.scatter('forage', 14, 3, 3, 45, 43, [T.SNOW]);
  b.scatter('rock', 8, 3, 3, 45, 43, [T.SNOW]);
  b.node('chest', 36, 6.5, { once: true });
  sprinkle(b, 'ice_shards', 14, 3, 3, 45, 43, [T.SNOW]);
  cliffRocks(b);
  return b.done({ hills: 0.3, rockHeight: 3.5 });
}

export function buildEmber(seed: number): RegionLayout {
  const b = new LayoutBuilder('ember', 48, 46, seed, T.ASH);
  b.L.grass = 0.05;
  b.L.flowers = [0xff8a3a, 0xffd03a];
  b.L.skirt = [0x8a6a5a, 0x5a4040, 0x3a2a2a, 0x2a1e1e];
  b.L.seasonal = false;
  b.border(T.ROCK, 3, [[0, 37, 3, 44]]);
  b.circle(24, 8, 6.5, T.ROCK, 0.1);
  b.circle(24, 8, 2, T.LAVA, 0);
  b.line([[24, 12], [27, 22], [22, 32], [30, 46]], 2.4, T.LAVA, 0.25);
  b.rect(24, 21, 31, 24, T.BRIDGE);
  b.structure({ kind: 'bridge', x: 24, z: 21, w: 7, d: 3, blocks: false, params: { span: 'x', stone: true, dark: true } });
  b.circle(39, 35, 2.4, T.WATER, 0.1);
  b.line([[-1, 40.5], [14, 36], [26, 22.5], [36, 18]], 1.6, T.PATH, 0.2);
  b.anchor('village_entry', 3.5, 40.5);
  b.anchor('spring', 37, 33);
  b.anchor('volcano', 24, 15);
  b.portal({ x0: 0, z0: 37, x1: 1, z1: 44, to: 'village', anchor: 'ember_entry', label: 'Willowbrook' });
  b.scatter('tree_ash', 14, 3, 3, 45, 43, [T.ASH], 1);
  b.scatter(['ore_ember', 'ore_ember', 'ore_gold', 'ore_coal'], 18, 3, 3, 45, 43, [T.ASH], 1);
  b.scatter('rock', 10, 3, 3, 45, 43, [T.ASH], 1);
  b.scatter('forage', 12, 3, 3, 45, 43, [T.ASH]);
  b.node('chest', 41, 6, { once: true });
  sprinkle(b, 'ember_rocks', 20, 3, 3, 45, 43, [T.ASH]);
  cliffRocks(b);
  return b.done({ hills: 0.25, rockHeight: 3.8 });
}

export function buildMine(seed: number, floor: MineFloor): RegionLayout {
  const b = new LayoutBuilder('mine', MINE_SIZE, MINE_SIZE, seed ^ (floor.floor * 977), T.FLOOR);
  b.L.grass = 0;
  b.L.indoor = true;
  b.L.seasonal = false;
  b.L.skirt = [0x5a4a48, 0x4a3a38, 0x3a2a28, 0x2a1e1e];
  b.border(T.ROCK, 2);
  for (let x = 2; x < MINE_SIZE - 2; x++) for (let z = 2; z < MINE_SIZE - 2; z++) {
    if (b.noise.fbm(x * 0.2, z * 0.2, 2) > 0.78 && Math.hypot(x - floor.spawn.x, z - floor.spawn.z) > 3) b.set(x, z, T.ROCK);
  }
  if (floor.pool) b.circle(floor.pool.x + 0.5, floor.pool.z + 0.5, 1.6, T.WATER, 0);
  b.reserve(floor.spawn.x - 1, floor.spawn.z - 1, floor.spawn.x + 2, floor.spawn.z + 3);
  for (const r of floor.rocks) {
    const tx = Math.floor(r.x), tz = Math.floor(r.z);
    if (b.get(tx, tz) !== T.FLOOR) b.set(tx, tz, T.FLOOR);
    b.L.nodes.push({ id: r.id, kind: r.kind, region: 'mine', x: r.x, z: r.z, variant: tx + tz, transient: true });
  }
  if (floor.chest) {
    b.set(Math.floor(floor.chest.x), Math.floor(floor.chest.z), T.FLOOR);
    b.L.nodes.push({ id: `mchest_${floor.floor}`, kind: 'chest', region: 'mine', x: floor.chest.x, z: floor.chest.z, transient: true });
  }
  b.anchor('entry', floor.spawn.x + 0.5, floor.spawn.z + 0.5);
  b.anchor('ladder_up', floor.exitUp.x + 0.5, floor.exitUp.z);
  if (floor.floor % 5 === 0) b.anchor('elevator', 16.5, 17.5);
  if (floor.shrine) b.structure({ kind: 'shrine', id: 'shrine', x: 4, z: 15, w: 1, d: 1 });
  cliffRocks(b, 0.3);
  sprinkle(b, floor.theme === 'crystal' ? 'crystals_small' : floor.theme === 'frost' ? 'ice_shards' : floor.theme === 'ember' ? 'ember_rocks' : 'rocks_small', 16, 2, 2, MINE_SIZE - 2, MINE_SIZE - 2, [T.FLOOR]);
  return b.done({ hills: 0.05, rockHeight: 2.6 });
}

export function buildHouse(seed: number): RegionLayout {
  const b = new LayoutBuilder('house', HOUSE_W, HOUSE_D, seed, T.FLOOR);
  b.L.grass = 0;
  b.L.indoor = true;
  b.L.seasonal = false;
  b.L.skirt = [0xc8925a, 0x9a6a42, 0x7a5232, 0x5a4a48];
  b.border(T.VOID, 1);
  b.anchor('door', 20.5, 6.5);
  b.anchor('bed', 3, 4);
  return b.done({ hills: 0 });
}

export function buildHamlet(seed: number, st: GameState): RegionLayout {
  const b = new LayoutBuilder('hamlet', 54, 48, seed);
  const A = HAMLET_AREA;
  b.L.grass = 0.7;
  b.L.flowers = [0xffffff, 0xffd03a, 0xb08ae8, 0xff8ab8, 0x8ad8ff];
  // stream along the east edge and a pond in the south-west woods
  b.line([[49, -1], [48, 12], [50, 26], [48.5, 38], [49.5, 49]], 2.6, T.WATER, 0.25);
  b.circle(9, 43.5, 2.8, T.WATER);
  // trail from the farm down to the founding stone
  b.line([[27, -1], [27, 8], [26, 15]], 1.6, T.PATH, 0.15);
  b.circle(26, 19, 2.6, T.PLAZA, 0.08);
  b.rect(46, 20, 52, 23, T.BRIDGE);
  b.structure({ kind: 'bridge', x: 46, z: 20, w: 6, d: 3, blocks: false, params: { span: 'x' } });
  b.structure({ kind: 'hamlet_board', id: 'register', x: 25, z: 17, w: 1, d: 1 });
  b.structure({ kind: 'campfire', x: 27, z: 20, w: 1, d: 1, blocks: true });
  b.structure({ kind: 'tent', id: 'traveller_tent', x: 22, z: 19, w: 2, d: 2 });
  b.structure({ kind: 'signpost', x: 29, z: 5, w: 1, d: 1, params: { label: 'Clairefontaine' } });
  b.anchor('farm_entry', 27, 3.5);
  b.anchor('spawn', 27, 3.5);
  b.anchor('plaza', 26, 22.5);
  b.anchor('register', 25.5, 18.6);
  b.reserve(21, 15, 31, 25);
  treeEdge(b, ['oak', 'birch', 'pine', 'oak'], [[24, 0, 30, 3]]);
  b.portal({ x0: 24, z0: 0, x1: 30, z1: 1, to: 'farm', anchor: 'hamlet_entry', label: 'Green Valley' });
  // the clearing is overgrown: trees, rocks and weeds to clear (they don't come back)
  const clutter = (kind: string, n: number) => {
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 40) {
      tries++;
      const x = b.r.int(A.minX, A.maxX - 1), z = b.r.int(A.minZ, A.maxZ - 1);
      if (!b.free(x, z, [T.GRASS])) continue;
      if (st.hamlet.placed.some((p) => x >= p.x - 1 && z >= p.z - 1 && x < p.x + 5 && z < p.z + 5)) continue;
      b.node(kind, x + 0.5, z + 0.5, { once: true });
      placed++;
    }
  };
  clutter('weeds', 26);
  clutter('rock', 12);
  clutter('tree_oak', 8);
  clutter('tree_birch', 5);
  clutter('stump', 4);
  // wild woods around the clearing
  b.scatter(['tree_oak', 'tree_pine', 'tree_birch'], 14, 2, A.maxZ, 46, 46, [T.GRASS], 1);
  b.scatter(['tree_oak', 'tree_pine'], 8, 2, 2, A.minX, 40, [T.GRASS], 1);
  b.scatter('bush_berry', 5, 2, 2, 52, 46);
  b.scatter('forage', 10, 2, 2, 52, 46);
  b.scatter(['rock', 'ore_copper'], 4, 2, A.maxZ, 46, 46, [T.GRASS], 1);
  b.scatter('clay_spot', 2, 2, 40, 20, 46);
  sprinkle(b, 'rocks_small', 10, 2, 2, 52, 46);
  sprinkle(b, 'log_small', 4, 2, 40, 50, 46);
  b.L.props.push({ model: 'lantern_pole', x: 28.5, z: 16.5, rot: 0, blocks: true });
  b.L.props.push({ model: 'log_pile', x: 23.5, z: 22.5, rot: 0.3 });
  return b.done({ hills: 0.18 });
}

export function buildRegion(id: RegionId, st: GameState, mineFloor?: MineFloor): RegionLayout {
  const seed = st.seed;
  switch (id) {
    case 'farm': return buildFarm(seed, st);
    case 'village': return buildVillage(seed, st);
    case 'woods': return buildWoods(seed);
    case 'mountains': return buildMountains(seed, st);
    case 'coast': return buildCoast(seed);
    case 'frosty': return buildFrosty(seed);
    case 'ember': return buildEmber(seed);
    case 'mine': return buildMine(seed, mineFloor!);
    case 'house': return buildHouse(seed);
    case 'hamlet': return buildHamlet(seed, st);
  }
}
