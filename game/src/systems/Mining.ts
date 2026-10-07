import type { Ctx } from './Context';
import { Random } from '../core/Random';

export interface MineRock {
  id: string;
  kind: string;
  x: number;
  z: number;
  ladder?: boolean;
}

export interface MineFloor {
  floor: number;
  rocks: MineRock[];
  chest: { x: number; z: number; key: boolean } | null;
  pool: { x: number; z: number } | null;
  shrine: boolean;
  theme: 'earth' | 'crystal' | 'frost' | 'ember';
  spawn: { x: number; z: number };
  exitUp: { x: number; z: number };
}

export const MINE_SIZE = 22;

/** Procedural mine floors. Deeper = rarer ores. Every 5th floor is a rest floor with an elevator. */
export class MiningSystem {
  constructor(private ctx: Ctx) {}

  theme(floor: number): MineFloor['theme'] {
    if (floor >= 25) return 'ember';
    if (floor >= 15) return 'frost';
    if (floor >= 6) return 'crystal';
    return 'earth';
  }

  generate(floor: number): MineFloor {
    const st = this.ctx.state;
    const r = new Random((st.mine.seed ^ (floor * 2246822519) ^ st.time.day * 13) >>> 0);
    const rocks: MineRock[] = [];
    const theme = this.theme(floor);
    const rest = floor % 5 === 0;
    const used = new Set<string>();
    const spawn = { x: 11, z: 18 };
    const exitUp = { x: 11, z: 19.5 };
    const blockedNear = (x: number, z: number) => Math.abs(x - spawn.x) < 2 && Math.abs(z - spawn.z) < 2;
    const count = rest ? 6 : 26 + Math.min(20, floor);
    for (let i = 0; i < count; i++) {
      const x = r.int(2, MINE_SIZE - 3), z = r.int(2, MINE_SIZE - 4);
      const k = `${x},${z}`;
      if (used.has(k) || blockedNear(x, z)) continue;
      used.add(k);
      rocks.push({ id: `m${floor}_${i}`, kind: this.rollRock(floor, r), x: x + 0.5, z: z + 0.5 });
    }
    // ladder hidden under a random rock (not on rest floors: there is an open ladder)
    if (!rest && rocks.length) r.pick(rocks.filter((q) => q.kind !== 'geode_node')).ladder = true;
    let chest: MineFloor['chest'] = null;
    const keyFloor = floor === 15 && !this.ctx.inventory?.has('ember_key') && !st.regions.ember.unlocked;
    if (keyFloor || (floor % 4 === 3 && r.chance(0.7))) {
      let cx = r.int(3, MINE_SIZE - 4), cz = r.int(3, 10);
      while (used.has(`${cx},${cz}`)) cx = (cx + 1) % (MINE_SIZE - 4) + 2;
      used.add(`${cx},${cz}`);
      chest = { x: cx + 0.5, z: cz + 0.5, key: keyFloor };
    }
    const pool = floor % 3 === 1 ? { x: 4 + r.int(0, 3), z: 4 + r.int(0, 3) } : null;
    if (pool) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const idx = rocks.findIndex((q) => Math.abs(q.x - 0.5 - pool.x - dx) < 0.1 && Math.abs(q.z - 0.5 - pool.z - dz) < 0.1);
      if (idx >= 0 && !rocks[idx].ladder) rocks.splice(idx, 1);
    }
    return { floor, rocks, chest, pool, shrine: floor % 7 === 0, theme, spawn, exitUp };
  }

  rollRock(floor: number, r: Random): string {
    const t = this.theme(floor);
    const table: [string, number][] = [['rock', 50], ['ore_coal', 10], ['ore_copper', floor < 10 ? 18 : 6]];
    if (floor >= 3) table.push(['ore_iron', 6 + Math.min(14, floor)]);
    if (floor >= 6) table.push(['ore_crystal', 6], ['geode_node', 4]);
    if (floor >= 10) table.push(['ore_gold', 6]);
    if (t === 'frost') table.push(['ore_frost', 8]);
    if (t === 'ember') table.push(['ore_ember', 10]);
    return r.weighted(table, (x) => x[1])![0];
  }

  reachFloor(floor: number): void {
    const st = this.ctx.state;
    st.mine.floor = floor;
    if (floor > st.mine.deepest) {
      st.mine.deepest = floor;
      this.ctx.progress('mine_floor', '*', 1);
      this.ctx.bus.emit('mine:deepest', { floor });
    }
  }

  /** Floors you can jump to with the elevator. */
  elevatorFloors(): number[] {
    const out = [1];
    for (let f = 5; f <= this.ctx.state.mine.deepest; f += 5) out.push(f);
    return out;
  }

  chestLoot(floor: number, key: boolean): { id: string; qty: number }[] {
    if (key) return [{ id: 'ember_key', qty: 1 }, { id: 'gold_bar', qty: 2 }];
    const r = this.ctx.rng;
    const pool = floor >= 15 ? ['amethyst', 'aquamarine', 'gold_bar', 'frost_crystal', 'moonstone'] : floor >= 6 ? ['crystal_shard', 'iron_bar', 'geode', 'amethyst'] : ['copper_bar', 'coal', 'geode', 'iron_ore'];
    return [{ id: r.pick(pool), qty: r.int(1, 3) }, { id: 'coal', qty: r.int(2, 5) }];
  }
}
