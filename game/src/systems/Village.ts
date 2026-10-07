import type { Ctx } from './Context';
import { VILLAGE_BY_ID, VILLAGE_BUILDINGS } from '../data/village';
import { NPC_BY_ID } from '../data/npcs';

export class VillageSystem {
  constructor(private ctx: Ctx) {}

  state(id: string) {
    return this.ctx.state.village[id];
  }

  isRestored(id: string): boolean {
    return !!this.ctx.state.village[id]?.restored;
  }

  available(id: string): boolean {
    const def = VILLAGE_BY_ID[id];
    return !!def && (def.requires ?? []).every((r) => this.isRestored(r));
  }

  missing(id: string): { coins: number; items: [string, number][] } {
    const def = VILLAGE_BY_ID[id];
    const s = this.state(id);
    const items: [string, number][] = [];
    for (const [iid, q] of def.items) {
      const left = q - (s.contributed[iid] ?? 0);
      if (left > 0) items.push([iid, left]);
    }
    const coinsLeft = Math.max(0, def.coins - (s.contributed.__coins ?? 0));
    return { coins: coinsLeft, items };
  }

  /** Contribute everything the player can toward a restoration. Returns true if restored. */
  contribute(id: string): { gave: number; restored: boolean } {
    const def = VILLAGE_BY_ID[id];
    const s = this.state(id);
    if (!def || s.restored || !this.available(id)) return { gave: 0, restored: false };
    let gave = 0;
    for (const [iid, q] of def.items) {
      const left = q - (s.contributed[iid] ?? 0);
      const n = Math.min(left, this.ctx.inventory.count(iid));
      if (n > 0) {
        this.ctx.inventory.remove(iid, n);
        s.contributed[iid] = (s.contributed[iid] ?? 0) + n;
        gave += n;
      }
    }
    const coinsLeft = def.coins - (s.contributed.__coins ?? 0);
    const pay = Math.min(coinsLeft, this.ctx.state.player.coins);
    if (pay > 0) {
      this.ctx.economy.spend(pay);
      s.contributed.__coins = (s.contributed.__coins ?? 0) + pay;
      gave += 1;
    }
    const m = this.missing(id);
    if (m.coins === 0 && m.items.length === 0) {
      this.restore(id);
      return { gave, restored: true };
    }
    this.ctx.bus.emit('village:changed', { id });
    return { gave, restored: false };
  }

  restore(id: string): void {
    const s = this.state(id);
    if (s.restored) return;
    s.restored = true;
    s.restoredDay = this.ctx.state.time.day;
    const def = VILLAGE_BY_ID[id];
    this.ctx.economy.addXp(150);
    this.ctx.progress('restore', id);
    this.ctx.log(`${def.name} restauré(e) !`);
    if (def.npc) this.ctx.npcs.addFriendship(def.npc, 100);
    this.ctx.bus.emit('village:restored', { id, name: def.name, npc: def.npc ? NPC_BY_ID[def.npc]?.name : undefined });
    this.ctx.bus.emit('village:changed', { id });
  }

  restoredCount(): number {
    return VILLAGE_BUILDINGS.filter((b) => this.isRestored(b.id)).length;
  }
}
