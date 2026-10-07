export type AnimalHome = 'coop' | 'barn' | 'stable' | 'pet' | 'sanctuary';

export interface AnimalDef {
  id: string;
  name: string;
  icon: string;
  home: AnimalHome;
  price: number;
  gems?: number;
  product?: string;
  /** product every N days when fed & happy */
  productEvery: number;
  speed: number;
  scale: number;
  colors: number[]; // body color variants
  sound: string;
  wild?: boolean; // rare animal found in the world, adoptable after befriending
  region?: string;
  desc: string;
  unlockLevel: number;
}

export const ANIMALS: AnimalDef[] = [
  { id: 'chicken', name: 'Poule', icon: '🐔', home: 'coop', price: 400, product: 'egg', productEvery: 1, speed: 1.4, scale: 0.55, colors: [0xffffff, 0xd99a5b, 0x5b4636], sound: 'cluck', desc: 'Gratte le sol et pond un œuf chaque jour.', unlockLevel: 1 },
  { id: 'duck', name: 'Canard', icon: '🦆', home: 'coop', price: 600, product: 'duck_egg', productEvery: 2, speed: 1.2, scale: 0.55, colors: [0xffffff, 0x8a6a4a], sound: 'quack', desc: 'Adore les étangs. Perd parfois une plume.', unlockLevel: 3 },
  { id: 'rabbit', name: 'Lapin', icon: '🐰', home: 'coop', price: 800, product: 'fluff', productEvery: 3, speed: 2.2, scale: 0.5, colors: [0xf4efe8, 0xb08a68, 0x9c9c9c], sound: 'squeak', desc: 'Fait des petits bonds. Donne de la bourre angora.', unlockLevel: 4 },
  { id: 'cow', name: 'Vache', icon: '🐮', home: 'barn', price: 1500, product: 'milk', productEvery: 1, speed: 1.0, scale: 1.0, colors: [0xffffff, 0xc98a52, 0x3a3030], sound: 'moo', desc: 'Calme et douce. Donne du lait frais.', unlockLevel: 2 },
  { id: 'sheep', name: 'Mouton', icon: '🐑', home: 'barn', price: 1200, product: 'wool', productEvery: 3, speed: 1.6, scale: 0.85, colors: [0xfbf6ee, 0x3b3434, 0xf5d7c4], sound: 'baa', desc: 'Court partout quand il est content. Donne de la laine.', unlockLevel: 2 },
  { id: 'goat', name: 'Chèvre', icon: '🐐', home: 'barn', price: 1400, product: 'goat_milk', productEvery: 2, speed: 1.5, scale: 0.8, colors: [0xf1ece4, 0x8a6b52], sound: 'meh', desc: 'Curieuse, grimpe sur tout.', unlockLevel: 3 },
  { id: 'pig', name: 'Cochon', icon: '🐷', home: 'barn', price: 1600, product: 'truffle', productEvery: 2, speed: 1.1, scale: 0.85, colors: [0xffb3c1, 0x8c6a5a], sound: 'oink', desc: 'Renifle le sol à la recherche de truffes.', unlockLevel: 4 },
  { id: 'horse', name: 'Cheval', icon: '🐴', home: 'stable', price: 3000, productEvery: 99, speed: 2.4, scale: 1.15, colors: [0x9a6440, 0xf3efe8, 0x3a2a22], sound: 'neigh', desc: 'Monture fidèle : se déplacer bien plus vite.', unlockLevel: 4 },
  { id: 'cat', name: 'Chat', icon: '🐱', home: 'pet', price: 500, productEvery: 3, speed: 1.6, scale: 0.45, colors: [0xffa04a, 0x5a5a5a, 0xffffff, 0x2c2c2c], sound: 'meow', desc: 'Dort au soleil et rapporte parfois un petit cadeau.', unlockLevel: 1 },
  { id: 'dog', name: 'Chien', icon: '🐶', home: 'pet', price: 500, productEvery: 3, speed: 2.4, scale: 0.55, colors: [0xd9a066, 0xffffff, 0x4a3a30], sound: 'woof', desc: 'Suit le joueur partout et déterre des trouvailles.', unlockLevel: 1 },
  // Rare, wild animals: befriend them in the world (3 gifts) to invite them to the farm sanctuary.
  { id: 'fox', name: 'Renard', icon: '🦊', home: 'sanctuary', price: 0, productEvery: 3, speed: 2.2, scale: 0.55, colors: [0xff8a3d], sound: 'yip', wild: true, region: 'woods', desc: 'Rusé et timide. Rapporte des baies.', unlockLevel: 1 },
  { id: 'deer', name: 'Cerf', icon: '🦌', home: 'sanctuary', price: 0, productEvery: 3, speed: 2.0, scale: 1.0, colors: [0xb07a4e], sound: 'bell', wild: true, region: 'woods', desc: 'Majestueux, apparaît à l\'aube.', unlockLevel: 1 },
  { id: 'raccoon', name: 'Raton laveur', icon: '🦝', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.8, scale: 0.5, colors: [0x8d8d94], sound: 'chitter', wild: true, region: 'village', desc: 'Fouille la nuit, trouve des trésors.', unlockLevel: 1 },
  { id: 'otter', name: 'Loutre', icon: '🦦', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.8, scale: 0.5, colors: [0x7a5a40], sound: 'squeak', wild: true, region: 'coast', desc: 'Joue avec les galets près de l\'eau.', unlockLevel: 1 },
  { id: 'hedgehog', name: 'Hérisson', icon: '🦔', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.0, scale: 0.35, colors: [0x7a5f48], sound: 'sniff', wild: true, region: 'farm', desc: 'Petite boule piquante, sort le soir.', unlockLevel: 1 },
  { id: 'lumipanda', name: 'Panda lunaire', icon: '🐼', home: 'sanctuary', price: 0, productEvery: 4, speed: 1.0, scale: 0.9, colors: [0xf7f4ff], sound: 'chime', wild: true, region: 'frosty', desc: 'Créature légendaire dont la fourrure brille sous la lune.', unlockLevel: 1 },
];

export const ANIMAL_BY_ID: Record<string, AnimalDef> = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));
export const ANIMAL_NAMES = ['Noisette', 'Caramel', 'Biscuit', 'Pompon', 'Praline', 'Moka', 'Flocon', 'Pistache', 'Câline', 'Galette', 'Myrtille', 'Prune', 'Sésame', 'Choupette', 'Bouton', 'Tartine', 'Nougat', 'Paprika', 'Cannelle', 'Mimosa', 'Pâquerette', 'Brioche', 'Grelot', 'Cookie'];
