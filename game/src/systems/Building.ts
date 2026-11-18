import type { Ctx } from './Context';
import type { PlacedObject } from '../state/types';
import { BUILDING_BY_ID } from '../data/buildings';
import { DECOR_BY_ID } from '../data/decor';
import { FARM } from '../state/newGame';
import { HOUSE_ROOMS } from '../world/houseLayout';
import { HAMLET_BY_ID, HAMLET_AREA } from '../data/hamlet';

export function sizeOf(kind: string): [number, number] {
  return BUILDING_BY_ID[kind]?.size ?? HAMLET_BY_ID[kind]?.size ?? DECOR_BY_ID[kind]?.size ?? [1, 1];
}

/** Footprint rectangle [x0,x1) x [z0,z1) for an object anchored at its min corner. */
export function footprintOf(kind: string, x: number, z: number, rot: number) {
  const [w, d] = sizeOf(kind);
  const rw = rot % 2 === 0 ? w : d;
  const rd = rot % 2 === 0 ? d : w;
  return { x0: x, z0: z, x1: x + rw, z1: z + rd, w: rw, d: rd };
}

/** Rotate a point given relative to the footprint centre by the object's quarter turns (matches rotation.y = -rot·π/2). */
export function rotLocal(x: number, z: number, rot: number): [number, number] {
  const t = -rot * (Math.PI / 2);
  const c = Math.cos(t), s = Math.sin(t);
  return [x * c + z * s, -x * s + z * c];
}

/** Point just outside a building's front door, whatever its rotation. */
export function doorPoint(kind: string, x: number, z: number, rot: number, out = 0.4): { x: number; z: number } {
  const fp = footprintOf(kind, x, z, rot);
  const [, d] = sizeOf(kind);
  const [dx, dz] = rotLocal(0, d / 2 + out, rot);
  return { x: (fp.x0 + fp.x1) / 2 + dx, z: (fp.z0 + fp.z1) / 2 + dz };
}

