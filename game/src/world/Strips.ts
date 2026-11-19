import type { GameState, RegionId } from '../state/types';
import { LayoutBuilder, T, WALKABLE, type RegionLayout, type Tile } from './Layout';
import { Random, hashString } from '../core/Random';
import { WORLD_NOISE } from './Terrain';
import { WORLD_LAYOUT, isOpenWorld, regionAt } from './WorldMap';

/**
 * Open-world road strips. A region's layout is grown to the east/south (local
 * coordinates of everything already there never change) and the new land is
 * filled with the road to the neighbouring region plus things to find along the
 * way: orchards, a windmill, camps, ponds, ruins, chests and hidden spots.
 */

type Pt = [number, number];
type R4 = [number, number, number, number];

interface StripCtx {
  b: LayoutBuilder;
  w0: number; // original size
  d0: number;
  W: number; // new size
  D: number;
  st: GameState;
}

/** A tree/rock band along the outer edges of the new land, with openings. */
function outerBand(c: StripCtx, gaps: R4[], kinds: string[], opts: { rock?: boolean; thickness?: number } = {}): void {
  const { b, w0, d0, W, D } = c;
  const th = opts.thickness ?? 2;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    if (x < w0 && z < d0) continue; // original land keeps its own border
    const edge = x < th || z < th || x >= W - th || z >= D - th;
    if (!edge || gaps.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1)) continue;
    if (opts.rock) {
      b.set(x, z, T.ROCK);
      continue;
    }
    if (!b.isReserved(x, z) && ((x + z * 3) % 2 === 0 || b.r.chance(0.5))) {
      b.prop(`tree:${b.r.pick(kinds)}`, x + 0.5 + b.r.range(-0.2, 0.2), z + 0.5 + b.r.range(-0.2, 0.2), { blocks: true, scale: b.r.range(0.95, 1.35) });
    }
    b.L.props.push({ model: 'none', x: x + 0.5, z: z + 0.5, blocks: true });
    b.reserve(x, z, x + 1, z + 1);
  }
}

/** Close an old opening of the original border (a road that now leads nowhere). */
function closeGap(c: StripCtx, [x0, z0, x1, z1]: R4, kinds: string[]): void {
  const { b } = c;
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
    if ((x + z) % 2 === 0) b.L.props.push({ model: `tree:${b.r.pick(kinds)}`, x: x + 0.5, z: z + 0.5, rot: b.r.range(0, 6.28), scale: b.r.range(1, 1.3), blocks: true });
    b.L.props.push({ model: 'none', x: x + 0.5, z: z + 0.5, blocks: true });
  }
  b.L.portals = b.L.portals.filter((p) => !(p.x0 < x1 && p.x1 > x0 && p.z0 < z1 && p.z1 > z0));
}

function road(c: StripCtx, pts: Pt[], width = 1.7, tile: Tile = T.PATH): void {
  c.b.line(pts, width, tile, 0.12);
}

/** Lanterns every few metres on alternating sides of a road. */
function lanterns(c: StripCtx, pts: Pt[], every = 5, model = 'lantern_pole', side = 1.5): void {
  const { b } = c;
  let carry = every * 0.5, flip = 1;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let s = carry; s < len; s += every) {
      const x = ax + (bx - ax) * (s / len) + nx * side * flip, z = az + (bz - az) * (s / len) + nz * side * flip;
      flip = -flip;
      if (x < c.w0 && z < c.d0) continue;
      if (b.free(Math.floor(x), Math.floor(z))) b.prop(model, x, z, { rot: 0, blocks: true });
    }
    carry = (carry - len) % every;
    if (carry < 0) carry += every;
  }
}

function sprinkle(c: StripCtx, model: string, count: number, r: R4, allowed?: number[]): void {
  const { b } = c;
  const [x0, z0, x1, z1] = r;
  for (let i = 0; i < count; i++) {
    const x = b.r.range(x0, x1), z = b.r.range(z0, z1);
    if (b.free(Math.floor(x), Math.floor(z), allowed)) b.prop(model, x, z, { scale: b.r.range(0.8, 1.2) });
  }
}

function place(c: StripCtx, model: string, x: number, z: number, rot = 0, blocks = true): void {
  if (c.b.free(Math.floor(x), Math.floor(z))) c.b.prop(model, x, z, { rot, blocks });
}

function spot(c: StripCtx, id: string, x: number, z: number, label: string, icon: string, kind: 'secret' | 'lookout' = 'secret'): void {
  (c.b.L.spots ??= []).push({ id, kind, x, z, label, icon });
}

