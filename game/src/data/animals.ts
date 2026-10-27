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
  { id: 'goose', name: 'Oie', icon: '🦢', home: 'coop', price: 900, product: 'goose_egg', productEvery: 2, speed: 1.3, scale: 0.62, colors: [0xffffff, 0xb8b0a8], sound: 'honk', desc: 'Gardienne de la ferme : cacarde quand on approche. Pond de gros œufs.', unlockLevel: 4 },
  { id: 'turkey', name: 'Dindon', icon: '🦃', home: 'coop', price: 1100, product: 'feather', productEvery: 2, speed: 1.2, scale: 0.7, colors: [0x6a4a3a, 0xe8e0d8], sound: 'gobble', desc: 'Fait la roue avec ses belles plumes, qu\'il perd parfois.', unlockLevel: 5 },
  { id: 'alpaca', name: 'Alpaga', icon: '🦙', home: 'barn', price: 2400, product: 'alpaca_wool', productEvery: 3, speed: 1.5, scale: 0.95, colors: [0xf4ead8, 0xc89a6a, 0x5a4a42], sound: 'hum', desc: 'Doux et un peu snob. Sa laine est la plus douce de la vallée.', unlockLevel: 6 },
  { id: 'donkey', name: 'Âne', icon: '🐴', home: 'stable', price: 2200, product: 'fertilizer', productEvery: 2, speed: 1.4, scale: 1.0, colors: [0x9a9088, 0x7a6a5a], sound: 'heehaw', desc: 'Têtu mais fidèle. Fournit un excellent engrais pour les champs.', unlockLevel: 5 },
  { id: 'cat', name: 'Chat', icon: '🐱', home: 'pet', price: 500, productEvery: 3, speed: 1.6, scale: 0.45, colors: [0xffa04a, 0x5a5a5a, 0xffffff, 0x2c2c2c], sound: 'meow', desc: 'Dort au soleil et rapporte parfois un petit cadeau.', unlockLevel: 1 },
  { id: 'dog', name: 'Chien', icon: '🐶', home: 'pet', price: 500, productEvery: 3, speed: 2.4, scale: 0.55, colors: [0xd9a066, 0xffffff, 0x4a3a30], sound: 'woof', desc: 'Suit le joueur partout et déterre des trouvailles.', unlockLevel: 1 },
  // Rare, wild animals: befriend them in the world (3 gifts) to invite them to the farm sanctuary.
  { id: 'fox', name: 'Renard', icon: '🦊', home: 'sanctuary', price: 0, productEvery: 3, speed: 2.2, scale: 0.55, colors: [0xff8a3d], sound: 'yip', wild: true, region: 'woods', desc: 'Rusé et timide. Rapporte des baies.', unlockLevel: 1 },
  { id: 'deer', name: 'Cerf', icon: '🦌', home: 'sanctuary', price: 0, productEvery: 3, speed: 2.0, scale: 1.0, colors: [0xb07a4e], sound: 'bell', wild: true, region: 'woods', desc: 'Majestueux, apparaît à l\'aube.', unlockLevel: 1 },
  { id: 'raccoon', name: 'Raton laveur', icon: '🦝', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.8, scale: 0.5, colors: [0x8d8d94], sound: 'chitter', wild: true, region: 'village', desc: 'Fouille la nuit, trouve des trésors.', unlockLevel: 1 },
  { id: 'otter', name: 'Loutre', icon: '🦦', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.8, scale: 0.5, colors: [0x7a5a40], sound: 'squeak', wild: true, region: 'coast', desc: 'Joue avec les galets près de l\'eau.', unlockLevel: 1 },
  { id: 'hedgehog', name: 'Hérisson', icon: '🦔', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.0, scale: 0.35, colors: [0x7a5f48], sound: 'sniff', wild: true, region: 'farm', desc: 'Petite boule piquante, sort le soir.', unlockLevel: 1 },
  { id: 'squirrel', name: 'Écureuil', icon: '🐿️', home: 'sanctuary', price: 0, productEvery: 3, speed: 2.6, scale: 0.38, colors: [0xc8703a], sound: 'chitter', wild: true, region: 'woods', desc: 'Toujours pressé. Cache des glands partout.', unlockLevel: 1 },
  { id: 'owl', name: 'Hibou', icon: '🦉', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.2, scale: 0.45, colors: [0x9a7a5a], sound: 'hoot', wild: true, region: 'woods', desc: 'Veille la nuit. Très sage, paraît-il.', unlockLevel: 1 },
  { id: 'frog', name: 'Grenouille', icon: '🐸', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.6, scale: 0.32, colors: [0x6ac85a], sound: 'croak', wild: true, region: 'mountains', desc: 'Chante au bord du lac les soirs de pluie.', unlockLevel: 1 },
  { id: 'penguin', name: 'Manchot', icon: '🐧', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.0, scale: 0.5, colors: [0x2a2e3a], sound: 'squawk', wild: true, region: 'frosty', desc: 'Glisse sur le ventre dès qu\'il le peut.', unlockLevel: 1 },
  { id: 'crab', name: 'Crabe', icon: '🦀', home: 'sanctuary', price: 0, productEvery: 3, speed: 1.4, scale: 0.36, colors: [0xe8603a], sound: 'click', wild: true, region: 'coast', desc: 'Marche de côté et collectionne les coquillages.', unlockLevel: 1 },
  { id: 'lumipanda', name: 'Panda lunaire', icon: '🐼', home: 'sanctuary', price: 0, productEvery: 4, speed: 1.0, scale: 0.9, colors: [0xf7f4ff], sound: 'chime', wild: true, region: 'frosty', desc: 'Créature légendaire dont la fourrure brille sous la lune.', unlockLevel: 1 },
];

export const ANIMAL_BY_ID: Record<string, AnimalDef> = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));
export const ANIMAL_NAMES = ['Noisette', 'Caramel', 'Biscuit', 'Pompon', 'Praline', 'Moka', 'Flocon', 'Pistache', 'Câline', 'Galette', 'Myrtille', 'Prune', 'Sésame', 'Choupette', 'Bouton', 'Tartine', 'Nougat', 'Paprika', 'Cannelle', 'Mimosa', 'Pâquerette', 'Brioche', 'Grelot', 'Cookie'];
