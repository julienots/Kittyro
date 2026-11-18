import type { Season } from '../state/types';

/** Real seconds per game minute. A full day (6:00 -> 2:00) lasts 20 h * 60 * 0.6 = 12 real minutes. */
export const SECONDS_PER_GAME_MINUTE = 0.6;
export const DAY_START = 6 * 60; // 6:00
export const DAY_END = 26 * 60; // 2:00 next day
export const DAYS_PER_SEASON = 12;
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_NAMES: Record<Season, string> = {
  spring: 'Printemps',
  summer: 'Été',
  autumn: 'Automne',
  winter: 'Hiver',
};
export const SEASON_ICONS: Record<Season, string> = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
export const SAVE_VERSION = 4;
export const MAX_STACK = 999;
export const INVENTORY_START = 24;
export const INVENTORY_MAX = 48;
export const FRIEND_POINTS_PER_LEVEL = 100;
export const FRIEND_MAX = 1000;

export const TOOL_TIERS = ['Bois', 'Cuivre', 'Fer', 'Acier', 'Cristal'] as const;
export const TOOL_TIER_COLORS = [0xb98a5a, 0xd9844a, 0xb8c2cc, 0x7f95a8, 0x9fe8ff];

export function seasonOfDay(day: number): Season {
  return SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % 4];
}
export function dayOfSeason(day: number): number {
  return ((day - 1) % DAYS_PER_SEASON) + 1;
}
export function yearOfDay(day: number): number {
  return Math.floor((day - 1) / (DAYS_PER_SEASON * 4)) + 1;
}
export function weekOfDay(day: number): number {
  return Math.floor((day - 1) / 7);
}
export function formatClock(minute: number): string {
  const m = Math.floor(minute) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = Math.floor(m % 60 / 10) * 10;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}
export function isNight(minute: number): boolean {
  const m = minute % 1440;
  return m >= 20 * 60 || m < 5 * 60;
}
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.45));
}
