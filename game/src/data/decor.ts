/** Decorations (outdoor) and furniture (indoor). All placeable with the build system. */
export type DecorCat = 'nature' | 'buildings' | 'flowers' | 'furniture' | 'rustic' | 'magic' | 'beach' | 'winter' | 'halloween' | 'colorful' | 'paths' | 'lights';
export type FurnCat = 'bed' | 'table' | 'seat' | 'storage' | 'kitchen' | 'deco' | 'light' | 'rug' | 'plant' | 'wall';

export interface DecorDef {
  id: string;
  name: string;
  icon: string;
  cat: DecorCat | FurnCat;
  indoor: boolean;
  size: [number, number];
  price: number; // coins in shop (0 = craft/event only)
  gems?: number;
  tokens?: number; // festival tokens
  model: string;
  c1: number;
  c2: number;
  light?: boolean;
  wall?: boolean;
  path?: boolean;
  blocks?: boolean; // collision (default true unless path/rug)
}

const D = (id: string, name: string, icon: string, cat: DecorCat, size: [number, number], price: number, model: string, c1: number, c2: number, extra: Partial<DecorDef> = {}): DecorDef => ({ id, name, icon, cat, indoor: false, size, price, model, c1, c2, ...extra });
const F = (id: string, name: string, icon: string, cat: FurnCat, size: [number, number], price: number, model: string, c1: number, c2: number, extra: Partial<DecorDef> = {}): DecorDef => ({ id, name, icon, cat, indoor: true, size, price, model, c1, c2, ...extra });

