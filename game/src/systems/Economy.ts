import type { Ctx } from './Context';
import { item } from '../data/items';
import { xpForLevel } from '../data/constants';
import { PASS_POINTS_PER_TIER, PASS_TIERS } from '../data/shop';

/** Points earned toward the Cozy Pass per activity type. Any play style progresses it. */
const PASS_POINTS: Record<string, number> = {
  harvest: 2, catch: 6, discover: 15, discover_any: 4, craft: 3, cook: 5, restore: 50, build: 20, pet: 2,
  sell: 0.5, forage: 2, catch_bug: 4, talk: 2, gift: 4, collect_product: 3, mine_floor: 6, festival: 30, quest: 15,
};

export class EconomySystem {
  constructor(private ctx: Ctx) {}

  get coins(): number {
    return this.ctx.state.player.coins;
  }

  addCoins(n: number, silent = false): void {
    if (n <= 0) return;
    this.ctx.state.player.coins += Math.round(n);
    this.ctx.state.stats.coinsEarned = (this.ctx.state.stats.coinsEarned ?? 0) + Math.round(n);
    this.ctx.bus.emit('coins:changed', { delta: Math.round(n), silent });
  }

  spend(n: number): boolean {
    n = Math.round(n);
    if (this.ctx.state.player.coins < n) return false;
    this.ctx.state.player.coins -= n;
    this.ctx.bus.emit('coins:changed', { delta: -n });
    return true;
  }

  addGems(n: number): void {
    if (n <= 0) return;
    this.ctx.state.player.gems += n;
    this.ctx.bus.emit('gems:changed', { delta: n });
  }

  spendGems(n: number): boolean {
    if (this.ctx.state.player.gems < n) return false;
    this.ctx.state.player.gems -= n;
    this.ctx.bus.emit('gems:changed', { delta: -n });
    return true;
  }

  addTokens(n: number): void {
    this.ctx.state.festivals.tokens += n;
    this.ctx.bus.emit('tokens:changed', { delta: n });
  }

  spendTokens(n: number): boolean {
    if (this.ctx.state.festivals.tokens < n) return false;
    this.ctx.state.festivals.tokens -= n;
    this.ctx.bus.emit('tokens:changed', { delta: -n });
    return true;
  }

  /** Sell price multiplier, rewarding village restoration. */
  sellMultiplier(id: string, where: 'bin' | 'shop' | 'fishing' | 'bakery' | 'market' = 'bin'): number {
    const st = this.ctx.state;
    let m = 1;
    if (st.village.market?.restored) m += 0.15;
    const cat = item(id).cat;
    if (where === 'fishing' && cat === 'fish') m += 0.25;
    if (where === 'bakery' && cat === 'dish') m += 0.2;
    if (where === 'market') m += 0.1;
    return m;
  }

  priceOf(id: string, where: Parameters<EconomySystem['sellMultiplier']>[1] = 'bin'): number {
    return Math.max(0, Math.round(item(id).sell * this.sellMultiplier(id, where)));
  }

  sell(id: string, qty: number, where: Parameters<EconomySystem['sellMultiplier']>[1] = 'bin'): number {
    const have = this.ctx.inventory.count(id);
    qty = Math.min(qty, have);
    if (qty <= 0 || item(id).sell <= 0) return 0;
    this.ctx.inventory.remove(id, qty);
    const total = this.priceOf(id, where) * qty;
    this.addCoins(total);
    this.ctx.progress('sell', id, qty);
    this.ctx.bus.emit('sold', { id, qty, total });
    return total;
  }

  addXp(n: number): void {
    const p = this.ctx.state.player;
    p.xp += Math.round(n);
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      this.addGems(5);
      this.addCoins(100 * p.level, true);
      this.ctx.bus.emit('levelup', { level: p.level });
      this.ctx.log(`Niveau ${p.level} atteint !`);
    }
    this.ctx.bus.emit('xp:changed');
  }

  addPassPoints(type: string, amount: number): void {
    const pts = (PASS_POINTS[type] ?? 0) * amount;
    if (pts <= 0) return;
    const pass = this.ctx.state.pass;
    const before = Math.floor(pass.points / PASS_POINTS_PER_TIER);
    pass.points = Math.min(PASS_TIERS * PASS_POINTS_PER_TIER, pass.points + pts);
    const after = Math.floor(pass.points / PASS_POINTS_PER_TIER);
    if (after > before) this.ctx.bus.emit('pass:tier', { tier: after });
  }
}
