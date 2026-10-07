import type { Season } from '../state/types';

export type CropShape = 'grain' | 'leafy' | 'root' | 'bush' | 'ground' | 'flower' | 'tall';

export interface CropDef {
  id: string;
  name: string;
  seedName: string;
  icon: string;
  seasons: Season[];
  /** game minutes of watered growth until first harvest */
  grow: number;
  /** if set, crop regrows after harvest in this many minutes */
  regrow?: number;
  seedPrice: number;
  sell: number;
  yield: [number, number];
  shape: CropShape;
  color: number; // produce color
  leaf: number; // foliage color
  xp: number;
  unlockLevel: number;
  flower?: boolean;
}

// Growth times are tuned for short mobile sessions: a lettuce can be harvested in
// about 5 real minutes, a pumpkin over a couple of in-game days.
export const CROPS: CropDef[] = [
  { id: 'lettuce', name: 'Salade', seedName: 'Graines de salade', icon: '🥬', seasons: ['spring', 'autumn'], grow: 480, seedPrice: 8, sell: 16, yield: [1, 1], shape: 'leafy', color: 0x8fd14f, leaf: 0x6cbf3c, xp: 6, unlockLevel: 1 },
  { id: 'carrot', name: 'Carotte', seedName: 'Graines de carotte', icon: '🥕', seasons: ['spring', 'autumn'], grow: 720, seedPrice: 12, sell: 26, yield: [1, 2], shape: 'root', color: 0xff8a2a, leaf: 0x58b444, xp: 8, unlockLevel: 1 },
  { id: 'wheat', name: 'Blé', seedName: 'Graines de blé', icon: '🌾', seasons: ['spring', 'summer', 'autumn'], grow: 840, seedPrice: 6, sell: 14, yield: [2, 3], shape: 'grain', color: 0xf2cd5c, leaf: 0x9ccc4a, xp: 6, unlockLevel: 1 },
  { id: 'potato', name: 'Pomme de terre', seedName: 'Plants de pomme de terre', icon: '🥔', seasons: ['spring'], grow: 960, seedPrice: 14, sell: 32, yield: [2, 3], shape: 'root', color: 0xc99a5b, leaf: 0x4f9e3c, xp: 10, unlockLevel: 2 },
  { id: 'tulip', name: 'Tulipe', seedName: 'Bulbes de tulipe', icon: '🌷', seasons: ['spring'], grow: 600, seedPrice: 15, sell: 34, yield: [1, 1], shape: 'flower', color: 0xff6f9c, leaf: 0x5cb85c, xp: 9, unlockLevel: 1, flower: true },
  { id: 'strawberry', name: 'Fraise', seedName: 'Graines de fraise', icon: '🍓', seasons: ['spring', 'summer'], grow: 1200, regrow: 600, seedPrice: 30, sell: 30, yield: [2, 3], shape: 'bush', color: 0xff3b4e, leaf: 0x4caf50, xp: 12, unlockLevel: 2 },
  { id: 'tomato', name: 'Tomate', seedName: 'Graines de tomate', icon: '🍅', seasons: ['summer'], grow: 1080, regrow: 600, seedPrice: 24, sell: 28, yield: [1, 3], shape: 'tall', color: 0xf0453a, leaf: 0x4f9e3c, xp: 12, unlockLevel: 2 },
  { id: 'corn', name: 'Maïs', seedName: 'Graines de maïs', icon: '🌽', seasons: ['summer', 'autumn'], grow: 1320, regrow: 720, seedPrice: 28, sell: 34, yield: [1, 2], shape: 'tall', color: 0xffd23f, leaf: 0x7fbf3f, xp: 14, unlockLevel: 3 },
  { id: 'blueberry', name: 'Myrtille', seedName: 'Graines de myrtille', icon: '🫐', seasons: ['summer'], grow: 1200, regrow: 600, seedPrice: 40, sell: 22, yield: [3, 4], shape: 'bush', color: 0x4f63d9, leaf: 0x3f8f4c, xp: 14, unlockLevel: 3 },
  { id: 'sunflower', name: 'Tournesol', seedName: 'Graines de tournesol', icon: '🌻', seasons: ['summer', 'autumn'], grow: 1080, seedPrice: 30, sell: 70, yield: [1, 1], shape: 'flower', color: 0xffc62a, leaf: 0x5ca843, xp: 16, unlockLevel: 2, flower: true },
  { id: 'watermelon', name: 'Pastèque', seedName: 'Graines de pastèque', icon: '🍉', seasons: ['summer'], grow: 1800, seedPrice: 60, sell: 170, yield: [1, 1], shape: 'ground', color: 0x3fa34d, leaf: 0x58a845, xp: 26, unlockLevel: 4 },
  { id: 'pumpkin', name: 'Citrouille', seedName: 'Graines de citrouille', icon: '🎃', seasons: ['autumn'], grow: 1800, seedPrice: 60, sell: 180, yield: [1, 1], shape: 'ground', color: 0xff8c1a, leaf: 0x5f9e3a, xp: 26, unlockLevel: 3 },
  { id: 'rose', name: 'Rose', seedName: 'Graines de rose', icon: '🌹', seasons: ['summer', 'autumn'], grow: 960, seedPrice: 35, sell: 80, yield: [1, 1], shape: 'flower', color: 0xe8264a, leaf: 0x3f8f3c, xp: 15, unlockLevel: 4, flower: true },
  { id: 'kale', name: 'Chou d\'hiver', seedName: 'Graines de chou', icon: '🥦', seasons: ['winter'], grow: 900, seedPrice: 20, sell: 46, yield: [1, 2], shape: 'leafy', color: 0x3d8f4f, leaf: 0x3d8f4f, xp: 12, unlockLevel: 1 },
  { id: 'garlic', name: 'Ail', seedName: 'Caïeux d\'ail', icon: '🧄', seasons: ['winter', 'spring'], grow: 720, seedPrice: 16, sell: 30, yield: [1, 2], shape: 'root', color: 0xf3ecdc, leaf: 0x7ab35a, xp: 9, unlockLevel: 1 },
  { id: 'frostbell', name: 'Clochette de givre', seedName: 'Graines de clochette', icon: '🪻', seasons: ['winter'], grow: 1080, seedPrice: 40, sell: 95, yield: [1, 1], shape: 'flower', color: 0x9ab8ff, leaf: 0x6aa58a, xp: 18, unlockLevel: 3, flower: true },
  { id: 'moonbloom', name: 'Fleur de lune', seedName: 'Graines de lune', icon: '💮', seasons: ['spring', 'summer', 'autumn', 'winter'], grow: 2400, seedPrice: 120, sell: 420, yield: [1, 1], shape: 'flower', color: 0xd8c8ff, leaf: 0x6fa8a0, xp: 40, unlockLevel: 7, flower: true },
];

export const CROP_BY_ID: Record<string, CropDef> = Object.fromEntries(CROPS.map((c) => [c.id, c]));
export const seedId = (cropId: string) => `seed_${cropId}`;
export const STAGES = 5; // 0 seed, 1 sprout, 2 young, 3 grown, 4 ready

export function cropStage(def: CropDef, growth: number, harvests: number): number {
  const total = harvests > 0 && def.regrow ? def.regrow : def.grow;
  const t = Math.min(1, growth / total);
  if (t >= 1) return 4;
  if (harvests > 0 && def.regrow) return 3; // regrowing bushes stay leafy
  return Math.min(3, Math.floor(t * 4));
}