export const DECOR: DecorDef[] = [
  // paths
  D('path_stone', 'Chemin de pierre', '🪨', 'paths', [1, 1], 10, 'path', 0xc8c0b0, 0xa8a090, { path: true }),
  D('path_wood', 'Chemin de bois', '🟫', 'paths', [1, 1], 12, 'path', 0xc89a6a, 0xa87a4a, { path: true }),
  D('path_brick', 'Chemin de briques', '🧱', 'paths', [1, 1], 15, 'path', 0xd8806a, 0xb8604a, { path: true }),
  D('path_moss', 'Dalles moussues', '🟩', 'paths', [1, 1], 14, 'path', 0xb8c8a0, 0x8aa870, { path: true }),
  D('path_sand', 'Chemin de sable', '🟨', 'paths', [1, 1], 8, 'path', 0xf0e0b0, 0xd8c890, { path: true }),
  // nature
  D('round_bush', 'Buisson rond', '🌳', 'nature', [1, 1], 60, 'bush', 0x5aa84a, 0x3f8f3a),
  D('hedge', 'Haie taillée', '🟩', 'nature', [1, 1], 50, 'hedge', 0x4f9a46, 0x3f8a3a),
  D('small_pine', 'Petit sapin', '🌲', 'nature', [1, 1], 120, 'pine', 0x3f8a5a, 0x2f6a4a),
  D('birch', 'Bouleau', '🌳', 'nature', [1, 1], 150, 'birch', 0xf2f2e8, 0xa8d86a),
  D('blossom_tree', 'Arbre en fleurs', '🌸', 'nature', [1, 1], 300, 'tree_round', 0x8a5a3a, 0xffb8d8),
  D('rock_cluster', 'Rochers décoratifs', '🪨', 'nature', [1, 1], 40, 'rocks', 0xb0aaa0, 0x8a847a),
  D('stump_seat', 'Souche-tabouret', '🪵', 'nature', [1, 1], 50, 'stump', 0xa87a4a, 0xd8b88a),
  D('log_pile', 'Tas de bûches', '🪵', 'nature', [2, 1], 80, 'logs', 0x9a6a3a, 0xd8b07a),
  D('mushroom_ring', 'Cercle de champignons', '🍄', 'nature', [2, 2], 200, 'shroom_ring', 0xe85a4a, 0xfff0e0, { blocks: false }),
  D('lily_pond', 'Petite mare', '🪷', 'nature', [2, 2], 250, 'mini_pond', 0x5ab8e8, 0xff9ac8),
  // flowers
  D('flower_pot', 'Pot de fleurs', '🪴', 'flowers', [1, 1], 40, 'pot_flowers', 0xd8805a, 0xff7aa8),
  D('planter', 'Jardinière', '🌼', 'flowers', [2, 1], 90, 'planter', 0xb07a4a, 0xffd03a),
  D('flowerbed_red', 'Massif rouge', '🌺', 'flowers', [1, 1], 50, 'flowerbed', 0xe8423a, 0x5aa84a, { blocks: false }),
  D('flowerbed_blue', 'Massif bleu', '💠', 'flowers', [1, 1], 50, 'flowerbed', 0x6a8aff, 0x5aa84a, { blocks: false }),
  D('flowerbed_yellow', 'Massif jaune', '🌼', 'flowers', [1, 1], 50, 'flowerbed', 0xffd03a, 0x5aa84a, { blocks: false }),
  D('rose_arch', 'Arche de roses', '🌹', 'flowers', [2, 1], 400, 'arch', 0xffffff, 0xff5a7a, { blocks: false }),
  D('sunflower_row', 'Rangée de tournesols', '🌻', 'flowers', [2, 1], 120, 'sunflowers', 0xffc62a, 0x5ca843),
  // furniture (outdoor)
  D('bench', 'Banc de parc', '🪑', 'furniture', [2, 1], 150, 'bench', 0xb07a4a, 0x5a5a5a),
  D('picnic_table', 'Table de pique-nique', '🧺', 'furniture', [2, 2], 250, 'picnic', 0xc8925a, 0xe85a5a),
  D('parasol', 'Parasol', '⛱️', 'furniture', [1, 1], 180, 'parasol', 0xff8a7a, 0xffffff),
  D('hammock', 'Hamac', '🪢', 'furniture', [3, 1], 300, 'hammock', 0x8a6a4a, 0xf4e0a0),
  D('garden_chair', 'Chaise de jardin', '🪑', 'furniture', [1, 1], 80, 'chair', 0xffffff, 0x8ad0e8),
  // buildings/structures
  D('well', 'Puits', '🪣', 'buildings', [2, 2], 500, 'well', 0xa8a090, 0xc8463a),
  D('mailbox', 'Boîte aux lettres', '📮', 'buildings', [1, 1], 100, 'mailbox', 0xe85a4a, 0xb07a4a),
  D('birdhouse', 'Nichoir', '🐦', 'buildings', [1, 1], 120, 'birdhouse', 0x8ad0e8, 0xb07a4a),
  D('doghouse', 'Niche', '🐕', 'buildings', [1, 1], 200, 'doghouse', 0xc8463a, 0xd8b07a),
  D('gazebo', 'Kiosque', '⛩️', 'buildings', [3, 3], 1200, 'gazebo', 0xffffff, 0x6a9ad8),
  D('windmill_toy', 'Petit moulin décoratif', '🌀', 'buildings', [1, 1], 260, 'mini_windmill', 0xf4e6c8, 0xc8463a),
  D('fountain', 'Fontaine', '⛲', 'buildings', [2, 2], 900, 'fountain', 0xd8d0c0, 0x6ac8f0),
  D('statue_bunny', 'Statue lapin', '🐇', 'buildings', [1, 1], 450, 'statue', 0xd8d0c8, 0xb8b0a8),
  // rustic
  D('fence_wood', 'Barrière en bois', '🚧', 'rustic', [1, 1], 15, 'fence', 0xb07a4a, 0x8a5a3a),
  D('fence_white', 'Barrière blanche', '⬜', 'rustic', [1, 1], 25, 'fence', 0xffffff, 0xe0e0e0),
  D('fence_stone', 'Muret de pierre', '🪨', 'rustic', [1, 1], 30, 'wall_stone', 0xb8b0a0, 0x8a8478),
  D('gate', 'Portillon', '🚪', 'rustic', [1, 1], 60, 'gate', 0xb07a4a, 0x8a5a3a, { blocks: false }),
  D('hay_bale', 'Botte de foin', '🌾', 'rustic', [1, 1], 30, 'haybale', 0xf2cd5c, 0xd8b04a),
  D('barrel', 'Tonneau', '🛢️', 'rustic', [1, 1], 50, 'barrel', 0xa8743a, 0x5a5a5a),
  D('crates', 'Caisses', '📦', 'rustic', [1, 1], 50, 'crates', 0xc8a06a, 0x8a6a3a),
  D('cart', 'Charrette', '🛒', 'rustic', [2, 1], 300, 'cart', 0xb07a4a, 0xc8463a),
  D('scarecrow', 'Épouvantail', '🎎', 'rustic', [1, 1], 150, 'scarecrow', 0xf2cd5c, 0x5a8ad8),
  D('sign_wood', 'Panneau en bois', '🪧', 'rustic', [1, 1], 40, 'sign', 0xb07a4a, 0xf0d8a8),
  D('wheelbarrow', 'Brouette', '🛞', 'rustic', [1, 1], 120, 'wheelbarrow', 0x6a9a5a, 0xb07a4a),
  // lights
  D('lamp_post', 'Lampadaire', '🏮', 'lights', [1, 1], 200, 'lamp_post', 0x3a3a4a, 0xfff0a0, { light: true }),
  D('lantern_pole', 'Lanterne rustique', '🏮', 'lights', [1, 1], 120, 'lantern', 0x8a5a3a, 0xffc06a, { light: true }),
  D('string_lights', 'Guirlande lumineuse', '💡', 'lights', [2, 1], 220, 'string_lights', 0x8a5a3a, 0xfff0a0, { light: true, blocks: false }),
  D('torch', 'Torche de jardin', '🔥', 'lights', [1, 1], 80, 'torch', 0x8a5a3a, 0xff9a3a, { light: true }),
  // magic
  D('crystal_lamp', 'Lampe de cristal', '💎', 'magic', [1, 1], 0, 'crystal', 0x9ae8ff, 0xd8a8ff, { light: true, gems: 15 }),
  D('glow_shrooms', 'Champilueurs', '🍄', 'magic', [1, 1], 0, 'glow_shrooms', 0x7af0ff, 0xb8fff0, { light: true, gems: 10 }),
  D('fairy_ring', 'Cercle des fées', '🧚', 'magic', [2, 2], 0, 'fairy_ring', 0xffd0ff, 0xfff8b0, { gems: 25, blocks: false, light: true }),
  D('moon_statue', 'Statue lunaire', '🌙', 'magic', [1, 1], 0, 'moon_statue', 0xe8e8ff, 0xb8c8ff, { gems: 30, light: true }),
  D('star_lantern', 'Lanterne étoile', '⭐', 'magic', [1, 1], 0, 'star_lantern', 0xfff0a0, 0xffd03a, { gems: 12, light: true }),
  // beach
  D('beach_chair', 'Transat', '🏖️', 'beach', [1, 2], 160, 'beach_chair', 0x5ab8e8, 0xffffff),
  D('sandcastle', 'Château de sable', '🏰', 'beach', [1, 1], 120, 'sandcastle', 0xf0d890, 0xe85a5a),
  D('surfboard', 'Planche de surf', '🏄', 'beach', [1, 1], 200, 'surfboard', 0xff8a3a, 0x5ab8e8),
  D('palm', 'Palmier', '🌴', 'beach', [1, 1], 260, 'palm', 0x9a7a5a, 0x4fb85a),
  D('shell_lamp', 'Lampe coquillage', '🐚', 'beach', [1, 1], 0, 'shell_lamp', 0xffd8e8, 0xfff0d0, { light: true, tokens: 8 }),
  // winter
  D('snowman', 'Bonhomme de neige', '⛄', 'winter', [1, 1], 100, 'snowman', 0xffffff, 0xff8a3a),
  D('winter_tree', 'Sapin décoré', '🎄', 'winter', [1, 1], 0, 'xmas_tree', 0x2f7a4a, 0xffd03a, { light: true, tokens: 10 }),
  D('sled', 'Luge', '🛷', 'winter', [1, 1], 140, 'sled', 0xc8463a, 0xb07a4a),
  D('ice_sculpture', 'Sculpture de glace', '🧊', 'winter', [1, 1], 0, 'ice_sculpture', 0xcfeaff, 0xffffff, { tokens: 12 }),
  // halloween
  D('jack_lantern', 'Citrouille-lanterne', '🎃', 'halloween', [1, 1], 0, 'jack', 0xff8c1a, 0xffd03a, { light: true, tokens: 5 }),
  D('cauldron', 'Chaudron', '🫕', 'halloween', [1, 1], 0, 'cauldron', 0x3a3a4a, 0x8aff6a, { tokens: 8, light: true }),
  D('ghost_balloon', 'Ballon fantôme', '👻', 'halloween', [1, 1], 0, 'ghost', 0xffffff, 0x3a3a4a, { tokens: 6 }),
  D('candles', 'Bougies', '🕯️', 'halloween', [1, 1], 90, 'candles', 0xfff0d8, 0xffa03a, { light: true }),
  // colorful
  D('rainbow_arch', 'Arche arc-en-ciel', '🌈', 'colorful', [3, 1], 0, 'rainbow', 0xff6a6a, 0x6a8aff, { gems: 40, blocks: false }),
  D('balloons', 'Ballons', '🎈', 'colorful', [1, 1], 80, 'balloons', 0xff6a8a, 0x6ad8ff),
  D('flag_garland', 'Fanions', '🎏', 'colorful', [2, 1], 100, 'flags', 0xffd03a, 0xff6a8a, { blocks: false }),
  D('pinwheel', 'Moulinet coloré', '🎡', 'colorful', [1, 1], 60, 'pinwheel', 0xff6a8a, 0x6ad8ff),
  D('candy_lamp', 'Lampe bonbon', '🍭', 'colorful', [1, 1], 0, 'candy_lamp', 0xff8ad8, 0xffffff, { light: true, tokens: 8 }),

  // ---- Furniture (indoor) ----
  F('bed_simple', 'Lit douillet', '🛏️', 'bed', [2, 3], 400, 'bed', 0xb07a4a, 0x8ac8e8),
  F('bed_big', 'Grand lit à baldaquin', '🛏️', 'bed', [3, 3], 1200, 'bed_canopy', 0xd8b07a, 0xffb8c8),
  F('bed_bunk', 'Lit superposé', '🛏️', 'bed', [2, 3], 700, 'bunk', 0x8a6a4a, 0x9ad87a),
  F('nightstand', 'Table de chevet', '🗄️', 'storage', [1, 1], 120, 'nightstand', 0xb07a4a, 0xfff0a0),
  F('wardrobe', 'Armoire', '🚪', 'storage', [2, 1], 450, 'wardrobe', 0xc8925a, 0x8a5a3a),
  F('bookshelf', 'Bibliothèque', '📚', 'storage', [2, 1], 380, 'bookshelf', 0x9a6a3a, 0xe85a5a),
  F('dresser', 'Commode', '🗄️', 'storage', [2, 1], 300, 'dresser', 0xf0e0c8, 0xb07a4a),
  F('toy_chest', 'Coffre à jouets', '🧸', 'storage', [1, 1], 200, 'chest', 0xe8a33a, 0x8ac8e8),
  F('table_round', 'Table ronde', '🪵', 'table', [2, 2], 250, 'table_round', 0xc8925a, 0xffffff),
  F('table_long', 'Grande table', '🪵', 'table', [3, 2], 400, 'table_long', 0xb07a4a, 0xf4e6c8),
  F('desk', 'Bureau', '🖋️', 'table', [2, 1], 320, 'desk', 0x9a6a3a, 0xf0e0c8),
  F('coffee_table', 'Table basse', '☕', 'table', [2, 1], 180, 'coffee_table', 0xd8b07a, 0x8a5a3a),
  F('chair_wood', 'Chaise en bois', '🪑', 'seat', [1, 1], 90, 'chair', 0xc8925a, 0xe85a5a),
  F('armchair', 'Fauteuil moelleux', '🛋️', 'seat', [1, 1], 300, 'armchair', 0x7ab8a0, 0xf4e6c8),
  F('sofa', 'Canapé', '🛋️', 'seat', [3, 1], 650, 'sofa', 0xe8a0a0, 0xf4e6c8),
  F('beanbag', 'Pouf', '🟣', 'seat', [1, 1], 150, 'beanbag', 0xb08ae8, 0xffffff),
  F('stove', 'Cuisinière', '🍳', 'kitchen', [1, 1], 500, 'stove', 0xf4f4f4, 0x3a3a3a),
  F('fridge', 'Réfrigérateur', '🧊', 'kitchen', [1, 1], 600, 'fridge', 0xa8d8e8, 0xffffff),
  F('counter', 'Plan de travail', '🔪', 'kitchen', [1, 1], 200, 'counter', 0xf4e6c8, 0x8ab8a0),
  F('sink', 'Évier', '🚰', 'kitchen', [1, 1], 220, 'sink', 0xf4e6c8, 0xc8d8e8),
  F('fireplace', 'Cheminée', '🔥', 'deco', [2, 1], 900, 'fireplace', 0xc8786a, 0xffa03a, { light: true }),
  F('piano', 'Piano', '🎹', 'deco', [2, 1], 1500, 'piano', 0x3a2a2a, 0xffffff),
  F('aquarium', 'Aquarium', '🐠', 'deco', [2, 1], 800, 'aquarium', 0x8ad8f0, 0xff8a3a, { light: true }),
  F('cat_bed', 'Panier pour chat', '🧺', 'deco', [1, 1], 150, 'pet_bed', 0xd8b07a, 0xffb8c8),
  F('globe', 'Globe', '🌍', 'deco', [1, 1], 260, 'globe', 0x6ab8e8, 0x8a5a3a),
  F('radio', 'Radio rétro', '📻', 'deco', [1, 1], 300, 'radio', 0xe8a33a, 0x5a3a2a),
  F('vase', 'Vase fleuri', '💐', 'deco', [1, 1], 120, 'vase', 0x8ac8e8, 0xff7aa8),
  F('teddy', 'Gros nounours', '🧸', 'deco', [1, 1], 180, 'teddy', 0xc8925a, 0xffd8c8),
  F('rug_round', 'Tapis rond', '🟠', 'rug', [2, 2], 160, 'rug_round', 0xe8a07a, 0xfff0d8, { blocks: false }),
  F('rug_square', 'Tapis tissé', '🟥', 'rug', [3, 2], 220, 'rug_square', 0x8ab8e8, 0xfff0d8, { blocks: false }),
  F('rug_leaf', 'Tapis feuille', '🍃', 'rug', [2, 2], 240, 'rug_round', 0x8ad07a, 0xe8f8d8, { blocks: false }),
  F('floor_lamp', 'Lampadaire', '💡', 'light', [1, 1], 200, 'floor_lamp', 0x5a5a5a, 0xfff0c0, { light: true }),
  F('table_lamp', 'Lampe champignon', '🍄', 'light', [1, 1], 160, 'shroom_lamp', 0xe85a4a, 0xfff0d0, { light: true }),
  F('plant_tall', 'Grande plante', '🪴', 'plant', [1, 1], 140, 'plant_tall', 0xd8805a, 0x4f9a46),
  F('plant_small', 'Petite plante', '🌱', 'plant', [1, 1], 70, 'plant_small', 0xf4f4f4, 0x6ab85a),
  F('cactus', 'Cactus', '🌵', 'plant', [1, 1], 90, 'cactus', 0xd8805a, 0x5aa85a),
  F('painting_land', 'Tableau paysage', '🖼️', 'wall', [1, 1], 250, 'painting', 0xb07a4a, 0x8ad07a, { wall: true, blocks: false }),
  F('painting_sea', 'Tableau marine', '🖼️', 'wall', [1, 1], 250, 'painting', 0xd8b07a, 0x6ab8e8, { wall: true, blocks: false }),
  F('painting_flower', 'Tableau fleurs', '🖼️', 'wall', [1, 1], 250, 'painting', 0xffffff, 0xff8ab8, { wall: true, blocks: false }),
  F('wall_clock', 'Horloge', '🕰️', 'wall', [1, 1], 200, 'clock', 0xb07a4a, 0xfff8e8, { wall: true, blocks: false }),
  F('wall_shelf', 'Étagère murale', '🪜', 'wall', [1, 1], 150, 'wall_shelf', 0xc8925a, 0x7ab8a0, { wall: true, blocks: false }),
  F('window_box', 'Fenêtre fleurie', '🪟', 'wall', [1, 1], 220, 'window', 0xffffff, 0xff8ab8, { wall: true, blocks: false }),
  F('mirror', 'Miroir', '🪞', 'wall', [1, 1], 180, 'mirror', 0xd8b07a, 0xc8e8f8, { wall: true, blocks: false }),
];