/** Common nature fill for a strip area. */
function nature(c: StripCtx, r: R4, o: { trees?: string[]; nTrees?: number; rocks?: number; berries?: number; forage?: number; flowers?: number; allowed?: number[] } = {}): void {
  const { b } = c;
  const [x0, z0, x1, z1] = r;
  b.scatter(o.trees ?? ['tree_oak', 'tree_birch', 'tree_oak', 'tree_pine'], o.nTrees ?? 10, x0, z0, x1, z1, o.allowed, 1);
  b.scatter(['rock', 'rock', 'rock_big'], o.rocks ?? 4, x0, z0, x1, z1, o.allowed, 1);
  b.scatter('bush_berry', o.berries ?? 3, x0, z0, x1, z1, o.allowed);
  b.scatter('forage', o.forage ?? 6, x0, z0, x1, z1, o.allowed);
  sprinkle(c, 'wildflowers', o.flowers ?? 26, r, [T.GRASS]);
  sprinkle(c, 'tall_grass', Math.round((o.flowers ?? 26) * 0.7), r, [T.GRASS]);
  sprinkle(c, 'rocks_small', 6, r);
}

// ------------------------------------------------------------------ regions

const STRIPS: Partial<Record<RegionId, (c: StripCtx) => void>> = {
  farm(c) {
    const { b } = c;
    // east road to Willowbrook, south road to Clairefontaine
    const east: Pt[] = [[50, 24], [55, 24], [59, 23.2], [63, 24], [67, 24]];
    const south: Pt[] = [[23.5, 45], [24, 50], [26, 53.5], [27, 59]];
    road(c, east);
    road(c, south, 1.6);
    outerBand(c, [[62, 21, 66, 27], [24, 54, 30, 58]], ['oak', 'birch', 'oak', 'pine']);
    lanterns(c, east, 5.5);
    lanterns(c, south, 5);
    b.structure({ kind: 'signpost', x: 61, z: 21, w: 1, d: 1, params: { label: 'Willowbrook' } });
    b.structure({ kind: 'signpost', x: 28, z: 51, w: 1, d: 1, params: { label: 'Clairefontaine' } });
    // the old windmill on the hill, with hay and a cart
    b.structure({ kind: 'windmill', x: 56, z: 31, w: 4, d: 4 });
    for (const [x, z] of [[54.5, 37], [55.8, 37.6], [61, 33.5]] as Pt[]) place(c, 'hay_bale', x, z, b.r.range(0, 3));
    place(c, 'cart', 61.5, 36.5, 0.6);
    place(c, 'scarecrow', 58, 40, 0);
    spot(c, 'farm_windmill', 58, 35.6, 'Moulin de la colline', '🌾');
    // blossom orchard north of the road, a little pond and a well
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) place(c, 'blossom_tree', 54 + i * 2.6, 5 + j * 3 + (i % 2) * 0.8, b.r.range(0, 6));
    b.circle(60.5, 15.5, 2.2, T.WATER, 0.2);
    place(c, 'lily_pond', 57.2, 13.2, 0, false);
    place(c, 'well', 55, 18, 0);
    place(c, 'bench', 58, 18.6, 0);
    // picnic meadow along the south road, sunflowers and a traveller camp
    place(c, 'picnic_table', 33.5, 51, 0.2);
    place(c, 'parasol', 35, 50.2, 0, false);
    for (let i = 0; i < 4; i++) place(c, 'sunflower_row', 8 + i * 2.2, 50.5, 0, false);
    place(c, 'fence_wood', 6.5, 49, 0);
    b.structure({ kind: 'campfire', x: 44, z: 51, w: 1, d: 1, blocks: true });
    place(c, 'log_pile', 46.2, 50.5, 0.4);
    place(c, 'stump_seat', 43.2, 53, 0);
    place(c, 'stump_seat', 45.6, 53.2, 0);
    b.circle(14.5, 54, 1.8, T.WATER, 0.2);
    b.node('chest', 63, 45, { once: true });
    b.node('chest', 3.5, 55, { once: true });
    nature(c, [53, 3, 63, 55], { nTrees: 14, rocks: 5, berries: 4, forage: 8, flowers: 40 });
    nature(c, [3, 47, 62, 56], { nTrees: 12, rocks: 5, berries: 4, forage: 8, flowers: 40 });
    b.scatter(['ore_copper', 'clay_spot'], 3, 53, 40, 63, 55);
  },

  village(c) {
    const { b } = c;
    // the old north road to Ember Valley now leaves eastwards
    closeGap(c, [39, 0, 46, 3], ['oak', 'birch']);
    b.L.structures = b.L.structures.filter((s) => s.kind !== 'lava_gate');
    const east: Pt[] = [[40, 20.5], [48, 20.5], [53, 22.5], [56, 27.5], [61, 27.5]];
    const south: Pt[] = [[41, 40], [41.5, 46], [45, 50.5], [52, 50.5], [61, 50.5]];
    road(c, east, 1.8);
    road(c, south, 1.8);
    outerBand(c, [[56, 24, 60, 31], [56, 47, 60, 54]], ['oak', 'birch', 'oak']);
    lanterns(c, east, 5, 'lamp_post');
    lanterns(c, south, 5, 'lamp_post');
    b.structure({ kind: 'signpost', x: 55, z: 24, w: 1, d: 1, params: { label: 'Ember Valley' } });
    b.structure({ kind: 'signpost', x: 54, z: 48, w: 1, d: 1, params: { label: 'Sunny Coast' } });
    b.anchor('ember_entry', 57, 27.5);
    b.anchor('coast_entry', 57, 50.5);
    // roadside market and a lookout tower over the valley
    for (const [m, x, z] of [['crates', 50.5, 8], ['barrel', 52, 7.4], ['cart', 53.6, 9.2], ['crates', 51.2, 10.4]] as [string, number, number][]) place(c, m, x, z, b.r.range(0, 3));
    place(c, 'string_lights', 52, 12, 0, false);
    place(c, 'flag_garland', 50, 14, 0, false);
    b.structure({ kind: 'lookout', x: 51, z: 36, w: 3, d: 3 });
    spot(c, 'village_lookout', 52.5, 39.6, 'Belvédère de Willowbrook', '🔭', 'lookout');
    // seaside meadow towards the coast: sand, palms and beach chairs
    for (let x = 44; x < 55; x++) for (let z = 43; z < 56; z++) if (b.get(x, z) === T.GRASS && b.noise.get(x * 0.3, z * 0.3) + Math.min(x - 44, 55 - x) * 0.09 > 0.9) b.set(x, z, T.SAND); // a sandy dip that stays clear of the border
    for (const [x, z] of [[50, 54.5], [55.5, 45], [47, 55]] as Pt[]) place(c, 'palm', x, z, b.r.range(0, 6));
    place(c, 'beach_chair', 53, 54.4, 0.3);
    // a duck pond with benches south of the market
    b.circle(14, 50, 3, T.WATER, 0.25);
    place(c, 'bench', 9.5, 50, Math.PI / 2);
    place(c, 'bench', 18.6, 50, -Math.PI / 2);
    place(c, 'flowerbed_purple', 14, 46, 0, false);
    place(c, 'well', 28, 47.5, 0);
    place(c, 'birdhouse', 31, 48.5, 0);
    b.node('chest', 58, 4, { once: true });
    b.node('chest', 4, 55.5, { once: true });
    nature(c, [49, 3, 57, 45], { nTrees: 10, rocks: 3, berries: 3, forage: 6, flowers: 30 });
    nature(c, [3, 43, 57, 56], { nTrees: 14, rocks: 4, berries: 4, forage: 8, flowers: 40, allowed: [T.GRASS] });
  },

  highlands(c) {
    const { b } = c;
    const east: Pt[] = [[118, 54], [124, 54], [127, 45], [129, 35], [133, 28.5]];
    road(c, east, 1.7);
    outerBand(c, [[128, 26, 132, 31]], ['oak', 'pine', 'birch']);
    lanterns(c, east, 6, 'torch');
    b.structure({ kind: 'signpost', x: 127, z: 31, w: 1, d: 1, params: { label: 'Green Valley' } });
    // a drover's rest: tent, campfire, hay
    place(c, 'crates', 122.5, 38.5, 0.3);
    place(c, 'barrel', 123.6, 38.2, 0);
    b.structure({ kind: 'campfire', x: 124, z: 42, w: 1, d: 1, blocks: true });
    place(c, 'hay_bale', 121.5, 43, 0.4);
    place(c, 'log_pile', 125.8, 39.5, 1.2);
    // standing stones on a knoll
    for (let a = 0; a < 7; a++) place(c, 'standing_stone', 126 + Math.sin(a * 0.9) * 2.4, 78 + Math.cos(a * 0.9) * 2.4, a);
    spot(c, 'hl_knoll', 126, 78, 'Pierres du tertre', '🗿');
    b.circle(125, 95, 2.6, T.WATER, 0.2);
    b.node('chest', 129.5, 100, { once: true });
    nature(c, [120, 3, 130, 105], { trees: ['tree_oak', 'tree_pine', 'tree_birch'], nTrees: 26, rocks: 8, berries: 5, forage: 12, flowers: 50 });
    b.scatter(['ore_copper', 'ore_iron', 'ore_coal'], 5, 120, 3, 130, 105);
  },

  woods(c) {
    const { b } = c;
    const south: Pt[] = [[48.5, 50], [49, 56], [50, 60], [50, 65]];
    road(c, south, 1.6);
    outerBand(c, [[48, 60, 52, 64]], ['pine', 'oak', 'pine']);
    lanterns(c, south, 4.5, 'glow_shrooms', 1.4);
    b.structure({ kind: 'signpost', x: 52, z: 57, w: 1, d: 1, params: { label: 'Green Valley' } });
    // fairy clearing and a woodcutter's corner
    b.circle(20, 57, 3.6, T.GRASS, 0.2);
    place(c, 'fairy_ring', 20, 57, 0, false);
    for (let a = 0; a < 6; a++) place(c, 'glow_shrooms', 20 + Math.sin(a) * 3.2, 57 + Math.cos(a) * 3.2, a, false);
    spot(c, 'woods_fairy', 20, 57, 'Clairière des fées', '🧚');
    place(c, 'log_pile', 37, 56, 0.3);
    place(c, 'log_pile', 39, 57.4, 1.1);
    place(c, 'stump_seat', 36, 59, 0);
    b.node('stump', 41, 55);
    b.circle(8, 58, 2.4, T.WATER, 0.25);
    b.node('chest', 4, 61, { once: true });
    nature(c, [3, 53, 53, 61], { trees: ['tree_pine', 'tree_oak', 'tree_pine', 'tree_birch'], nTrees: 28, rocks: 4, berries: 5, forage: 12, flowers: 10, allowed: [T.FOREST, T.GRASS] });
    sprinkle(c, 'mushrooms', 20, [3, 53, 53, 61], [T.FOREST]);
    sprinkle(c, 'fern', 30, [3, 53, 53, 61], [T.FOREST]);
  },

  mountains(c) {
    const { b } = c;
    const south: Pt[] = [[28, 46], [27, 52], [18, 55.5], [12.5, 61]];
    const east: Pt[] = [[50, 22], [58, 22], [65, 22]];
    road(c, south, 1.8);
    road(c, east, 1.8);
    outerBand(c, [[10, 55, 15, 60], [59, 19, 64, 25]], [], { rock: true, thickness: 3 });
    lanterns(c, south, 6, 'torch');
    lanterns(c, east, 6, 'torch');
    b.structure({ kind: 'signpost', x: 15, z: 56, w: 1, d: 1, params: { label: 'Green Valley' } });
    b.structure({ kind: 'signpost', x: 58, z: 19, w: 1, d: 1, params: { label: 'Frosty Peaks' } });
    // rocky outcrops, an alpine tarn and a ruined watchtower
    for (let i = 0; i < 6; i++) {
      const x = b.r.range(54, 61), z = b.r.range(4, 16);
      if (b.free(Math.floor(x), Math.floor(z))) b.circle(x, z, b.r.range(0.8, 1.6), T.ROCK, 0.3);
    }
    b.circle(57, 43, 3, T.WATER, 0.25);
    b.structure({ kind: 'ruin_tower', x: 41, z: 51, w: 3, d: 3 });
    spot(c, 'mt_ruin', 42.5, 54.6, 'Tour du col', '🏰');
    for (let a = 0; a < 5; a++) place(c, 'standing_stone', 6 + a * 1.6, 52 + (a % 2) * 1.2, a);
    b.node('chest', 61, 55, { once: true });
    b.node('chest', 56, 9, { once: true });
    nature(c, [53, 4, 61, 56], { trees: ['tree_pine', 'tree_pine', 'tree_birch'], nTrees: 12, rocks: 8, berries: 2, forage: 6, flowers: 24 });
    nature(c, [4, 49, 57, 56], { trees: ['tree_pine', 'tree_pine', 'tree_birch'], nTrees: 12, rocks: 8, berries: 2, forage: 6, flowers: 24 });
    b.scatter(['ore_copper', 'ore_iron', 'ore_coal', 'ore_iron'], 10, 4, 4, 61, 56, [T.GRASS], 1);
    b.scatter('geode_node', 2, 4, 4, 61, 56, [T.GRASS], 1);
    sprinkle(c, 'cliff_rock', 14, [4, 4, 61, 57]);
  },
};

