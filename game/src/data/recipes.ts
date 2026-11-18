export type Station = 'hand' | 'workbench' | 'forge' | 'kitchen' | 'mill' | 'dairy' | 'bakery';
export type RecipeCat = 'agri' | 'build' | 'furniture' | 'cooking' | 'tools' | 'decor' | 'material';

export interface DishDef {
  id: string;
  name: string;
  icon: string;
  sell: number;
  buff?: { id: 'speed' | 'luck' | 'fishing' | 'gather' | 'growth'; minutes: number };
  desc: string;
}

export const BUFF_NAMES: Record<string, string> = {
  speed: 'Pas léger (+35% vitesse)',
  luck: 'Chance (+ créatures rares)',
  fishing: 'Pêche zen (zone +20%)',
  gather: 'Récolte généreuse (×2 chance)',
  growth: 'Main verte (+ croissance)',
};
export const BUFF_ICONS: Record<string, string> = { speed: '👟', luck: '🍀', fishing: '🎣', gather: '🧺', growth: '🌱' };

export const DISHES: DishDef[] = [
  { id: 'bread', name: 'Pain de campagne', icon: '🥖', sell: 70, buff: { id: 'speed', minutes: 120 }, desc: 'Croustillant et doré.' },
  { id: 'cookies', name: 'Cookies', icon: '🍪', sell: 90, buff: { id: 'luck', minutes: 120 }, desc: 'Aux pépites de bonheur.' },
  { id: 'berry_pie', name: 'Tarte aux fruits', icon: '🥧', sell: 260, buff: { id: 'gather', minutes: 240 }, desc: 'La spécialité du dimanche.' },
  { id: 'jam', name: 'Confiture', icon: '🍓', sell: 120, desc: 'Fraises ou myrtilles, mijotées doucement.' },
  { id: 'veggie_soup', name: 'Soupe du potager', icon: '🍲', sell: 140, buff: { id: 'growth', minutes: 240 }, desc: 'Réchauffe les jours de pluie.' },
  { id: 'salad', name: 'Salade fraîche', icon: '🥗', sell: 80, buff: { id: 'speed', minutes: 90 }, desc: 'Croquante et légère.' },
  { id: 'pizza', name: 'Pizza du village', icon: '🍕', sell: 300, buff: { id: 'gather', minutes: 180 }, desc: 'À partager avec les amis.' },
  { id: 'cupcake', name: 'Cupcake', icon: '🧁', sell: 150, buff: { id: 'luck', minutes: 180 }, desc: 'Avec un nuage de crème.' },
  { id: 'pancakes', name: 'Pancakes au miel', icon: '🥞', sell: 200, buff: { id: 'speed', minutes: 240 }, desc: 'Le petit-déjeuner des champions.' },
  { id: 'omelette', name: 'Omelette', icon: '🍳', sell: 90, buff: { id: 'gather', minutes: 90 }, desc: 'Baveuse à souhait.' },
  { id: 'carrot_cake', name: 'Gâteau aux carottes', icon: '🍰', sell: 220, buff: { id: 'luck', minutes: 240 }, desc: 'Moelleux et épicé.' },
  { id: 'pumpkin_pie', name: 'Tarte à la citrouille', icon: '🥧', sell: 420, buff: { id: 'luck', minutes: 360 }, desc: 'Le goût de l\'automne.' },
  { id: 'fish_stew', name: 'Bouillabaisse', icon: '🍜', sell: 280, buff: { id: 'fishing', minutes: 300 }, desc: 'Recette secrète de Niko.' },
  { id: 'grilled_fish', name: 'Poisson grillé', icon: '🐟', sell: 110, buff: { id: 'fishing', minutes: 150 }, desc: 'Simple et délicieux.' },
  { id: 'smoothie', name: 'Smoothie aux baies', icon: '🥤', sell: 130, buff: { id: 'speed', minutes: 180 }, desc: 'Plein de vitamines.' },
  { id: 'corn_bread', name: 'Pain de maïs', icon: '🍞', sell: 160, buff: { id: 'growth', minutes: 180 }, desc: 'Doré et sucré.' },
  { id: 'honey_tea', name: 'Thé au miel', icon: '🍵', sell: 140, buff: { id: 'luck', minutes: 200 }, desc: 'Parfait pour les soirées fraîches.' },
  { id: 'risotto', name: 'Risotto forestier', icon: '🍛', sell: 340, buff: { id: 'gather', minutes: 300 }, desc: 'Aux girolles de Whispering Woods.' },
  { id: 'fries', name: 'Frites dorées', icon: '🍟', sell: 110, buff: { id: 'speed', minutes: 120 }, desc: 'Croustillantes.' },
  { id: 'watermelon_sorbet', name: 'Sorbet pastèque', icon: '🍧', sell: 380, buff: { id: 'speed', minutes: 360 }, desc: 'Fraîcheur d\'été.' },
  { id: 'hot_cocoa', name: 'Chocolat chaud', icon: '☕', sell: 160, buff: { id: 'fishing', minutes: 240 }, desc: 'Avec des guimauves.' },
  { id: 'sushi', name: 'Maki de la côte', icon: '🍣', sell: 260, buff: { id: 'fishing', minutes: 360 }, desc: 'Algue, riz et poisson frais.' },
  { id: 'garlic_bread', name: 'Pain à l\'ail', icon: '🥖', sell: 150, buff: { id: 'gather', minutes: 150 }, desc: 'Parfumé.' },
  { id: 'ember_curry', name: 'Curry de braise', icon: '🍛', sell: 480, buff: { id: 'luck', minutes: 480 }, desc: 'Ça pique (gentiment).' },
  { id: 'cider', name: 'Cidre de pomme', icon: '🧃', sell: 120, buff: { id: 'speed', minutes: 150 }, desc: 'Pétillant, servi à la taverne du hameau.' },
  { id: 'veggie_pie', name: 'Tourte du hameau', icon: '🥧', sell: 230, buff: { id: 'gather', minutes: 200 }, desc: 'Carottes, pommes de terre et beurre doré.' },
  { id: 'roasted_corn', name: 'Maïs grillé', icon: '🌽', sell: 90, buff: { id: 'growth', minutes: 120 }, desc: 'Au feu de camp, avec un peu de beurre.' },
  { id: 'hamlet_stew', name: 'Ragoût de Clairefontaine', icon: '🥘', sell: 260, buff: { id: 'luck', minutes: 240 }, desc: 'La recette secrète des villageois.' },
  { id: 'moon_cake', name: 'Gâteau de lune', icon: '🥮', sell: 900, buff: { id: 'luck', minutes: 720 }, desc: 'Une légende du village.' },
];
export const DISH_BY_ID: Record<string, DishDef> = Object.fromEntries(DISHES.map((d) => [d.id, d]));

