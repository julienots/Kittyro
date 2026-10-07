import type { Ctx } from './Context';
import { RECIPES, RECIPE_BY_ID, DISH_BY_ID, type RecipeDef, type Station } from '../data/recipes';
import { DECOR_BY_ID } from '../data/decor';
import { item } from '../data/items';

export class CraftingSystem {
  constructor(private ctx: Ctx) {}

  isKnown(r: RecipeDef): boolean {
    const st = this.ctx.state;
    if (st.recipes.includes(r.id)) return true;
    const u = r.unlock;
    if (!u) return true;
    if (u.level && st.player.level < u.level) return false;
    if (u.npc && Math.floor((st.npcs[u.npc]?.friendship ?? 0) / 100) < (u.friend ?? 0)) return false;
    if (u.village && !st.village[u.village]?.restored) return false;
    if (u.story !== undefined && st.quests.storyStep < u.story) return false;
    return true;
  }

  unlockHint(r: RecipeDef): string {
    const u = r.unlock;
    if (!u) return '';
    if (u.level) return `Niveau ${u.level}`;
    if (u.npc) return `Amitié ${u.friend} avec ${u.npc[0].toUpperCase() + u.npc.slice(1)}`;
    if (u.village) return 'Restaurer un bâtiment du village';
    if (u.story !== undefined) return 'Progresser dans l\'histoire';
    return '';
  }

  list(station?: Station): RecipeDef[] {
    return RECIPES.filter((r) => !station || r.station === station || (station === 'workbench' && r.station === 'hand'));
  }

  canCraft(r: RecipeDef, times = 1): boolean {
    if (!this.isKnown(r)) return false;
    if (!this.ctx.building.stationsAvailable().has(r.station)) return false;
    return r.ing.every(([id, q]) => this.ctx.inventory.count(id) >= q * times);
  }

  maxCraftable(r: RecipeDef): number {
    if (!this.isKnown(r)) return 0;
    let n = 999;
    for (const [id, q] of r.ing) n = Math.min(n, Math.floor(this.ctx.inventory.count(id) / q));
    return n;
  }

  craft(id: string, times = 1): boolean {
    const r = RECIPE_BY_ID[id];
    if (!r || !this.canCraft(r, times)) return false;
    for (const [iid, q] of r.ing) this.ctx.inventory.remove(iid, q * times);
    const qty = r.qty * times;
    this.ctx.inventory.add(r.out, qty, true);
    const isDish = !!DISH_BY_ID[r.out];
    if (isDish) {
      this.ctx.collections.record('recipes', r.out);
      this.ctx.progress('cook', r.out, times);
    } else {
      this.ctx.progress('craft', r.out, times);
      if (DECOR_BY_ID[r.out]) this.ctx.collections.record('furniture', r.out);
    }
    if (r.out === 'warm_coat') this.ctx.state.player.hasCoat = true;
    this.ctx.economy.addXp((isDish ? 8 : 4) * times);
    this.ctx.bus.emit('crafted', { id: r.out, qty, dish: isDish, name: item(r.out).name ?? DECOR_BY_ID[r.out]?.name });
    return true;
  }

  /** Eat a dish or fruit: apply its buff. */
  eat(id: string): boolean {
    const d = DISH_BY_ID[id];
    if (!this.ctx.inventory.remove(id, 1)) return false;
    const st = this.ctx.state;
    if (d?.buff) {
      st.player.buffs[d.buff.id] = Math.max(st.player.buffs[d.buff.id] ?? 0, st.absMinute) + d.buff.minutes;
      this.ctx.bus.emit('buff', { id: d.buff.id, minutes: d.buff.minutes });
    } else {
      st.player.buffs.speed = Math.max(st.player.buffs.speed ?? 0, st.absMinute) + 30;
      this.ctx.bus.emit('buff', { id: 'speed', minutes: 30 });
    }
    this.ctx.progress('eat', id);
    return true;
  }
}
