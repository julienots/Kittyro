import type { RegionId } from '../state/types';
import { REGION_BY_ID } from '../data/regions';

/**
 * Open world: every outdoor region sits at a fixed place on one continuous map.
 *
 * Regions keep their own local tile coordinates (saves, plots and buildings never
 * move); `ox/oz` is where their (0,0) corner lies on the world map. Roads between
 * regions are generated in "strips" appended to the east (`addE`) and/or south
 * (`addS`) of a region, so local coordinates never shift. The far edge of a strip
 * touches the neighbour region exactly where its old road entrance was, and the
 * player simply walks across: no loading screen, no fade.
 */
export interface Placement {
  ox: number;
  oz: number;
  addE: number;
  addS: number;
}

export const WORLD_LAYOUT: Partial<Record<RegionId, Placement>> = {
  farm: { ox: 0, oz: 0, addE: 14, addS: 12 },
  village: { ox: 66, oz: 3, addE: 12, addS: 16 },
  coast: { ox: 126, oz: 46, addE: 0, addS: 0 },
  ember: { ox: 126, oz: -10, addE: 0, addS: 0 },
  hamlet: { ox: 0, oz: 58, addE: 0, addS: 0 },
  highlands: { ox: -132, oz: 0, addE: 12, addS: 0 },
  woods: { ox: -40, oz: -64, addE: 0, addS: 12 },
  mountains: { ox: 18, oz: -60, addE: 12, addS: 12 },
  frosty: { ox: 82, oz: -60, addE: 0, addS: 0 },
};

export const OPEN_REGIONS = Object.keys(WORLD_LAYOUT) as RegionId[];

export function isOpenWorld(id: RegionId): boolean {
  return !!WORLD_LAYOUT[id];
}

/** Final size of a region (original size + road strips). */
export function regionSize(id: RegionId): [number, number] {
  const p = WORLD_LAYOUT[id];
  const [w, d] = REGION_BY_ID[id].size;
  return p ? [w + p.addE, d + p.addS] : [w, d];
}

export interface Rect { id: RegionId; x0: number; z0: number; x1: number; z1: number }

export function regionRect(id: RegionId): Rect {
  const p = WORLD_LAYOUT[id]!;
  const [w, d] = regionSize(id);
  return { id, x0: p.ox, z0: p.oz, x1: p.ox + w, z1: p.oz + d };
}

export const RECTS: Rect[] = OPEN_REGIONS.map(regionRect);

export const WORLD_BOUNDS = RECTS.reduce(
  (b, r) => ({ x0: Math.min(b.x0, r.x0), z0: Math.min(b.z0, r.z0), x1: Math.max(b.x1, r.x1), z1: Math.max(b.z1, r.z1) }),
  { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity },
);

/** Region whose area contains a world-map position. */
export function regionAt(gx: number, gz: number): RegionId | null {
  for (const r of RECTS) if (gx >= r.x0 && gx < r.x1 && gz >= r.z0 && gz < r.z1) return r.id;
  return null;
}

/** Distance between the areas of two regions (0 when they touch). */
export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
  return Math.hypot(dx, dz);
}

/** Regions close enough to be seen from `id` (kept loaded around the player). */
export function nearbyRegions(id: RegionId, maxGap = 40): RegionId[] {
  const a = regionRect(id);
  return RECTS.filter((r) => r.id !== id && rectGap(a, r) <= maxGap).map((r) => r.id);
}

/** Position on the 0..1 world map panel. */
export function mapPos(id: RegionId): [number, number] {
  const r = regionRect(id);
  const B = WORLD_BOUNDS;
  return [((r.x0 + r.x1) / 2 - B.x0) / (B.x1 - B.x0), ((r.z0 + r.z1) / 2 - B.z0) / (B.z1 - B.z0)];
}

// the world map panel follows the real geography
for (const id of OPEN_REGIONS) REGION_BY_ID[id].map = mapPos(id);
REGION_BY_ID.house.map = REGION_BY_ID.farm.map;
REGION_BY_ID.mine.map = [REGION_BY_ID.mountains.map[0] + 0.03, REGION_BY_ID.mountains.map[1] - 0.06];
