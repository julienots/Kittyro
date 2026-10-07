import type { Ctx } from './Context';
import type { PlotState } from '../state/types';
import { CROP_BY_ID, cropStage, seedId } from '../data/crops';
import { seasonOfDay } from '../data/constants';
import { FARM } from '../state/newGame';
import { FRUIT_TREES, FRUIT_TREE_GROW_DAYS } from '../data/resources';
import { footprintOf } from './Building';

export type FarmResult = { ok: boolean; reason?: string };

export class FarmingSystem {
  constructor(private ctx: Ctx) {}

  get plots(): Record<string, PlotState> {
    return this.ctx.state.farm.plots;
  }

  plot(x: number, z: number): PlotState | undefined {
    return this.plots[`${x},${z}`];
  }

  inFarm(x: number, z: number): boolean {
    return x >= FARM.minX && x < FARM.maxX && z >= FARM.minZ && z < FARM.maxZ;
  }

  /** True if (x,z) is covered by a placed object footprint or a fruit tree. */
  occupied(x: number, z: number, ignoreUid?: string): boolean {
    const st = this.ctx.state;
    for (const p of st.farm.placed) {
      if (p.uid === ignoreUid) continue;
      if (p.kind === 'greenhouse') continue; // you can farm under the greenhouse
      const fp = footprintOf(p.kind, p.x, p.z, p.rot);
      if (x >= fp.x0 && x < fp.x1 && z >= fp.z0 && z < fp.z1) {
        if (p.kind.startsWith('path_')) continue;
        return true;
      }
    }
    for (const t of st.farm.fruitTrees) if (t.x === x && t.z === z) return true;
    const bin = FARM.shippingBin;
    if (x === bin.x && z === bin.z) return true;
    return false;
  }

  inGreenhouse(x: number, z: number): boolean {
    for (const p of this.ctx.state.farm.placed) {
      if (p.kind !== 'greenhouse') continue;
      const fp = footprintOf(p.kind, p.x, p.z, p.rot);
      if (x >= fp.x0 && x < fp.x1 && z >= fp.z0 && z < fp.z1) return true;
    }
    return false;
  }

  canTill(x: number, z: number): boolean {
    return this.inFarm(x, z) && !this.plot(x, z) && !this.occupied(x, z) && this.ctx.terrain.isTillable(x, z);
  }

  till(x: number, z: number): boolean {
    if (!this.canTill(x, z)) return false;
    const raining = this.ctx.weather.isRaining();
    this.plots[`${x},${z}`] = { x, z, watered: raining, fertilized: 0, crop: null };
    this.ctx.bus.emit('plot:changed', { x, z, kind: 'till' });
    this.ctx.progress('till');
    return true;
  }

  untill(x: number, z: number): boolean {
    const p = this.plot(x, z);
    if (!p || p.crop) return false;
    delete this.plots[`${x},${z}`];
    this.ctx.bus.emit('plot:changed', { x, z, kind: 'untill' });
    return true;
  }

  canGrowNow(cropId: string, x: number, z: number): boolean {
    const def = CROP_BY_ID[cropId];
    if (!def) return false;
    return def.seasons.includes(seasonOfDay(this.ctx.state.time.day)) || this.inGreenhouse(x, z);
  }

  plant(x: number, z: number, seed: string): FarmResult {
    const p = this.plot(x, z);
    if (!p) return { ok: false, reason: 'Préparez d\'abord la terre avec la houe.' };
    if (p.crop) return { ok: false, reason: 'Il y a déjà une plante ici.' };
    const cropId = seed.replace(/^seed_/, '');
    const def = CROP_BY_ID[cropId];
    if (!def) return { ok: false, reason: 'Ce n\'est pas une graine.' };
    if (!this.canGrowNow(cropId, x, z)) return { ok: false, reason: `${def.name} ne pousse pas en cette saison (sauf sous serre).` };
    if (!this.ctx.inventory.remove(seed, 1)) return { ok: false, reason: 'Plus de graines.' };
    p.crop = { id: cropId, growth: 0, harvests: 0, ready: false };
    this.ctx.bus.emit('plot:changed', { x, z, kind: 'plant' });
    this.ctx.progress('plant', cropId);
    return { ok: true };
  }

  water(x: number, z: number): boolean {
    const p = this.plot(x, z);
    if (!p || p.watered) return false;
    p.watered = true;
    this.ctx.bus.emit('plot:changed', { x, z, kind: 'water' });
    this.ctx.progress('water');
    return true;
  }

  fertilize(x: number, z: number, deluxe: boolean): boolean {
    const p = this.plot(x, z);
    const id = deluxe ? 'deluxe_fertilizer' : 'fertilizer';
    if (!p || p.fertilized >= (deluxe ? 2 : 1)) return false;
    if (!this.ctx.inventory.remove(id, 1)) return false;
    p.fertilized = deluxe ? 2 : 1;
    this.ctx.bus.emit('plot:changed', { x, z, kind: 'fertilize' });
    return true;
  }

