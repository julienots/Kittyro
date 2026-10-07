import type { Ctx } from './Context';
import type { Season, WeatherType } from '../state/types';
import { seasonOfDay, dayOfSeason } from '../data/constants';
import { FESTIVALS } from '../data/festivals';

const TABLE: Record<Season, [WeatherType, number][]> = {
  spring: [['sun', 45], ['cloudy', 20], ['rain', 28], ['storm', 4], ['fog', 3]],
  summer: [['sun', 62], ['cloudy', 12], ['rain', 12], ['storm', 12], ['fog', 2]],
  autumn: [['sun', 35], ['cloudy', 25], ['rain', 22], ['fog', 15], ['storm', 3]],
  winter: [['snow', 45], ['cloudy', 25], ['sun', 20], ['fog', 10]],
};

export const WEATHER_NAMES: Record<WeatherType, string> = { sun: 'Ensoleillé', cloudy: 'Nuageux', rain: 'Pluie', storm: 'Orage', fog: 'Brouillard', snow: 'Neige' };
export const WEATHER_ICONS: Record<WeatherType, string> = { sun: '☀️', cloudy: '⛅', rain: '🌧️', storm: '⛈️', fog: '🌫️', snow: '❄️' };

export class WeatherSystem {
  constructor(private ctx: Ctx) {}

  roll(day: number): WeatherType {
    const season = seasonOfDay(day);
    const ds = dayOfSeason(day);
    const fest = FESTIVALS.find((f) => f.season === season && f.day === ds);
    if (fest) return season === 'winter' ? 'snow' : 'sun';
    if (day <= 2) return 'sun'; // gentle start
    const t = TABLE[season];
    return this.ctx.rng.weighted(t, (x) => x[1])![0];
  }

  isRaining(): boolean {
    const w = this.ctx.state.weather.current;
    return w === 'rain' || w === 'storm';
  }

  newDay(): void {
    const w = this.ctx.state.weather;
    w.today = w.tomorrow;
    w.tomorrow = this.roll(this.ctx.state.time.day + 1);
    w.current = w.today;
    // rainy days may clear up in the afternoon -> chance of rainbow
    w.clearAt = (w.today === 'rain' || w.today === 'storm') && this.ctx.rng.chance(0.45) ? this.ctx.rng.int(12 * 60, 16 * 60) : 0;
    this.ctx.bus.emit('weather:changed', { current: w.current });
  }

  /** Called every game minute from the time system. */
  tick(): void {
    const st = this.ctx.state;
    const w = st.weather;
    if (w.clearAt && st.time.minute >= w.clearAt && (w.current === 'rain' || w.current === 'storm')) {
      w.current = 'sun';
      w.clearAt = 0;
      // after the rain: rainbow!
      w.rainbowUntil = st.absMinute + 150;
      this.ctx.bus.emit('weather:changed', { current: w.current, rainbow: true });
      this.ctx.bus.emit('rainbow');
    }
    if (w.current === 'storm' && this.ctx.rng.chance(0.06)) {
      w.lightning = st.absMinute;
      this.ctx.bus.emit('lightning');
    }
  }

  rainbow(): boolean {
    return this.ctx.state.weather.rainbowUntil > this.ctx.state.absMinute;
  }
}