export interface RecipeDef {
  id: string;
  out: string;
  qty: number;
  station: Station;
  cat: RecipeCat;
  ing: [string, number][];
  /** how it is unlocked; known from start if omitted */
  unlock?: { level?: number; npc?: string; friend?: number; village?: string; story?: number };
}

const R = (id: string, out: string, qty: number, station: Station, cat: RecipeCat, ing: [string, number][], unlock?: RecipeDef['unlock']): RecipeDef => ({ id, out, qty, station, cat, ing, unlock });

export const RECIPES: RecipeDef[] = [
  // materials
  R('plank', 'plank', 2, 'workbench', 'material', [['wood', 3]]),
  R('rope', 'rope', 2, 'hand', 'material', [['fiber', 4]]),
  R('brick', 'brick', 2, 'forge', 'material', [['clay', 2], ['coal', 1]]),
  R('glass', 'glass', 2, 'forge', 'material', [['stone', 3], ['coal', 1]]),
  R('copper_bar', 'copper_bar', 1, 'forge', 'material', [['copper_ore', 3], ['coal', 1]]),
  R('iron_bar', 'iron_bar', 1, 'forge', 'material', [['iron_ore', 3], ['coal', 1]], { level: 3 }),
  R('gold_bar', 'gold_bar', 1, 'forge', 'material', [['gold_ore', 3], ['coal', 1]], { level: 5 }),
  R('steel_bar', 'steel_bar', 1, 'forge', 'material', [['iron_bar', 2], ['coal', 3]], { level: 6 }),
  R('flour', 'flour', 1, 'mill', 'material', [['wheat', 2]]),
  R('sugar', 'sugar', 1, 'mill', 'material', [['corn', 1]]),
  R('cheese', 'cheese', 1, 'dairy', 'material', [['milk', 2]]),
  R('goat_cheese', 'cheese', 2, 'dairy', 'material', [['goat_milk', 2]]),
  R('butter', 'butter', 1, 'dairy', 'material', [['milk', 1]]),
  R('cloth', 'cloth', 1, 'dairy', 'material', [['wool', 1]]),
  R('cloth_fluff', 'cloth', 2, 'dairy', 'material', [['fluff', 1]]),
  // agriculture
  R('fertilizer', 'fertilizer', 5, 'hand', 'agri', [['fiber', 5], ['sap', 1]]),
  R('deluxe_fertilizer', 'deluxe_fertilizer', 3, 'workbench', 'agri', [['fertilizer', 3], ['crystal_shard', 1]], { level: 5 }),
  R('bait', 'bait', 5, 'hand', 'agri', [['fiber', 2], ['wild_berry', 1]]),
  R('magic_bait', 'magic_bait', 3, 'workbench', 'agri', [['bait', 5], ['glowcap', 1]], { level: 6 }),
  R('animal_treat', 'animal_treat', 3, 'kitchen', 'agri', [['wheat', 2], ['wild_berry', 2]]),
  R('warm_coat', 'warm_coat', 1, 'workbench', 'tools', [['cloth', 3], ['wool', 2], ['rope', 2]], { story: 13 }),
  // cooking
  R('bread', 'bread', 1, 'kitchen', 'cooking', [['flour', 2], ['egg', 1]]),
  R('cookies', 'cookies', 2, 'kitchen', 'cooking', [['flour', 1], ['sugar', 1], ['butter', 1]], { village: 'bakery' }),
  R('berry_pie', 'berry_pie', 1, 'kitchen', 'cooking', [['flour', 1], ['strawberry', 3], ['sugar', 1]], { village: 'bakery' }),
  R('jam', 'jam', 1, 'kitchen', 'cooking', [['strawberry', 3], ['sugar', 1]]),
  R('jam_blue', 'jam', 1, 'kitchen', 'cooking', [['blueberry', 4], ['sugar', 1]]),
  R('veggie_soup', 'veggie_soup', 1, 'kitchen', 'cooking', [['carrot', 1], ['potato', 1], ['lettuce', 1]]),
  R('salad', 'salad', 1, 'kitchen', 'cooking', [['lettuce', 2], ['tomato', 1]]),
  R('pizza', 'pizza', 1, 'kitchen', 'cooking', [['flour', 2], ['tomato', 2], ['cheese', 1]], { village: 'bakery' }),
  R('cupcake', 'cupcake', 2, 'kitchen', 'cooking', [['flour', 1], ['sugar', 1], ['egg', 1], ['butter', 1]], { village: 'bakery' }),
  R('pancakes', 'pancakes', 1, 'kitchen', 'cooking', [['flour', 1], ['egg', 1], ['milk', 1], ['honey', 1]]),
  R('omelette', 'omelette', 1, 'kitchen', 'cooking', [['egg', 2], ['milk', 1]]),
  R('carrot_cake', 'carrot_cake', 1, 'kitchen', 'cooking', [['carrot', 3], ['flour', 1], ['sugar', 1], ['egg', 1]], { npc: 'brie', friend: 2 }),
  R('pumpkin_pie', 'pumpkin_pie', 1, 'kitchen', 'cooking', [['pumpkin', 1], ['flour', 1], ['sugar', 1], ['butter', 1]], { npc: 'brie', friend: 4 }),
  R('fish_stew', 'fish_stew', 1, 'kitchen', 'cooking', [['sardine', 2], ['tomato', 1], ['garlic', 1]], { npc: 'niko', friend: 3 }),
  R('grilled_fish', 'grilled_fish', 1, 'kitchen', 'cooking', [['minnow', 1], ['herb', 1]]),
  R('grilled_fish2', 'grilled_fish', 1, 'kitchen', 'cooking', [['perch', 1]]),
  R('smoothie', 'smoothie', 1, 'kitchen', 'cooking', [['wild_berry', 3], ['milk', 1]]),
  R('corn_bread', 'corn_bread', 1, 'kitchen', 'cooking', [['corn', 2], ['flour', 1], ['egg', 1]], { level: 4 }),
  R('honey_tea', 'honey_tea', 1, 'kitchen', 'cooking', [['honey', 1], ['mint', 1]], { npc: 'moss', friend: 2 }),
  R('risotto', 'risotto', 1, 'kitchen', 'cooking', [['chanterelle', 2], ['butter', 1], ['cheese', 1]], { npc: 'bibi', friend: 3 }),
  R('fries', 'fries', 1, 'kitchen', 'cooking', [['potato', 2], ['butter', 1]]),
  R('watermelon_sorbet', 'watermelon_sorbet', 2, 'kitchen', 'cooking', [['watermelon', 1], ['sugar', 1], ['mint', 1]], { level: 5 }),
  R('hot_cocoa', 'hot_cocoa', 1, 'kitchen', 'cooking', [['milk', 2], ['sugar', 1]], { level: 3 }),
  R('sushi', 'sushi', 2, 'kitchen', 'cooking', [['seaweed', 1], ['tuna', 1]], { npc: 'niko', friend: 5 }),
  R('sushi2', 'sushi', 1, 'kitchen', 'cooking', [['seaweed', 1], ['sardine', 2]], { npc: 'niko', friend: 5 }),
  R('garlic_bread', 'garlic_bread', 2, 'kitchen', 'cooking', [['flour', 1], ['garlic', 2], ['butter', 1]]),
  R('ember_curry', 'ember_curry', 1, 'kitchen', 'cooking', [['fire_pepper', 2], ['potato', 1], ['carrot', 1]], { level: 7 }),
  R('moon_cake', 'moon_cake', 1, 'kitchen', 'cooking', [['moonbloom', 1], ['flour', 2], ['honey', 1], ['egg', 1]], { level: 8 }),
  // hamlet
  R('timber', 'timber', 1, 'workbench', 'material', [['wood', 4]]),
  R('cut_stone', 'cut_stone', 1, 'workbench', 'material', [['stone', 5]]),
  R('thatch', 'thatch', 1, 'hand', 'material', [['fiber', 4], ['hay', 2]]),
  R('wicker_basket', 'wicker_basket', 1, 'hand', 'material', [['fiber', 8]]),
  R('cider', 'cider', 1, 'kitchen', 'cooking', [['apple', 2], ['sugar', 1]]),
  R('veggie_pie', 'veggie_pie', 1, 'kitchen', 'cooking', [['flour', 1], ['carrot', 1], ['potato', 1], ['butter', 1]]),
  R('roasted_corn', 'roasted_corn', 1, 'kitchen', 'cooking', [['corn', 2]]),
  R('hamlet_stew', 'hamlet_stew', 1, 'kitchen', 'cooking', [['potato', 2], ['kale', 1], ['herb', 1]]),
  R('c_path_cobble', 'path_cobble', 6, 'workbench', 'decor', [['cut_stone', 1]]),
  R('c_lantern_blue', 'lantern_blue', 1, 'workbench', 'decor', [['timber', 1], ['glass', 1], ['copper_bar', 1]]),
  R('c_banner', 'hamlet_banner', 1, 'workbench', 'decor', [['cloth', 1], ['timber', 1]]),
  R('c_fox_statue', 'fox_statue', 1, 'workbench', 'decor', [['cut_stone', 6]], { level: 4 }),
  R('c_candles', 'candles', 1, 'workbench', 'decor', [['beeswax', 2]]),
  R('c_flowerbed_purple', 'flowerbed_purple', 2, 'workbench', 'decor', [['fiber', 2], ['tulip', 1]]),
  // furniture & decor crafted at the workbench
  R('c_fence_wood', 'fence_wood', 4, 'workbench', 'decor', [['wood', 4]]),
  R('c_fence_stone', 'fence_stone', 3, 'workbench', 'decor', [['stone', 6]]),
  R('c_path_stone', 'path_stone', 6, 'workbench', 'decor', [['stone', 4]]),
  R('c_path_wood', 'path_wood', 6, 'workbench', 'decor', [['wood', 4]]),
  R('c_path_brick', 'path_brick', 6, 'workbench', 'decor', [['brick', 3]]),
  R('c_hay_bale', 'hay_bale', 1, 'workbench', 'decor', [['hay', 10]]),
  R('c_barrel', 'barrel', 1, 'workbench', 'decor', [['wood', 8], ['copper_bar', 1]]),
  R('c_crates', 'crates', 1, 'workbench', 'decor', [['wood', 6]]),
  R('c_lantern', 'lantern_pole', 1, 'workbench', 'decor', [['wood', 5], ['copper_bar', 1], ['sap', 2]]),
  R('c_torch', 'torch', 2, 'workbench', 'decor', [['wood', 2], ['sap', 2]]),
  R('c_lamp_post', 'lamp_post', 1, 'workbench', 'decor', [['iron_bar', 1], ['glass', 1]], { level: 3 }),
  R('c_scarecrow', 'scarecrow', 1, 'workbench', 'decor', [['wood', 6], ['hay', 6], ['fiber', 6]]),
  R('c_bench', 'bench', 1, 'workbench', 'furniture', [['plank', 4], ['iron_bar', 1]], { level: 3 }),
  R('c_stump', 'stump_seat', 1, 'workbench', 'furniture', [['wood', 6]]),
  R('c_chair', 'chair_wood', 1, 'workbench', 'furniture', [['plank', 3]]),
  R('c_table', 'table_round', 1, 'workbench', 'furniture', [['plank', 6]]),
  R('c_bookshelf', 'bookshelf', 1, 'workbench', 'furniture', [['plank', 8], ['fiber', 4]], { npc: 'toma', friend: 2 }),
  R('c_bed', 'bed_simple', 1, 'workbench', 'furniture', [['plank', 6], ['cloth', 2]], { npc: 'toma', friend: 1 }),
  R('c_armchair', 'armchair', 1, 'workbench', 'furniture', [['plank', 3], ['cloth', 2]], { npc: 'toma', friend: 3 }),
  R('c_rug', 'rug_round', 1, 'workbench', 'furniture', [['cloth', 2], ['fiber', 6]]),
  R('c_plant_tall', 'plant_tall', 1, 'workbench', 'furniture', [['clay', 2], ['fiber', 5]]),
  R('c_flower_pot', 'flower_pot', 1, 'workbench', 'decor', [['clay', 2], ['daisy', 2]]),
  R('c_planter', 'planter', 1, 'workbench', 'decor', [['plank', 2], ['poppy', 2]], { village: 'florist' }),
  R('c_birdhouse', 'birdhouse', 1, 'workbench', 'decor', [['plank', 3], ['feather', 1]]),
  R('c_crystal_lamp', 'crystal_lamp', 1, 'workbench', 'decor', [['crystal_shard', 3], ['iron_bar', 1]], { level: 6 }),
  R('c_glow_shrooms', 'glow_shrooms', 1, 'workbench', 'decor', [['glowcap', 3]], { level: 4 }),
  R('c_snowman', 'snowman', 1, 'hand', 'decor', [['frost_crystal', 1], ['wood', 2]]),
  R('c_jack', 'jack_lantern', 1, 'workbench', 'decor', [['pumpkin', 1], ['sap', 1]]),
  R('c_sandcastle', 'sandcastle', 1, 'hand', 'decor', [['seashell', 3]]),
  R('c_shell_lamp', 'shell_lamp', 1, 'workbench', 'decor', [['seashell', 5], ['pearl', 1]]),
  R('c_well', 'well', 1, 'workbench', 'decor', [['stone', 30], ['wood', 10], ['rope', 2]], { level: 2 }),
  R('c_fireplace', 'fireplace', 1, 'workbench', 'furniture', [['brick', 12], ['stone', 10]], { level: 4 }),
];
export const RECIPE_BY_ID: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const STATION_NAMES: Record<Station, string> = {
  hand: 'À la main',
  workbench: 'Atelier',
  forge: 'Fourneau',
  kitchen: 'Cuisine',
  mill: 'Moulin',
  dairy: 'Laiterie',
  bakery: 'Boulangerie',
};
