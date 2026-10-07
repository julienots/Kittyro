import type { Ctx } from './Context';
import type { RegionId } from '../state/types';
import { NODE_KINDS, FORAGE, type NodeKind } from '../data/nodes';
import { AXE_HITS, PICK_POWER } from '../data/tools';
import { seasonOfDay } from '../data/constants';
import { hashString, Random } from '../core/Random';

export interface NodeRef {
  id: string;
  kind: string;
  region: RegionId;
  x: number;
  z: number;
  variant?: number;
  /** transient nodes (mine floors) are not persisted */
  transient?: boolean;
  /** never respawns once cleared (farm debris, story boulder, chests) */
  once?: boolean;
}

export interface HitResult {
  ok: boolean;
  done: boolean;
  drops: { id: string; qty: number }[];
  reason?: string;
}

export class GatheringSystem {
  /** state for transient nodes (mine) */
  private transient = new Map<string, { depletedAt: number | null; hp?: number }>();

  constructor(private ctx: Ctx) {}

  private ns(n: NodeRef) {
    if (n.transient) {
      let s = this.transient.get(n.id);
      if (!s) this.transient.set(n.id, (s = { depletedAt: null }));
      return s;
    }
    const nodes = this.ctx.state.regions[n.region].nodes;
    return (nodes[n.id] ??= { depletedAt: null });
  }

  resetTransient(): void {
    this.transient.clear();
  }

  kind(n: NodeRef): NodeKind {
    return NODE_KINDS[n.kind];
  }

  /** 0 = just depleted, 1 = fully grown/available */
  growth(n: NodeRef): number {
    const s = n.transient ? this.transient.get(n.id) : this.ctx.state.regions[n.region].nodes[n.id];
    if (!s || s.depletedAt === null) return 1;
    if (n.once) return 0;
    const k = this.kind(n);
    const t = (this.ctx.state.absMinute - s.depletedAt) / k.respawn;
    if (t >= 1) {
      s.depletedAt = null;
      s.hp = undefined;
      return 1;
    }
    return Math.max(0, t);
  }

  available(n: NodeRef): boolean {
    return this.growth(n) >= 1;
  }

  hpLeft(n: NodeRef): number {
    const s = this.ns(n);
    return s.hp ?? this.maxHp(n);
  }

  maxHp(n: NodeRef): number {
    const k = this.kind(n);
    if (k.tool === 'axe') return Math.max(1, Math.round(k.hp * AXE_HITS[this.ctx.toolTier('axe')] / 4));
    if (k.tool === 'pickaxe') return Math.max(1, Math.ceil(k.hp / PICK_POWER[this.ctx.toolTier('pickaxe')] * 1.5));
    return k.hp;
  }

  forageItem(n: NodeRef): string {
    const season = seasonOfDay(this.ctx.state.time.day);
    const table = FORAGE[n.region] ?? FORAGE.farm;
    const list = table[season] ?? table.all ?? ['fiber'];
    const r = new Random(hashString(n.id) ^ (this.ctx.state.time.day * 31));
    return r.pick(list);
  }

  /** Apply one tool hit (or hand pick). */
  hit(n: NodeRef, usingTool: string): HitResult {
    const k = this.kind(n);
    if (!k) return { ok: false, done: false, drops: [] };
    if (!this.available(n)) return { ok: false, done: false, drops: [], reason: 'Ça repousse...' };
    if (k.tool !== 'hand' && k.tool !== usingTool) return { ok: false, done: false, drops: [], reason: `Il faut ${({ axe: 'la hache', pickaxe: 'la pioche', sickle: 'la faucille' } as any)[k.tool]}.` };
    const tier = k.tool === 'hand' ? 99 : this.ctx.toolTier(k.tool as any);
    if (tier < k.minTier) return { ok: false, done: false, drops: [], reason: `Outil trop faible (niveau ${['Bois', 'Cuivre', 'Fer', 'Acier', 'Cristal'][k.minTier]} requis).` };
    const s = this.ns(n);
    const hp = (s.hp ?? this.maxHp(n)) - 1;
    if (hp > 0) {
      s.hp = hp;
      return { ok: true, done: false, drops: [] };
    }
    // depleted -> drops
    s.hp = undefined;
    s.depletedAt = this.ctx.state.absMinute;
    const drops: { id: string; qty: number }[] = [];
    const rng = this.ctx.rng;
    const luck = this.ctx.hasBuff('luck') ? 1.4 : 1;
    if (k.id === 'forage') {
      drops.push({ id: this.forageItem(n), qty: 1 });
    } else {
      for (const d of k.drops) {
        if (d.chance !== undefined && !rng.chance(Math.min(1, d.chance * luck))) continue;
        drops.push({ id: d.id, qty: rng.int(d.min, d.max) });
      }
    }
    if (k.tool === 'axe' && this.ctx.toolTier('axe') >= 4 && drops[0]) drops[0].qty += 2;
    if (this.ctx.hasBuff('gather') && drops[0] && rng.chance(0.4)) drops[0].qty *= 2;
    for (const d of drops) {
      this.ctx.inventory.add(d.id, d.qty, true);
      const cat = d.id;
      if (['copper_ore', 'iron_ore', 'gold_ore', 'crystal_shard', 'amethyst', 'aquamarine', 'frost_crystal', 'emberite', 'ember_core', 'geode', 'moonstone', 'fossil', 'coal'].includes(cat)) this.ctx.collections.record('minerals', d.id);
      if (['daisy', 'bluebell', 'poppy', 'edelweiss', 'lotus', 'hibiscus', 'ash_bloom'].includes(cat)) this.ctx.collections.record('flowers', d.id);
    }
    this.ctx.economy.addXp(k.xp);
    if (k.activity === 'forage') this.ctx.progress('forage', drops[0]?.id ?? '*');
    if (k.activity === 'chop') this.ctx.progress('chop');
    if (k.activity === 'mine') this.ctx.progress('mine');
    if (k.id === 'boulder') this.ctx.progress('break_boulder', n.region);
    this.ctx.bus.emit('node:depleted', { id: n.id, region: n.region, drops });
    return { ok: true, done: true, drops };
  }
}