/** Extra life sprinkled into the original land of every open region. */
const EXTRAS: Partial<Record<RegionId, (c: StripCtx) => void>> = {
  coast(c) {
    nature(c, [3, 3, c.w0 - 3, c.d0 - 3], { trees: ['tree_palm', 'tree_oak'], nTrees: 6, rocks: 3, berries: 0, forage: 8, flowers: 0, allowed: [T.GRASS, T.SAND] });
    sprinkle(c, 'shells', 30, [3, 3, c.w0 - 3, c.d0 - 3], [T.SAND]);
  },
  frosty(c) {
    sprinkle(c, 'ice_shards', 24, [3, 3, c.w0 - 3, c.d0 - 3], [T.SNOW]);
    c.b.scatter(['tree_snow', 'rock'], 8, 3, 3, c.w0 - 3, c.d0 - 3, [T.SNOW], 1);
  },
  ember(c) {
    sprinkle(c, 'ember_rocks', 30, [3, 3, c.w0 - 3, c.d0 - 3], [T.ASH]);
  },
  hamlet(c) {
    sprinkle(c, 'wildflowers', 30, [3, 3, c.w0 - 3, c.d0 - 3], [T.GRASS]);
    c.b.scatter('bush_berry', 3, 3, 3, c.w0 - 3, c.d0 - 3, [T.GRASS]);
  },
};

