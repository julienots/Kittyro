import type { Ctx } from './Context';
import { CREATURES, CREATURE_BY_ID, type CreatureDef } from '../data/creatures';
import { INSECTS, INSECT_BY_ID, type InsectDef } from '../data/insects';
import { RARITY_WEIGHT } from '../data/fish';
import { seasonOfDay } from '../data/constants';
import { timeMatches } from './Fishing';

export class CreatureSystem {
  constructor(private ctx: Ctx) {}

  candidates(region: string): CreatureDef[] {
    const st = this.ctx.state;
    const season = seasonOfDay(st.time.day);
    const rainbow = st.weather.rainbowUntil > st.absMinute;
    return CREATURES.filter((c) => {
      if (!c.regions.includes(region)) return false;
      if (c.seasons !== 'all' && !c.seasons.includes(season)) return false;
      if (!timeMatches(c.time, st.time.minute)) return false;
      if (c.id === 'rainbowkin') return rainbow;
      if (c.weather && !c.weather.includes(st.weather.current)) return false;
      return true;
    });
  }

  roll(region: string): CreatureDef | null {
    const list = this.candidates(region);
    if (!list.length) return null;
    const luck = this.ctx.hasBuff('luck') ? 2 : 1;
    const rainbow = this.ctx.state.weather.rainbowUntil > this.ctx.state.absMinute ? 2 : 1;
    const parkBonus = region === 'village' && this.ctx.state.village.park?.restored ? 1.5 : 1;
    return this.ctx.rng.weighted(list, (c) => {
      let w = RARITY_WEIGHT[c.rarity];
      if (c.rarity !== 'common') w *= luck * rainbow * parkBonus;
      if (!this.ctx.collections.has('creatures', c.id)) w *= 1.6; // favor new discoveries a little
      return w;
    }) ?? null;
  }

  /** Called when the player gently approaches & observes a creature. */
  discover(id: string): boolean {
    const c = CREATURE_BY_ID[id];
    if (!c) return false;
    const isNew = this.ctx.collections.record('creatures', id);
    const xp = { common: 10, uncommon: 18, rare: 35, epic: 60, mythic: 120 }[c.rarity];
    this.ctx.economy.addXp(isNew ? xp * 2 : xp);
    if (isNew && (c.rarity === 'epic' || c.rarity === 'mythic')) this.ctx.economy.addGems(c.rarity === 'mythic' ? 20 : 8);
    if (isNew) this.ctx.progress('discover', id);
    this.ctx.progress('discover_any', id);
    this.ctx.bus.emit('creature:discovered', { id, isNew });
    return isNew;
  }

  insectCandidates(region: string): InsectDef[] {
    const st = this.ctx.state;
    const season = seasonOfDay(st.time.day);
    const raining = st.weather.current === 'rain';
    return INSECTS.filter((i) => {
      if (!i.regions.includes(region)) return false;
      if (i.seasons !== 'all' && !i.seasons.includes(season)) return false;
      if (!timeMatches(i.time, st.time.minute)) return false;
      if (i.rain && !raining && !this.ctx.rng.chance(0.3)) return false;
      if (i.id === 'rainbow_beetle') return st.weather.rainbowUntil > st.absMinute;
      if (season === 'winter' && i.flying && region !== 'frosty' && i.id !== 'frost_butterfly') return false;
      return true;
    });
  }

  rollInsect(region: string): InsectDef | null {
    const list = this.insectCandidates(region);
    if (!list.length) return null;
    return this.ctx.rng.weighted(list, (i) => RARITY_WEIGHT[i.rarity]) ?? null;
  }

  catchInsect(id: string): void {
    const i = INSECT_BY_ID[id];
    if (!i) return;
    this.ctx.inventory.add(id, 1, true);
    const isNew = this.ctx.collections.record('insects', id);
    this.ctx.economy.addXp(isNew ? 20 : 6);
    this.ctx.progress('catch_bug', id);
    this.ctx.bus.emit('insect:caught', { id, isNew });
  }
}
