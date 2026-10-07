import type { Rarity, Season, WeatherType } from '../state/types';

export interface FishDef {
  id: string;
  name: string;
  icon: string;
  regions: string[]; // region ids where it can bite ('farm' = farm pond/river)
  seasons: Season[] | 'all';
  time: 'any' | 'day' | 'night' | 'dawn' | 'dusk';
  weather?: WeatherType[];
  rarity: Rarity;
  size: [number, number]; // cm
  difficulty: number; // 1..10
  sell: number;
  color: number;
}

const ALL = 'all' as const;
export const FISH: FishDef[] = [
  // Green Valley rivers & farm pond
  { id: 'minnow', name: 'Vairon', icon: '🐟', regions: ['farm', 'village', 'woods'], seasons: ALL, time: 'any', rarity: 'common', size: [4, 9], difficulty: 1, sell: 12, color: 0x9fb8c8 },
  { id: 'perch', name: 'Perche dorée', icon: '🐟', regions: ['farm', 'village'], seasons: ['spring', 'summer', 'autumn'], time: 'day', rarity: 'common', size: [15, 35], difficulty: 3, sell: 30, color: 0xd6b54a },
  { id: 'carp', name: 'Carpe ronde', icon: '🐟', regions: ['farm', 'village', 'woods'], seasons: ALL, time: 'any', rarity: 'common', size: [25, 70], difficulty: 2, sell: 34, color: 0xa88a5a },
  { id: 'trout', name: 'Truite arc-en-ciel', icon: '🐟', regions: ['farm', 'woods', 'mountains'], seasons: ['spring', 'summer'], time: 'day', rarity: 'uncommon', size: [20, 55], difficulty: 4, sell: 60, color: 0xff9fb0 },
  { id: 'catfish', name: 'Poisson-chat moustachu', icon: '🐟', regions: ['farm', 'woods'], seasons: ['spring', 'autumn'], time: 'night', weather: ['rain', 'storm'], rarity: 'rare', size: [40, 110], difficulty: 6, sell: 160, color: 0x6a6a58 },
  { id: 'sunfish', name: 'Poisson-soleil', icon: '🐠', regions: ['farm', 'village'], seasons: ['summer'], time: 'day', weather: ['sun'], rarity: 'uncommon', size: [8, 20], difficulty: 3, sell: 55, color: 0xffb02e },
  { id: 'pondloach', name: 'Loche des mares', icon: '🐟', regions: ['farm'], seasons: ['spring', 'summer'], time: 'dusk', rarity: 'uncommon', size: [8, 18], difficulty: 3, sell: 48, color: 0x8a7a5a },
  { id: 'moss_eel', name: 'Anguille mousse', icon: '🐍', regions: ['farm', 'woods'], seasons: ['autumn', 'winter'], time: 'night', rarity: 'rare', size: [50, 120], difficulty: 7, sell: 190, color: 0x5a8a4a },
  // Whispering Woods
  { id: 'leaf_guppy', name: 'Guppy-feuille', icon: '🐠', regions: ['woods'], seasons: ['spring', 'summer'], time: 'any', rarity: 'common', size: [3, 7], difficulty: 2, sell: 22, color: 0x7fd36a },
  { id: 'shadow_pike', name: 'Brochet d\'ombre', icon: '🐟', regions: ['woods'], seasons: ['autumn', 'winter'], time: 'dusk', rarity: 'rare', size: [50, 120], difficulty: 7, sell: 210, color: 0x3a4a5a },
  { id: 'firefly_tetra', name: 'Tétra luciole', icon: '✨', regions: ['woods'], seasons: ['summer'], time: 'night', rarity: 'epic', size: [3, 6], difficulty: 6, sell: 320, color: 0xfff27a },
  { id: 'mushroom_koi', name: 'Koï champignon', icon: '🍄', regions: ['woods'], seasons: ['autumn'], time: 'day', weather: ['rain', 'fog'], rarity: 'epic', size: [30, 70], difficulty: 7, sell: 380, color: 0xe85a4a },
  // Crystal Mountains
  { id: 'glacier_char', name: 'Omble des glaciers', icon: '🐟', regions: ['mountains', 'frosty'], seasons: ALL, time: 'any', rarity: 'uncommon', size: [20, 50], difficulty: 5, sell: 75, color: 0x8ec8e8 },
  { id: 'quartz_minnow', name: 'Vairon de quartz', icon: '💎', regions: ['mountains', 'mine'], seasons: ALL, time: 'any', rarity: 'rare', size: [4, 10], difficulty: 6, sell: 150, color: 0xe8f4ff },
  { id: 'cave_blindfish', name: 'Poisson des cavernes', icon: '🐟', regions: ['mine'], seasons: ALL, time: 'any', rarity: 'uncommon', size: [8, 20], difficulty: 4, sell: 85, color: 0xf2e6f0 },
  { id: 'geode_crab', name: 'Crabe géode', icon: '🦀', regions: ['mine'], seasons: ALL, time: 'any', rarity: 'epic', size: [10, 25], difficulty: 8, sell: 420, color: 0x9a6ad8 },
  // Sunny Coast
  { id: 'sardine', name: 'Sardine', icon: '🐟', regions: ['coast'], seasons: ALL, time: 'day', rarity: 'common', size: [10, 20], difficulty: 2, sell: 20, color: 0xb8c8d8 },
  { id: 'anchovy', name: 'Anchois', icon: '🐟', regions: ['coast'], seasons: ['spring', 'summer'], time: 'any', rarity: 'common', size: [8, 16], difficulty: 2, sell: 18, color: 0xa8b8c8 },
  { id: 'clownfish', name: 'Poisson-clown', icon: '🐠', regions: ['coast'], seasons: ['summer'], time: 'day', rarity: 'uncommon', size: [7, 12], difficulty: 4, sell: 70, color: 0xff7a2a },
  { id: 'pufferfish', name: 'Poisson-ballon', icon: '🐡', regions: ['coast'], seasons: ['summer', 'autumn'], time: 'day', weather: ['sun'], rarity: 'uncommon', size: [15, 35], difficulty: 5, sell: 90, color: 0xe8d070 },
  { id: 'octopus', name: 'Petit poulpe', icon: '🐙', regions: ['coast'], seasons: ['summer', 'autumn'], time: 'night', rarity: 'rare', size: [30, 80], difficulty: 7, sell: 230, color: 0xe86a8a },
  { id: 'squid', name: 'Calamar', icon: '🦑', regions: ['coast'], seasons: ['winter'], time: 'night', rarity: 'uncommon', size: [25, 60], difficulty: 5, sell: 95, color: 0xf0d8d8 },
  { id: 'tuna', name: 'Thon bleu', icon: '🐟', regions: ['coast'], seasons: ['summer', 'winter'], time: 'day', rarity: 'rare', size: [60, 180], difficulty: 8, sell: 260, color: 0x3a5a9a },
  { id: 'starfish_ray', name: 'Raie étoilée', icon: '🌟', regions: ['coast'], seasons: ['autumn'], time: 'dusk', rarity: 'epic', size: [50, 120], difficulty: 8, sell: 450, color: 0x8a9ad8 },
  { id: 'shell_turtle', name: 'Tortue à coquillages', icon: '🐢', regions: ['coast'], seasons: ['spring'], time: 'dawn', rarity: 'epic', size: [30, 60], difficulty: 6, sell: 400, color: 0x6aa85a },
  { id: 'storm_marlin', name: 'Marlin de l\'orage', icon: '🐟', regions: ['coast'], seasons: ALL, time: 'any', weather: ['storm'], rarity: 'mythic', size: [150, 300], difficulty: 10, sell: 1500, color: 0x2a4a8a },
  // Frosty Peaks
  { id: 'ice_cod', name: 'Morue des glaces', icon: '🐟', regions: ['frosty'], seasons: ALL, time: 'any', rarity: 'common', size: [25, 60], difficulty: 3, sell: 45, color: 0xc8dce8 },
  { id: 'snow_salmon', name: 'Saumon des neiges', icon: '🐟', regions: ['frosty'], seasons: ['winter', 'autumn'], time: 'day', rarity: 'uncommon', size: [40, 90], difficulty: 5, sell: 110, color: 0xffa08a },
  { id: 'aurora_fish', name: 'Poisson aurore', icon: '🌌', regions: ['frosty'], seasons: ['winter'], time: 'night', weather: ['snow'], rarity: 'mythic', size: [30, 50], difficulty: 9, sell: 1200, color: 0x7affd0 },
  { id: 'crystal_jelly', name: 'Méduse de cristal', icon: '🪼', regions: ['frosty', 'coast'], seasons: ['winter'], time: 'night', rarity: 'rare', size: [10, 30], difficulty: 6, sell: 240, color: 0xc8e8ff },
  // Ember Valley
  { id: 'magma_goby', name: 'Gobie de magma', icon: '🔥', regions: ['ember'], seasons: ALL, time: 'any', rarity: 'uncommon', size: [8, 18], difficulty: 5, sell: 120, color: 0xff5a2a },
  { id: 'obsidian_eel', name: 'Anguille d\'obsidienne', icon: '🐍', regions: ['ember'], seasons: ALL, time: 'night', rarity: 'rare', size: [60, 140], difficulty: 8, sell: 300, color: 0x2a2030 },
  { id: 'phoenix_koi', name: 'Koï phénix', icon: '🐉', regions: ['ember'], seasons: ['summer'], time: 'dusk', rarity: 'mythic', size: [50, 90], difficulty: 10, sell: 1800, color: 0xffb030 },
  { id: 'ember_shrimp', name: 'Crevette braise', icon: '🦐', regions: ['ember'], seasons: ALL, time: 'day', rarity: 'common', size: [4, 9], difficulty: 3, sell: 60, color: 0xff7a5a },
  // Rain specials everywhere
  { id: 'rain_frogfish', name: 'Poisson-grenouille', icon: '🐸', regions: ['farm', 'village', 'woods', 'coast'], seasons: ['spring', 'summer'], time: 'any', weather: ['rain'], rarity: 'uncommon', size: [10, 25], difficulty: 4, sell: 80, color: 0x6ac85a },
  { id: 'old_boot', name: 'Vieille botte', icon: '🥾', regions: ['farm', 'village', 'woods', 'coast', 'mountains'], seasons: ALL, time: 'any', rarity: 'common', size: [25, 30], difficulty: 1, sell: 2, color: 0x6a4a3a },
];

export const FISH_BY_ID: Record<string, FishDef> = Object.fromEntries(FISH.map((f) => [f.id, f]));
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 26, rare: 10, epic: 3.3, mythic: 0.7 };
export const RARITY_COLOR: Record<Rarity, string> = { common: '#9aa8a0', uncommon: '#5fbf6a', rare: '#4fa3ff', epic: '#b06aff', mythic: '#ffb02e' };
export const RARITY_NAME: Record<Rarity, string> = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', epic: 'Épique', mythic: 'Mythique' };