/** Grow an outdoor region with its road strips (no-op for indoor regions). */
export function expandLayout(L: RegionLayout, seed: number, st: GameState): RegionLayout {
  if (!isOpenWorld(L.id) || L.indoor) return L;
  const p = WORLD_LAYOUT[L.id]!;
  const w0 = L.w, d0 = L.d;
  const W = w0 + p.addE, D = d0 + p.addS;
  const base: Tile = L.id === 'woods' ? T.FOREST : T.GRASS;
  const b = new LayoutBuilder(L.id, W, D, seed, base);
  b.r = new Random((seed ^ hashString(L.id + ':strip')) >>> 0);
  const N = b.L;
  for (let z = 0; z < d0; z++) for (let x = 0; x < w0; x++) {
    N.tiles[z * W + x] = L.tiles[z * w0 + x];
  }
  N.props = L.props;
  N.nodes = L.nodes;
  N.structures = L.structures;
  N.anchors = L.anchors;
  // walking across region borders replaces the old travel portals
  N.portals = L.portals.filter((q) => !isOpenWorld(q.to));
  // same grass density on both sides of a border (meadow regions)
  N.grass = ['farm', 'village', 'hamlet', 'highlands', 'coast'].includes(L.id) ? Math.max(L.grass, 0.7) : L.grass;
  N.flowers = L.flowers;
  N.skirt = L.skirt;
  N.waterLevel = L.waterLevel;
  N.seasonal = L.seasonal;
  N.spots = L.spots;
  b.reserve(0, 0, w0, d0);
  const before = N.tiles.slice();
  const c: StripCtx = { b, w0, d0, W, D, st };
  STRIPS[L.id]?.(c);
  // extras in the original land use free tiles only
  if (EXTRAS[L.id]) {
    unreserveOriginal(b, L);
    EXTRAS[L.id]!(c);
  }
  // tiles of the original land that a road or a closed gap changed
  const changed = new Uint8Array(W * D);
  for (let z = 0; z < d0; z++) for (let x = 0; x < w0; x++) {
    const i = z * W + x;
    if (N.tiles[i] !== before[i]) changed[i] = 1;
  }
  // nothing may stand on the new road through the old border
  const onChangedRoad = (x: number, z: number) => {
    const tx = Math.floor(x), tz = Math.floor(z);
    if (tx < 0 || tz < 0 || tx >= W || tz >= D) return false;
    const i = tz * W + tx;
    return changed[i] === 1 && WALKABLE[N.tiles[i]];
  };
  N.props = N.props.filter((q) => !onChangedRoad(q.x, q.z));
  N.nodes = N.nodes.filter((n) => !onChangedRoad(n.x, n.z));
  b.done({ hills: L.id === 'highlands' ? 0.85 : L.id === 'mountains' ? 0.35 : 0.25, rockHeight: L.id === 'mountains' ? 3.2 : 2.6 });
  // the original land keeps its exact heights and collisions
  for (let z = 0; z < d0; z++) for (let x = 0; x < w0; x++) {
    const i = z * W + x;
    if (changed[i]) continue;
    N.heights[i] = L.heights[z * w0 + x];
    N.blocked[i] = L.blocked[z * w0 + x];
  }
  // re-apply blockers that live in the original land but were added here (closed gaps)
  for (const q of N.props) if (q.blocks) {
    const tx = Math.floor(q.x), tz = Math.floor(q.z);
    if (tx >= 0 && tz >= 0 && tx < W && tz < D) N.blocked[tz * W + tx] = 1;
  }
  seamHeights(N);
  N.exits = computeExits(N);
  return N;
}

