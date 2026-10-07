/** Raw materials, minerals and forageables found in the world. */
export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  sell: number;
  cat: 'material' | 'mineral' | 'forage' | 'flower' | 'fruit' | 'animal' | 'artisan' | 'misc';
  desc?: string;
  edible?: number; // buff minutes when eaten
}

export const MATERIALS: MaterialDef[] = [
  { id: 'wood', name: 'Bois', icon: '🪵', sell: 4, cat: 'material' },
  { id: 'hardwood', name: 'Bois dur', icon: '🪵', sell: 18, cat: 'material' },
  { id: 'fiber', name: 'Fibre', icon: '🌿', sell: 2, cat: 'material' },
  { id: 'hay', name: 'Foin', icon: '🌾', sell: 3, cat: 'material' },
  { id: 'sap', name: 'Sève', icon: '🍯', sell: 6, cat: 'material' },
  { id: 'stone', name: 'Pierre', icon: '🪨', sell: 3, cat: 'material' },
  { id: 'clay', name: 'Argile', icon: '🟤', sell: 8, cat: 'material' },
  { id: 'coal', name: 'Charbon', icon: '⚫', sell: 14, cat: 'mineral' },
  { id: 'copper_ore', name: 'Minerai de cuivre', icon: '🟠', sell: 10, cat: 'mineral' },
  { id: 'iron_ore', name: 'Minerai de fer', icon: '⚪', sell: 18, cat: 'mineral' },
  { id: 'gold_ore', name: 'Minerai d\'or', icon: '🟡', sell: 35, cat: 'mineral' },
  { id: 'crystal_shard', name: 'Éclat de cristal', icon: '💠', sell: 60, cat: 'mineral' },
  { id: 'amethyst', name: 'Améthyste', icon: '🔮', sell: 110, cat: 'mineral' },
  { id: 'aquamarine', name: 'Aigue-marine', icon: '💎', sell: 140, cat: 'mineral' },
  { id: 'frost_crystal', name: 'Cristal de givre', icon: '❄️', sell: 120, cat: 'mineral' },
  { id: 'emberite', name: 'Braisite', icon: '🔥', sell: 160, cat: 'mineral' },
  { id: 'ember_core', name: 'Cœur de braise', icon: '❤️‍🔥', sell: 600, cat: 'mineral' },
  { id: 'geode', name: 'Géode', icon: '🪨', sell: 50, cat: 'mineral' },
  { id: 'moonstone', name: 'Pierre de lune', icon: '🌙', sell: 400, cat: 'mineral' },
  { id: 'fossil', name: 'Fossile', icon: '🦴', sell: 220, cat: 'mineral' },
  { id: 'copper_bar', name: 'Lingot de cuivre', icon: '🟧', sell: 60, cat: 'artisan' },
  { id: 'iron_bar', name: 'Lingot de fer', icon: '⬜', sell: 110, cat: 'artisan' },
  { id: 'gold_bar', name: 'Lingot d\'or', icon: '🟨', sell: 220, cat: 'artisan' },
  { id: 'steel_bar', name: 'Lingot d\'acier', icon: '🔩', sell: 260, cat: 'artisan' },
  { id: 'glass', name: 'Verre', icon: '🪟', sell: 20, cat: 'artisan' },
  { id: 'plank', name: 'Planche', icon: '🟫', sell: 12, cat: 'artisan' },
  { id: 'brick', name: 'Brique', icon: '🧱', sell: 16, cat: 'artisan' },
  { id: 'cloth', name: 'Tissu', icon: '🧶', sell: 70, cat: 'artisan' },
  { id: 'rope', name: 'Corde', icon: '🪢', sell: 10, cat: 'artisan' },
  { id: 'flour', name: 'Farine', icon: '🥡', sell: 20, cat: 'artisan' },
  { id: 'sugar', name: 'Sucre', icon: '🧂', sell: 12, cat: 'artisan' },
  { id: 'cheese', name: 'Fromage', icon: '🧀', sell: 120, cat: 'artisan' },
  { id: 'butter', name: 'Beurre', icon: '🧈', sell: 90, cat: 'artisan' },
  { id: 'honey', name: 'Miel', icon: '🍯', sell: 80, cat: 'artisan', edible: 0 },
  { id: 'fertilizer', name: 'Engrais', icon: '💩', sell: 6, cat: 'misc', desc: 'Accélère la croissance (×1.25).' },
  { id: 'deluxe_fertilizer', name: 'Engrais luxe', icon: '✨', sell: 30, cat: 'misc', desc: 'Accélère beaucoup (×1.6) et améliore la qualité.' },
  { id: 'bait', name: 'Appât', icon: '🪱', sell: 2, cat: 'misc', desc: 'Les poissons mordent plus vite.' },
  { id: 'magic_bait', name: 'Appât magique', icon: '🌟', sell: 20, cat: 'misc', desc: 'Ignore saison, heure et météo.' },
  // animal products
  { id: 'egg', name: 'Œuf', icon: '🥚', sell: 30, cat: 'animal' },
  { id: 'duck_egg', name: 'Œuf de cane', icon: '🥚', sell: 70, cat: 'animal' },
  { id: 'feather', name: 'Plume', icon: '🪶', sell: 40, cat: 'animal' },
  { id: 'milk', name: 'Lait', icon: '🥛', sell: 60, cat: 'animal' },
  { id: 'goat_milk', name: 'Lait de chèvre', icon: '🍼', sell: 95, cat: 'animal' },
  { id: 'wool', name: 'Laine', icon: '🧶', sell: 140, cat: 'animal' },
  { id: 'fluff', name: 'Bourre angora', icon: '☁️', sell: 220, cat: 'animal' },
  { id: 'truffle', name: 'Truffe', icon: '🟤', sell: 320, cat: 'animal' },
  // forage
  { id: 'button_mushroom', name: 'Champignon de Paris', icon: '🍄', sell: 22, cat: 'forage', edible: 10 },
  { id: 'chanterelle', name: 'Girolle', icon: '🍄', sell: 60, cat: 'forage', edible: 15 },
  { id: 'glowcap', name: 'Champilueur', icon: '🍄', sell: 140, cat: 'forage' },
  { id: 'red_cap', name: 'Amanite décorative', icon: '🍄', sell: 30, cat: 'forage' },
  { id: 'wild_berry', name: 'Baie sauvage', icon: '🍒', sell: 14, cat: 'forage', edible: 6 },
  { id: 'herb', name: 'Herbe aromatique', icon: '🌿', sell: 18, cat: 'forage' },
  { id: 'mint', name: 'Menthe', icon: '🌱', sell: 22, cat: 'forage' },
  { id: 'acorn', name: 'Gland', icon: '🌰', sell: 10, cat: 'forage' },
  { id: 'pinecone', name: 'Pomme de pin', icon: '🌲', sell: 12, cat: 'forage' },
  { id: 'seashell', name: 'Coquillage', icon: '🐚', sell: 25, cat: 'forage' },
  { id: 'pearl', name: 'Perle', icon: '⚪', sell: 350, cat: 'forage' },
  { id: 'coral', name: 'Corail', icon: '🪸', sell: 60, cat: 'forage' },
  { id: 'seaweed', name: 'Algue', icon: '🌿', sell: 15, cat: 'forage' },
  { id: 'snowberry', name: 'Baie des neiges', icon: '🫐', sell: 50, cat: 'forage', edible: 10 },
  { id: 'ice_lichen', name: 'Lichen des glaces', icon: '🌱', sell: 45, cat: 'forage' },
  { id: 'fire_pepper', name: 'Piment de feu', icon: '🌶️', sell: 70, cat: 'forage' },
  { id: 'ash_bloom', name: 'Fleur de cendre', icon: '🥀', sell: 90, cat: 'flower' },
  // wildflowers
  { id: 'daisy', name: 'Pâquerette', icon: '🌼', sell: 12, cat: 'flower' },
  { id: 'bluebell', name: 'Jacinthe des bois', icon: '🪻', sell: 20, cat: 'flower' },
  { id: 'poppy', name: 'Coquelicot', icon: '🌺', sell: 25, cat: 'flower' },
  { id: 'edelweiss', name: 'Edelweiss', icon: '🤍', sell: 75, cat: 'flower' },
  { id: 'lotus', name: 'Lotus', icon: '🪷', sell: 90, cat: 'flower' },
  { id: 'hibiscus', name: 'Hibiscus', icon: '🌺', sell: 55, cat: 'flower' },
  // fruits (trees)
  { id: 'apple', name: 'Pomme', icon: '🍎', sell: 30, cat: 'fruit', edible: 8 },
  { id: 'cherry', name: 'Cerise', icon: '🍒', sell: 34, cat: 'fruit', edible: 8 },
  { id: 'peach', name: 'Pêche', icon: '🍑', sell: 40, cat: 'fruit', edible: 8 },
  { id: 'orange', name: 'Orange', icon: '🍊', sell: 38, cat: 'fruit', edible: 8 },
  { id: 'coconut', name: 'Noix de coco', icon: '🥥', sell: 45, cat: 'fruit', edible: 8 },
  { id: 'lemon', name: 'Citron', icon: '🍋', sell: 36, cat: 'fruit' },
  // misc
  { id: 'treasure_map', name: 'Carte au trésor', icon: '🗺️', sell: 0, cat: 'misc', desc: 'Indique un coffre caché.' },
  { id: 'ember_key', name: 'Clé de braise', icon: '🗝️', sell: 0, cat: 'misc', desc: 'Ouvre le passage vers Ember Valley.' },
  { id: 'warm_coat', name: 'Manteau chaud', icon: '🧥', sell: 0, cat: 'misc', desc: 'Permet d\'explorer Frosty Peaks.' },
  { id: 'festival_token', name: 'Jeton de fête', icon: '🎟️', sell: 0, cat: 'misc' },
  { id: 'animal_treat', name: 'Friandise', icon: '🍪', sell: 10, cat: 'misc', desc: 'Les animaux et créatures adorent ça.' },
];

/** Fruit tree kinds the player can plant on the farm. */
export const FRUIT_TREES = [
  { id: 'apple', name: 'Pommier', fruit: 'apple', seasons: ['autumn'], price: 600, color: 0xe8423a, blossom: 0xffd8e8 },
  { id: 'cherry', name: 'Cerisier', fruit: 'cherry', seasons: ['spring'], price: 700, color: 0xc81e3a, blossom: 0xffb8d8 },
  { id: 'peach', name: 'Pêcher', fruit: 'peach', seasons: ['summer'], price: 700, color: 0xffa07a, blossom: 0xffc8c8 },
  { id: 'orange', name: 'Oranger', fruit: 'orange', seasons: ['summer', 'winter'], price: 800, color: 0xff9a1a, blossom: 0xffffff },
  { id: 'lemon', name: 'Citronnier', fruit: 'lemon', seasons: ['spring', 'winter'], price: 800, color: 0xffe03a, blossom: 0xffffff },
] as const;
export const FRUIT_TREE_GROW_DAYS = 6;
