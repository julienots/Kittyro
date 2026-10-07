import type { Ctx } from './Context';
import { FESTIVALS, FESTIVAL_BY_ID, type FestivalDef } from '../data/festivals';
import { dayOfSeason, seasonOfDay } from '../data/constants';

export class FestivalSystem {
  private lastActive: string | null = null;

  constructor(private ctx: Ctx) {}

  /** Festival happening today (regardless of the hour). */
  today(): FestivalDef | null {
    const st = this.ctx.state;
    const season = seasonOfDay(st.time.day);
    const ds = dayOfSeason(st.time.day);
    const f = FESTIVALS.find((x) => x.season === season && x.day === ds);
    if (f) return f;
    if (this.ctx.weather.rainbow() || st.flags.rainbowDay === st.time.day) return FESTIVAL_BY_ID.rainbow;
    return null;
  }

  active(): FestivalDef | null {
    const f = this.today();
    if (!f) return null;
    const m = this.ctx.state.time.minute;
    return m >= f.from && m < f.to ? f : null;
  }

  upcoming(): { fest: FestivalDef; inDays: number } | null {
    const st = this.ctx.state;
    for (let i = 0; i < 48; i++) {
      const d = st.time.day + i;
      const f = FESTIVALS.find((x) => x.season === seasonOfDay(d) && x.day === dayOfSeason(d));
      if (f) return { fest: f, inDays: i };
    }
    return null;
  }

  tick(): void {
    const a = this.active();
    const id = a?.id ?? null;
    if (id !== this.lastActive) {
      if (a) this.ctx.bus.emit('festival:start', { id: a.id, name: a.name });
      else if (this.lastActive) this.ctx.bus.emit('festival:end', { id: this.lastActive });
      this.lastActive = id;
    }
  }

  newDay(): void {
    const f = this.today();
    if (f && f.id !== 'rainbow') this.ctx.toast(`Aujourd'hui : ${f.name} au village !`, f.icon, 'good');
  }

  hasPlayed(id: string): boolean {
    return this.ctx.state.festivals.attended[id] === this.ctx.state.time.day;
  }

  /** Reward a festival mini-game result. Score is normalized 0..100. */
  reward(id: string, score: number): { tokens: number; coins: number; best: boolean } {
    const st = this.ctx.state;
    const first = !this.hasPlayed(id);
    const tokens = Math.max(1, Math.round(score / 12)) + (first ? 3 : 0);
    const coins = Math.round(score * 6);
    this.ctx.economy.addTokens(tokens);
    this.ctx.economy.addCoins(coins);
    st.festivals.attended[id] = st.time.day;
    const best = score > (st.festivals.best[id] ?? 0);
    if (best) st.festivals.best[id] = score;
    if (first) this.ctx.progress('festival', id);
    this.ctx.economy.addXp(30 + score);
    return { tokens, coins, best };
  }
}