/** Height both neighbours agree on along a border (low-frequency world noise). */
function seamH(gx: number, gz: number): number {
  return (WORLD_NOISE.get(gx * 0.07 + 300, gz * 0.07) - 0.5) * 0.18;
}

/**
 * Ease the last tiles of every border towards the shared seam height so the
 * ground of two touching regions meets without a step.
 */
function seamHeights(L: RegionLayout): void {
  const p = WORLD_LAYOUT[L.id]!;
  const BAND = 3;
  for (let z = 0; z < L.d; z++) for (let x = 0; x < L.w; x++) {
    const dEdge = Math.min(x, z, L.w - 1 - x, L.d - 1 - z);
    if (dEdge >= BAND) continue;
    const i = z * L.w + x;
    const t = L.tiles[i];
    if (t === T.ROCK || t === T.WATER || t === T.DEEP || t === T.LAVA || t === T.BRIDGE) continue;
    const k = 1 - dEdge / BAND;
    L.heights[i] += (seamH(p.ox + x + 0.5, p.oz + z + 0.5) - L.heights[i]) * k * k;
  }
}

/** Walkable border tiles that lead into another region, averaged per neighbour. */
function computeExits(L: RegionLayout): { to: RegionId; x: number; z: number }[] {
  const p = WORLD_LAYOUT[L.id]!;
  const acc = new Map<RegionId, { x: number; z: number; n: number }>();
  const test = (x: number, z: number, dx: number, dz: number) => {
    const i = z * L.w + x;
    if (!WALKABLE[L.tiles[i]] || L.blocked[i]) return;
    const to = regionAt(p.ox + x + 0.5 + dx, p.oz + z + 0.5 + dz);
    if (!to || to === L.id) return;
    const a = acc.get(to) ?? { x: 0, z: 0, n: 0 };
    a.x += x + 0.5; a.z += z + 0.5; a.n++;
    acc.set(to, a);
  };
  for (let x = 0; x < L.w; x++) { test(x, 0, 0, -1); test(x, L.d - 1, 0, 1); }
  for (let z = 0; z < L.d; z++) { test(0, z, -1, 0); test(L.w - 1, z, 1, 0); }
  return [...acc].map(([to, a]) => ({ to, x: a.x / a.n, z: a.z / a.n }));
}

/** Let the extras use free tiles of the original land (minus anything already there). */
function unreserveOriginal(b: LayoutBuilder, L: RegionLayout): void {
  b.clearReserved(0, 0, L.w, L.d);
  for (let z = 0; z < L.d; z++) for (let x = 0; x < L.w; x++) if (L.blocked[z * L.w + x]) b.reserve(x, z, x + 1, z + 1);
  for (const n of L.nodes) b.reserve(Math.floor(n.x) - 1, Math.floor(n.z) - 1, Math.floor(n.x) + 2, Math.floor(n.z) + 2);
  for (const s of L.structures) b.reserve(s.x - 1, s.z - 1, s.x + s.w + 1, s.z + s.d + 1);
  for (const q of L.props) b.reserve(Math.floor(q.x), Math.floor(q.z), Math.floor(q.x) + 1, Math.floor(q.z) + 1);
  for (const q of L.portals) b.reserve(q.x0 - 2, q.z0 - 2, q.x1 + 2, q.z1 + 2);
  for (const a of Object.values(L.anchors)) b.reserve(Math.floor(a.x) - 1, Math.floor(a.z) - 1, Math.floor(a.x) + 2, Math.floor(a.z) + 2);
}