export const DECOR_BY_ID: Record<string, DecorDef> = Object.fromEntries(DECOR.map((d) => [d.id, d]));

export const WALLPAPERS = [
  { id: 'cream', name: 'Crème', c1: 0xfff3dc, c2: 0xf4e4c4, pattern: 'plain' },
  { id: 'mint', name: 'Rayures menthe', c1: 0xdff5e8, c2: 0xbfe8d0, pattern: 'stripes' },
  { id: 'rose', name: 'Pois rose', c1: 0xffe4ec, c2: 0xffbfd2, pattern: 'dots' },
  { id: 'sky', name: 'Vichy ciel', c1: 0xe0efff, c2: 0xbcd8ff, pattern: 'check' },
  { id: 'wood', name: 'Lambris', c1: 0xd8a878, c2: 0xc8946a, pattern: 'planks' },
  { id: 'brick', name: 'Briques', c1: 0xe0957a, c2: 0xc87a62, pattern: 'bricks' },
  { id: 'lavender', name: 'Lavande', c1: 0xece0ff, c2: 0xd8c4ff, pattern: 'stripes' },
  { id: 'sunny', name: 'Soleil', c1: 0xfff4b8, c2: 0xffe27a, pattern: 'dots' },
  { id: 'forest', name: 'Forêt', c1: 0xcfe8c0, c2: 0x9ccc8a, pattern: 'leaves' },
  { id: 'night', name: 'Nuit étoilée', c1: 0x2f3a6a, c2: 0xfff0a0, pattern: 'stars' },
];
export const FLOORS = [
  { id: 'oak', name: 'Chêne', c1: 0xc8925a, c2: 0xb07a4a, pattern: 'planks' },
  { id: 'birch', name: 'Bouleau', c1: 0xf0d8b0, c2: 0xe0c498, pattern: 'planks' },
  { id: 'checker', name: 'Damier', c1: 0xffffff, c2: 0xe0a0a0, pattern: 'check' },
  { id: 'stone', name: 'Pierre', c1: 0xc8c0b0, c2: 0xb0a898, pattern: 'tiles' },
  { id: 'carpet_blue', name: 'Moquette bleue', c1: 0x8ab0e0, c2: 0x7aa0d0, pattern: 'plain' },
  { id: 'carpet_rose', name: 'Moquette rose', c1: 0xf0b0c0, c2: 0xe0a0b0, pattern: 'plain' },
  { id: 'tiles', name: 'Carrelage', c1: 0xf4f4ec, c2: 0xc8e0d8, pattern: 'tiles' },
  { id: 'moss', name: 'Tapis de mousse', c1: 0x9ccc7a, c2: 0x8abf6a, pattern: 'plain' },
];
export const WALL_PRICE = 200;
export const FLOOR_PRICE = 200;
