import type { Season } from '../state/types';

export interface FestivalDef {
  id: string;
  name: string;
  icon: string;
  season: Season | 'any';
  day: number; // day of season (0 = special trigger)
  from: number;
  to: number; // minutes
  desc: string;
  minigame: string;
  decor: string[]; // decor ids exchangeable with tokens
  color: number;
}

export const FESTIVALS: FestivalDef[] = [
  { id: 'flower', name: 'Festival des fleurs', icon: '🌸', season: 'spring', day: 7, from: 540, to: 1080, desc: 'Le village se couvre de fleurs. Concours de récolte dans les champs fleuris !', minigame: 'harvest', decor: ['rose_arch', 'flowerbed_red', 'planter'], color: 0xff9ac8 },
  { id: 'fireflies', name: 'Nuit des lucioles', icon: '🌙', season: 'summer', day: 5, from: 1200, to: 1500, desc: 'Des milliers de lucioles dansent sur la place. Course aux lanternes à travers le village !', minigame: 'lantern_run', decor: ['star_lantern', 'string_lights'], color: 0xfff27a },
  { id: 'harvest_market', name: 'Marché des récoltes', icon: '🍓', season: 'summer', day: 10, from: 480, to: 1080, desc: 'Grand marché d\'été : tenez votre stand et servez les clients !', minigame: 'market', decor: ['shell_lamp', 'parasol', 'balloons'], color: 0xff6a6a },
  { id: 'fishing_contest', name: 'Concours de pêche', icon: '🎣', season: 'autumn', day: 3, from: 360, to: 960, desc: 'Niko organise le grand concours : le plus gros poisson en 90 secondes !', minigame: 'fishing_contest', decor: ['surfboard', 'beach_chair'], color: 0x5ab8e8 },
  { id: 'pumpkin', name: 'Festival des citrouilles', icon: '🎃', season: 'autumn', day: 9, from: 900, to: 1440, desc: 'Citrouilles-lanternes, costumes et lancer d\'anneaux sur les citrouilles !', minigame: 'toss', decor: ['jack_lantern', 'cauldron', 'ghost_balloon', 'candy_lamp'], color: 0xff8c1a },
  { id: 'snow', name: 'Festival de neige', icon: '❄️', season: 'winter', day: 6, from: 540, to: 1260, desc: 'Sculptures de glace, chocolat chaud et grande course de moutons !', minigame: 'animal_race', decor: ['winter_tree', 'ice_sculpture', 'snowman'], color: 0xbfe0ff },
  { id: 'rainbow', name: 'Journée de l\'arc-en-ciel', icon: '🌈', season: 'any', day: 0, from: 360, to: 1200, desc: 'Après une grosse pluie, un arc-en-ciel géant apparaît. Les créatures rares se montrent !', minigame: 'none', decor: ['rainbow_arch', 'pinwheel', 'flag_garland'], color: 0xff6adf },
];
export const FESTIVAL_BY_ID: Record<string, FestivalDef> = Object.fromEntries(FESTIVALS.map((f) => [f.id, f]));
