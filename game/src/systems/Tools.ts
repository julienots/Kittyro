import type { Ctx } from './Context';
import type { ToolId } from '../state/types';
import { TOOL_UPGRADE_COST, CAN_CAPACITY } from '../data/tools';

export class ToolSystem {
  /** current water in the can (transient; refilled at any water) */
  water = CAN_CAPACITY[0];

  constructor(private ctx: Ctx) {
    this.water = this.capacity();
  }

  capacity(): number {
    return CAN_CAPACITY[this.ctx.toolTier('can')];
  }

  refill(): void {
    this.water = this.capacity();
    this.ctx.bus.emit('can:changed');
  }

  useWater(n = 1): boolean {
    if (this.ctx.toolTier('can') >= 4) return true;
    if (this.water < n) return false;
    this.water -= n;
    this.ctx.bus.emit('can:changed');
    return true;
  }

  upgradeCost(t: ToolId) {
    const tier = this.ctx.toolTier(t);
    return tier >= 4 ? null : TOOL_UPGRADE_COST[tier + 1];
  }

  canUpgrade(t: ToolId): { ok: boolean; reason?: string } {
    if (!this.ctx.state.village.workshop?.restored) return { ok: false, reason: 'Restaurez l\'atelier de Toma.' };
    const c = this.upgradeCost(t);
    if (!c) return { ok: false, reason: 'Niveau maximum.' };
    if (this.ctx.state.player.coins < c.coins) return { ok: false, reason: 'Pas assez de pièces.' };
    if (!this.ctx.inventory.hasAll(c.items)) return { ok: false, reason: 'Matériaux manquants.' };
    return { ok: true };
  }

  upgrade(t: ToolId): boolean {
    if (!this.canUpgrade(t).ok) return false;
    const c = this.upgradeCost(t)!;
    this.ctx.economy.spend(c.coins);
    this.ctx.inventory.removeAll(c.items);
    this.ctx.state.player.tools[t]++;
    if (t === 'can') this.refill();
    this.ctx.economy.addXp(60);
    this.ctx.progress('upgrade', t);
    this.ctx.bus.emit('tool:upgraded', { tool: t, tier: this.ctx.state.player.tools[t] });
    return true;
  }
}