let uidCounter = 0;
export const newUid = (p = 'o') => `${p}${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

export type Area = 'farm' | 'house' | 'hamlet';

export class BuildingSystem {
  constructor(private ctx: Ctx) {}

  list(area: Area): PlacedObject[] {
    return area === 'farm' ? this.ctx.state.farm.placed : area === 'hamlet' ? this.ctx.state.hamlet.placed : this.ctx.state.house.furniture;
  }

  count(kind: string): number {
    return this.ctx.state.farm.placed.filter((p) => p.kind === kind).length;
  }

  find(uid: string): { obj: PlacedObject; area: Area } | null {
    const f = this.ctx.state.farm.placed.find((p) => p.uid === uid);
    if (f) return { obj: f, area: 'farm' };
    const h = this.ctx.state.house.furniture.find((p) => p.uid === uid);
    if (h) return { obj: h, area: 'house' };
    const m = this.ctx.state.hamlet.placed.find((p) => p.uid === uid);
    if (m) return { obj: m, area: 'hamlet' };
    return null;
  }

  roomAt(x: number, z: number): string | null {
    for (const r of HOUSE_ROOMS) {
      if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return r.id;
    }
    return null;
  }

  canPlace(kind: string, x: number, z: number, rot: number, area: Area, ignoreUid?: string): { ok: boolean; reason?: string } {
    const fp = footprintOf(kind, x, z, rot);
    const decor = DECOR_BY_ID[kind];
    if (area === 'hamlet') {
      if (BUILDING_BY_ID[kind]) return { ok: false, reason: 'Ce bâtiment se construit à la ferme.' };
      if (decor?.indoor) return { ok: false, reason: 'Ce meuble va à l\'intérieur.' };
      const A = HAMLET_AREA;
      if (fp.x0 < A.minX || fp.z0 < A.minZ || fp.x1 > A.maxX || fp.z1 > A.maxZ) return { ok: false, reason: 'Hors de la clairière constructible.' };
      const isPath = !!decor?.path;
      for (let ix = fp.x0; ix < fp.x1; ix++) for (let iz = fp.z0; iz < fp.z1; iz++) if (!this.ctx.terrain.isBuildable(ix, iz)) return { ok: false, reason: 'Terrain occupé (arbre, rocher, eau…).' };
      for (const p of this.ctx.state.hamlet.placed) {
        if (p.uid === ignoreUid) continue;
        if (isPath !== !!DECOR_BY_ID[p.kind]?.path) continue;
        const o = footprintOf(p.kind, p.x, p.z, p.rot);
        if (fp.x0 < o.x1 && fp.x1 > o.x0 && fp.z0 < o.z1 && fp.z1 > o.z0) return { ok: false, reason: 'Emplacement occupé.' };
      }
      return { ok: true };
    }
    if (HAMLET_BY_ID[kind]) return { ok: false, reason: 'Ce bâtiment se construit au hameau.' };
    if (area === 'farm') {
      if (decor?.indoor) return { ok: false, reason: 'Ce meuble va à l\'intérieur.' };
      if (fp.x0 < FARM.minX || fp.z0 < FARM.minZ || fp.x1 > FARM.maxX || fp.z1 > FARM.maxZ) return { ok: false, reason: 'Hors de la ferme.' };
      const isPath = !!decor?.path;
      for (let ix = fp.x0; ix < fp.x1; ix++) {
        for (let iz = fp.z0; iz < fp.z1; iz++) {
          if (!this.ctx.terrain.isBuildable(ix, iz)) return { ok: false, reason: 'Terrain occupé.' };
          if (this.ctx.farming.plot(ix, iz) && kind !== 'greenhouse') return { ok: false, reason: 'Une parcelle est dans le chemin.' };
          for (const t of this.ctx.state.farm.fruitTrees) if (t.x === ix && t.z === iz) return { ok: false, reason: 'Un arbre est dans le chemin.' };
          if (ix === FARM.shippingBin.x && iz === FARM.shippingBin.z) return { ok: false, reason: 'La caisse d\'expédition est là.' };
        }
      }
      for (const p of this.ctx.state.farm.placed) {
        if (p.uid === ignoreUid) continue;
        const pathOther = !!DECOR_BY_ID[p.kind]?.path;
        if (isPath !== pathOther) continue; // paths are a floor layer
        const o = footprintOf(p.kind, p.x, p.z, p.rot);
        if (fp.x0 < o.x1 && fp.x1 > o.x0 && fp.z0 < o.z1 && fp.z1 > o.z0) return { ok: false, reason: 'Emplacement occupé.' };
      }
      return { ok: true };
    }
    // house
    if (!decor || !decor.indoor) {
      if (decor && (decor.cat === 'flowers' || decor.cat === 'lights' || decor.cat === 'magic' || decor.cat === 'colorful' || decor.cat === 'winter' || decor.cat === 'halloween')) {
        // small decor works indoors too
      } else return { ok: false, reason: 'Cet objet va à l\'extérieur.' };
    }
    const room = this.roomAt(fp.x0, fp.z0);
    if (!room || !this.ctx.state.house.rooms[room]?.unlocked) return { ok: false, reason: 'Pièce non débloquée.' };
    const r = HOUSE_ROOMS.find((q) => q.id === room)!;
    if (fp.x1 > r.x1 || fp.z1 > r.z1) return { ok: false, reason: 'Ça ne rentre pas dans la pièce.' };
    if (decor?.wall && fp.z0 !== r.z0) return { ok: false, reason: 'Se fixe contre le mur du fond.' };
    const isRug = decor?.cat === 'rug';
    for (const p of this.ctx.state.house.furniture) {
      if (p.uid === ignoreUid) continue;
      const od = DECOR_BY_ID[p.kind];
      if (!!od?.wall !== !!decor?.wall) continue;
      if ((od?.cat === 'rug') !== isRug) continue;
      const o = footprintOf(p.kind, p.x, p.z, p.rot);
      if (fp.x0 < o.x1 && fp.x1 > o.x0 && fp.z0 < o.z1 && fp.z1 > o.z0) return { ok: false, reason: 'Emplacement occupé.' };
    }
    return { ok: true };
  }

  /** Can the player afford a building? */
  affordable(kind: string): { ok: boolean; reason?: string } {
    const hb = HAMLET_BY_ID[kind];
    if (hb) {
      if (this.ctx.hamlet.count(kind) >= hb.max) return { ok: false, reason: `Maximum ${hb.max}.` };
      if (this.ctx.state.hamlet.level < hb.level) return { ok: false, reason: `Hameau niveau ${hb.level} requis (${this.ctx.hamlet.levelName(hb.level)}).` };
      if (this.ctx.state.player.coins < hb.coins) return { ok: false, reason: 'Pas assez de pièces.' };
      if (!this.ctx.inventory.hasAll(hb.items)) return { ok: false, reason: 'Matériaux manquants.' };
      return { ok: true };
    }
    const b = BUILDING_BY_ID[kind];
    if (!b) return { ok: (this.ctx.state.decorOwned[kind] ?? 0) > 0, reason: 'Aucun en stock.' };
    if (this.count(kind) >= b.max) return { ok: false, reason: `Maximum ${b.max}.` };
    if (this.ctx.state.player.level < b.unlockLevel) return { ok: false, reason: `Niveau ${b.unlockLevel} requis.` };
    if (this.ctx.state.player.coins < b.coins) return { ok: false, reason: 'Pas assez de pièces.' };
    if (!this.ctx.inventory.hasAll(b.items)) return { ok: false, reason: 'Matériaux manquants.' };
    return { ok: true };
  }

  place(kind: string, x: number, z: number, rot: number, area: Area): PlacedObject | null {
    const can = this.canPlace(kind, x, z, rot, area);
    if (!can.ok) {
      this.ctx.toast(can.reason!, '🚫', 'warn');
      return null;
    }
    const b = BUILDING_BY_ID[kind] ?? HAMLET_BY_ID[kind];
    if (b) {
      const aff = this.affordable(kind);
      if (!aff.ok) {
        this.ctx.toast(aff.reason!, '🚫', 'warn');
        return null;
      }
      this.ctx.economy.spend(b.coins);
      this.ctx.inventory.removeAll(b.items);
    } else {
      if ((this.ctx.state.decorOwned[kind] ?? 0) <= 0) return null;
      this.ctx.state.decorOwned[kind]--;
    }
    const obj: PlacedObject = { uid: newUid(b ? 'b' : 'd'), kind, x, z, rot };
    if (area === 'house') obj.room = this.roomAt(x, z) ?? undefined;
    this.list(area).push(obj);
    if (area === 'hamlet') this.ctx.hamlet.onPlaced(obj);
    if (b) {
      this.ctx.progress('build', kind);
      this.ctx.economy.addXp(50);
      this.ctx.log(`Construction : ${b.name}`);
    } else {
      this.ctx.collections.record('furniture', kind);
    }
    this.ctx.bus.emit('placed:changed', { area, uid: obj.uid, kind, built: !!b });
    this.ctx.bus.emit('decor:changed');
    return obj;
  }

  move(uid: string, x: number, z: number, rot: number): boolean {
    const f = this.find(uid);
    if (!f) return false;
    const can = this.canPlace(f.obj.kind, x, z, rot, f.area, uid);
    if (!can.ok) {
      this.ctx.toast(can.reason!, '🚫', 'warn');
      return false;
    }
    if (f.obj.kind === 'house') return false;
    f.obj.x = x;
    f.obj.z = z;
    f.obj.rot = rot;
    if (f.area === 'house') f.obj.room = this.roomAt(x, z) ?? undefined;
    // animals follow their home
    for (const a of this.ctx.state.animals) if (a.homeUid === uid) {
      a.x = x + 1;
      a.z = z + 1;
    }
    this.ctx.bus.emit('placed:changed', { area: f.area, uid });
    return true;
  }

  /** Put a decoration back in the bag. Buildings with animals inside cannot be stored. */
  store(uid: string): boolean {
    const f = this.find(uid);
    if (!f) return false;
    const kind = f.obj.kind;
    if (HAMLET_BY_ID[kind]) {
      this.ctx.economy.addCoins(Math.round(HAMLET_BY_ID[kind].coins / 2));
    } else if (BUILDING_BY_ID[kind]) {
      if (kind === 'house') return false;
      if (this.ctx.state.animals.some((a) => a.homeUid === uid)) {
        this.ctx.toast('Des animaux vivent ici !', '🐾', 'warn');
        return false;
      }
      // refund half of the coins, keep it simple and friendly
      const b = BUILDING_BY_ID[kind];
      this.ctx.economy.addCoins(Math.round(b.coins / 2));
    } else {
      this.ctx.state.decorOwned[kind] = (this.ctx.state.decorOwned[kind] ?? 0) + 1;
    }
    const list = this.list(f.area);
    list.splice(list.indexOf(f.obj), 1);
    if (f.area === 'hamlet') this.ctx.hamlet.onRemoved(uid);
    this.ctx.bus.emit('placed:changed', { area: f.area, uid, removed: true });
    this.ctx.bus.emit('decor:changed');
    return true;
  }

  stationsAvailable(): Set<string> {
    const s = new Set<string>(['hand']);
    for (const p of this.ctx.state.farm.placed) {
      const st = BUILDING_BY_ID[p.kind]?.station;
      if (st) s.add(st);
    }
    if (this.ctx.state.house.furniture.some((f) => f.kind === 'stove')) s.add('kitchen');
    if (this.ctx.state.village.workshop?.restored) {
      s.add('workbench');
      s.add('forge');
    }
    if (this.ctx.state.village.bakery?.restored) {
      s.add('kitchen');
      s.add('mill');
    }
    return s;
  }
}
