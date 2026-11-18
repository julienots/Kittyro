import type { Ctx } from './Context';
import { DAY_END, DAY_START, SECONDS_PER_GAME_MINUTE, seasonOfDay } from '../data/constants';
import { FRUIT_TREES } from '../data/resources';

/**
 * The game clock. 1 game minute = 0.6 s. Days run 6:00 -> 2:00.
 * At 2:00 the player simply falls asleep and wakes at home (no penalty — cozy!).
 */
export class TimeSystem {
  private acc = 0;
  paused = false;
  speed = 1;

  constructor(private ctx: Ctx) {}

  update(dt: number): void {
    if (this.paused) return;
    this.acc += (dt * this.speed) / SECONDS_PER_GAME_MINUTE;
    let steps = 0;
    while (this.acc >= 1 && steps < 600) {
      this.acc -= 1;
      steps++;
      this.advanceMinute();
      if (this.ctx.state.time.minute >= DAY_END) {
        this.ctx.bus.emit('day:end', { passedOut: true });
        this.sleep(true);
        break;
      }
    }
  }

  private advanceMinute(): void {
    const st = this.ctx.state;
    const prevHour = Math.floor(st.time.minute / 60);
    st.time.minute++;
    st.absMinute++;
    this.ctx.farming.tick(1);
    this.ctx.weather.tick();
    if (Math.floor(st.time.minute / 60) !== prevHour) this.ctx.bus.emit('hour', { hour: Math.floor(st.time.minute / 60) % 24 });
    this.ctx.festivals.tick();
  }

  /** Sleep until 6:00 next day. Crops keep growing overnight while watered. */
  sleep(passedOut = false): void {
    const st = this.ctx.state;
    const remaining = 24 * 60 + DAY_START - st.time.minute;
    // overnight growth
    this.ctx.farming.tick(Math.max(0, remaining));
    st.absMinute += Math.max(0, remaining);
    this.newDay();
    this.ctx.bus.emit('slept', { passedOut });
  }

  newDay(): void {
    const st = this.ctx.state;
    const prevSeason = seasonOfDay(st.time.day);
    st.time.day++;
    st.time.minute = DAY_START;
    this.ctx.weather.newDay();
    this.ctx.farming.newDay(this.ctx.weather.isRaining());
    this.ctx.animals.newDay();
    this.dailyFarm();
    this.ctx.hamlet.newDay();
    this.ctx.quests.refresh();
    this.ctx.festivals.newDay();
    const season = seasonOfDay(st.time.day);
    if (season !== prevSeason) {
      this.ctx.bus.emit('season', { season });
      if (season === 'spring') {
        // new Cozy Pass season every in-game year
        st.pass = { season: st.pass.season + 1, points: 0, premium: false, claimedFree: [], claimedPremium: [] };
      }
    }
    // wild hedgehog etc. reset, buffs expire naturally via absMinute
    this.ctx.bus.emit('day:start', { day: st.time.day });
  }

  /** Daily production on the farm: beehives, fountain gem... */
  private dailyFarm(): void {
    const st = this.ctx.state;
    const season = seasonOfDay(st.time.day);
    const hives = st.farm.placed.filter((p) => p.kind === 'beehive');
    if (season !== 'winter' && hives.length) {
      const flowers = Object.values(st.farm.plots).filter((p) => p.crop && ['tulip', 'sunflower', 'rose', 'frostbell', 'moonbloom'].includes(p.crop.id)).length;
      const bonus = st.village.florist?.restored ? 1 : 0;
      st.flags.honey = (st.flags.honey ?? 0) + hives.length * (st.time.day % 2 === 0 ? 1 + bonus + (flowers > 4 ? 1 : 0) : 0);
    }
    st.flags.fountainDay = 0;
    void FRUIT_TREES;
  }

  /** Offline catch-up: crops & nodes progress while the app is closed (capped to 12 game hours). */
  catchUp(realSeconds: number): number {
    const minutes = Math.min(720, Math.floor(realSeconds / SECONDS_PER_GAME_MINUTE / 4));
    if (minutes <= 0) return 0;
    this.ctx.farming.tick(minutes);
    this.ctx.state.absMinute += minutes;
    return minutes;
  }
}
