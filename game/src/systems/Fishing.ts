import type { Ctx } from './Context';
import { FISH, FISH_BY_ID, RARITY_WEIGHT, type FishDef } from '../data/fish';
import { seasonOfDay } from '../data/constants';
import { ROD_ZONE } from '../data/tools';

export function timeMatches(time: string, minute: number): boolean {
  const m = minute % 1440;
  switch (time) {
    case 'day': return m >= 360 && m < 1200;
    case 'night': return m >= 1200 || m < 300;
    case 'dawn': return m >= 300 && m < 540;
    case 'dusk': return m >= 1020 && m < 1260;
    default: return true;
  }
}

export class FishingSystem {
  constructor(private ctx: Ctx) {}

  available(region: string, magic = false): FishDef[] {
    const st = this.ctx.state;
    const season = seasonOfDay(st.time.day);
    const w = st.weather.current;
    return FISH.filter((f) => {
      if (!f.regions.includes(region === 'hamlet' ? 'farm' : region)) return false;
      if (magic) return true;
      if (f.seasons !== 'all' && !f.seasons.includes(season)) return false;
      if (!timeMatches(f.time, st.time.minute)) return false;
      if (f.weather && !f.weather.includes(w)) return false;
      return true;
    });
  }

  /** Pick the fish that bites. Better rods and luck tilt the odds toward rare fish. */
  roll(region: string, magic = false): { fish: FishDef; size: number } | null {
    const list = this.available(region, magic);
    if (!list.length) return null;
    const tier = this.ctx.toolTier('rod');
    const luck = this.ctx.hasBuff('luck') ? 1.5 : 1;
    const f = this.ctx.rng.weighted(list, (x) => {
      let w = RARITY_WEIGHT[x.rarity];
      if (x.rarity !== 'common') w *= (1 + tier * 0.25) * luck;
      if (x.rarity === 'mythic' && tier < 3) w *= 0.3;
      if (x.id === 'old_boot') w *= Math.max(0.1, 1 - tier * 0.3);
      return w;
    })!;
    const size = Math.round(this.ctx.rng.range(f.size[0], f.size[1]) * 10) / 10;
    return { fish: f, size };
  }

  zoneSize(): number {
    return ROD_ZONE[this.ctx.toolTier('rod')] + (this.ctx.hasBuff('fishing') ? 0.06 : 0);
  }

  /** Bite delay in seconds. */
  biteDelay(baitUsed: boolean): number {
    return this.ctx.rng.range(baitUsed ? 1.2 : 2.2, baitUsed ? 3.5 : 6.5);
  }

  catch(fishId: string, size: number): void {
    const f = FISH_BY_ID[fishId];
    if (!f) return;
    this.ctx.inventory.add(fishId, 1, true);
    const isNew = this.ctx.collections.record('fish', fishId, size);
    this.ctx.economy.addXp({ common: 8, uncommon: 14, rare: 24, epic: 40, mythic: 80 }[f.rarity]);
    if (f.rarity === 'mythic' || f.rarity === 'epic') this.ctx.economy.addGems(f.rarity === 'mythic' ? 10 : 3);
    this.ctx.progress('catch', fishId);
    this.ctx.bus.emit('fish:caught', { id: fishId, size, isNew });
  }
}