  stage(p: PlotState): number {
    if (!p.crop) return -1;
    const def = CROP_BY_ID[p.crop.id];
    return cropStage(def, p.crop.growth, p.crop.harvests);
  }

  harvest(x: number, z: number, bonus = false): { id: string; qty: number } | null {
    const p = this.plot(x, z);
    if (!p || !p.crop || !p.crop.ready) return null;
    const def = CROP_BY_ID[p.crop.id];
    let qty = this.ctx.rng.int(def.yield[0], def.yield[1]);
    if (p.fertilized === 2 && this.ctx.rng.chance(0.35)) qty++;
    if ((this.ctx.hasBuff('gather') || bonus) && this.ctx.rng.chance(0.5)) qty *= 2;
    this.ctx.inventory.add(def.id, qty, true);
    this.ctx.collections.record(def.flower ? 'flowers' : 'plants', def.id);
    this.ctx.economy.addXp(def.xp);
    this.ctx.progress('harvest', def.id, qty);
    if (def.regrow) {
      p.crop.harvests++;
      p.crop.growth = 0;
      p.crop.ready = false;
    } else {
      p.crop = null;
      if (p.fertilized === 1) p.fertilized = 0;
    }
    this.ctx.bus.emit('plot:changed', { x, z, kind: 'harvest', crop: def.id, qty });
    this.ctx.bus.emit('harvested', { x, z, id: def.id, qty });
    return { id: def.id, qty };
  }

  /** Advance growth by `minutes` of game time. */
  tick(minutes: number): void {
    const growthBuff = this.ctx.hasBuff('growth') ? 1.15 : 1;
    for (const p of Object.values(this.plots)) {
      const c = p.crop;
      if (!c || c.ready || !p.watered) continue;
      if (!this.canGrowNow(c.id, p.x, p.z)) continue;
      const def = CROP_BY_ID[c.id];
      const mult = (p.fertilized === 2 ? 1.6 : p.fertilized === 1 ? 1.25 : 1) * growthBuff;
      const before = cropStage(def, c.growth, c.harvests);
      c.growth += minutes * mult;
      const total = c.harvests > 0 && def.regrow ? def.regrow : def.grow;
      if (c.growth >= total) {
        c.growth = total;
        c.ready = true;
        this.ctx.bus.emit('crop:ready', { x: p.x, z: p.z, id: c.id });
      } else if (cropStage(def, c.growth, c.harvests) !== before) {
        this.ctx.bus.emit('plot:changed', { x: p.x, z: p.z, kind: 'grow' });
      }
    }
  }

  /** Morning: watered status resets (rain re-waters everything). */
  newDay(raining: boolean): void {
    for (const p of Object.values(this.plots)) {
      p.watered = raining;
    }
    this.ctx.bus.emit('plots:reset');
  }

  waterAll(): void {
    for (const p of Object.values(this.plots)) p.watered = true;
    this.ctx.bus.emit('plots:reset');
  }

  readyCount(): number {
    return Object.values(this.plots).filter((p) => p.crop?.ready).length;
  }

  // ---------- Fruit trees ----------
  plantTree(kind: string, x: number, z: number): FarmResult {
    if (!this.inFarm(x, z) || this.occupied(x, z) || this.plot(x, z) || !this.ctx.terrain.isTillable(x, z)) return { ok: false, reason: 'Impossible de planter ici.' };
    if (!this.ctx.inventory.remove(`sapling_${kind}`, 1)) return { ok: false, reason: 'Pas de jeune arbre.' };
    this.ctx.state.farm.fruitTrees.push({ uid: `ft${Date.now().toString(36)}${this.ctx.rng.int(0, 999)}`, kind, x, z, plantedAbs: this.ctx.state.absMinute, lastHarvestDay: 0 });
    this.ctx.bus.emit('trees:changed');
    return { ok: true };
  }

  treeAge(t: { plantedAbs: number }): number {
    return (this.ctx.state.absMinute - t.plantedAbs) / 1440;
  }

  treeHasFruit(t: { kind: string; plantedAbs: number; lastHarvestDay: number }): boolean {
    const def = FRUIT_TREES.find((f) => f.id === t.kind);
    if (!def) return false;
    const season = seasonOfDay(this.ctx.state.time.day);
    return this.treeAge(t) >= FRUIT_TREE_GROW_DAYS && (def.seasons as readonly string[]).includes(season) && t.lastHarvestDay < this.ctx.state.time.day;
  }

  harvestTree(uid: string): number {
    const t = this.ctx.state.farm.fruitTrees.find((f) => f.uid === uid);
    if (!t || !this.treeHasFruit(t)) return 0;
    const def = FRUIT_TREES.find((f) => f.id === t.kind)!;
    const qty = this.ctx.rng.int(2, 4);
    this.ctx.inventory.add(def.fruit, qty, true);
    t.lastHarvestDay = this.ctx.state.time.day;
    this.ctx.progress('harvest', def.fruit, qty);
    this.ctx.economy.addXp(8);
    this.ctx.bus.emit('trees:changed');
    this.ctx.bus.emit('harvested', { x: t.x, z: t.z, id: def.fruit, qty });
    return qty;
  }
}

export { seedId };
