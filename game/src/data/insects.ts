import type { Rarity, Season } from '../state/types';

export interface InsectDef {
  id: string;
  name: string;
  icon: string;
  regions: string[];
  seasons: Season[] | 'all';
  time: 'any' | 'day' | 'night';
  rarity: Rarity;
  sell: number;
  color: number;
  flying: boolean;
  rain?: boolean;
}

export const INSECTS: InsectDef[] = [
  { id: 'cabbage_white', name: 'Piéride', icon: '🦋', regions: ['farm', 'village'], seasons: ['spring', 'summer'], time: 'day', rarity: 'common', sell: 15, color: 0xffffff, flying: true },
  { id: 'peacock_butterfly', name: 'Paon-du-jour', icon: '🦋', regions: ['farm', 'woods'], seasons: ['summer'], time: 'day', rarity: 'uncommon', sell: 45, color: 0xd8503a, flying: true },
  { id: 'bluewing', name: 'Azuré céleste', icon: '🦋', regions: ['mountains', 'woods'], seasons: ['spring', 'summer'], time: 'day', rarity: 'uncommon', sell: 50, color: 0x6aa8ff, flying: true },
  { id: 'ladybug', name: 'Coccinelle', icon: '🐞', regions: ['farm', 'village', 'woods'], seasons: ['spring', 'summer', 'autumn'], time: 'day', rarity: 'common', sell: 18, color: 0xe83a3a, flying: false },
  { id: 'honeybee', name: 'Abeille', icon: '🐝', regions: ['farm', 'village'], seasons: ['spring', 'summer'], time: 'day', rarity: 'common', sell: 20, color: 0xffc42a, flying: true },
  { id: 'bumblebee', name: 'Bourdon velours', icon: '🐝', regions: ['farm', 'woods', 'mountains'], seasons: ['spring', 'summer'], time: 'day', rarity: 'uncommon', sell: 40, color: 0xffa02a, flying: true },
  { id: 'firefly', name: 'Luciole', icon: '✨', regions: ['farm', 'woods', 'village'], seasons: ['summer'], time: 'night', rarity: 'uncommon', sell: 55, color: 0xfff27a, flying: true },
  { id: 'snail', name: 'Escargot', icon: '🐌', regions: ['farm', 'village', 'woods'], seasons: ['spring', 'summer', 'autumn'], time: 'any', rarity: 'common', sell: 14, color: 0xc89a6a, flying: false, rain: true },
  { id: 'cricket', name: 'Grillon', icon: '🦗', regions: ['farm', 'village'], seasons: ['summer', 'autumn'], time: 'night', rarity: 'common', sell: 16, color: 0x6a5a3a, flying: false },
  { id: 'dragonfly', name: 'Libellule', icon: '🪰', regions: ['farm', 'woods', 'coast'], seasons: ['summer'], time: 'day', rarity: 'uncommon', sell: 48, color: 0x3ac8b8, flying: true },
  { id: 'stag_beetle', name: 'Lucane', icon: '🪲', regions: ['woods'], seasons: ['summer'], time: 'night', rarity: 'rare', sell: 180, color: 0x5a3a2a, flying: false },
  { id: 'moon_moth', name: 'Papillon lune', icon: '🦋', regions: ['woods', 'frosty'], seasons: ['summer', 'autumn'], time: 'night', rarity: 'epic', sell: 360, color: 0xb8ffcf, flying: true },
  { id: 'hermit_crab', name: 'Bernard-l\'ermite', icon: '🦀', regions: ['coast'], seasons: 'all', time: 'any', rarity: 'common', sell: 24, color: 0xff8a5a, flying: false },
  { id: 'sea_slug', name: 'Limace de mer', icon: '🐛', regions: ['coast'], seasons: ['summer'], time: 'day', rarity: 'rare', sell: 140, color: 0xb86aff, flying: false },
  { id: 'crystal_beetle', name: 'Scarabée cristal', icon: '🪲', regions: ['mountains', 'mine'], seasons: 'all', time: 'any', rarity: 'rare', sell: 200, color: 0x9ae8ff, flying: false },
  { id: 'snow_flea', name: 'Puce des neiges', icon: '❄️', regions: ['frosty'], seasons: 'all', time: 'day', rarity: 'uncommon', sell: 60, color: 0xe8f4ff, flying: false },
  { id: 'frost_butterfly', name: 'Papillon de givre', icon: '🦋', regions: ['frosty'], seasons: ['winter'], time: 'day', rarity: 'epic', sell: 320, color: 0xcfe8ff, flying: true },
  { id: 'ember_beetle', name: 'Scarabée braise', icon: '🪲', regions: ['ember'], seasons: 'all', time: 'any', rarity: 'rare', sell: 220, color: 0xff6a2a, flying: false },
  { id: 'ash_moth', name: 'Phalène de cendre', icon: '🦋', regions: ['ember'], seasons: 'all', time: 'night', rarity: 'uncommon', sell: 90, color: 0x9a8a8a, flying: true },
  { id: 'rainbow_beetle', name: 'Scarabée arc-en-ciel', icon: '🌈', regions: ['farm', 'village', 'woods', 'coast'], seasons: 'all', time: 'day', rarity: 'mythic', sell: 900, color: 0xff6adf, flying: false },
];

export const INSECT_BY_ID: Record<string, InsectDef> = Object.fromEntries(INSECTS.map((i) => [i.id, i]));
