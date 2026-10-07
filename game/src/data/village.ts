export interface VillageBuildingDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  benefit: string;
  coins: number;
  items: [string, number][];
  requires?: string[]; // other restored buildings
  npc?: string;
  anchor: string; // layout anchor (center)
  size: [number, number];
  roof: number;
  wall: number;
  style: 'shop' | 'house' | 'workshop' | 'bakery' | 'stable' | 'fishing' | 'florist' | 'market' | 'fountain' | 'park' | 'hall';
}

export const VILLAGE_BUILDINGS: VillageBuildingDef[] = [
  { id: 'shop', name: 'Boutique de Mallow', icon: '🏪', desc: 'Une petite boutique au toit percé.', benefit: 'Toutes les graines de saison, outils de base, expansion du sac.', coins: 500, items: [['wood', 20], ['stone', 10]], npc: 'mallow', anchor: 'shop', size: [5, 4], roof: 0x5a9ad8, wall: 0xfff0d8, style: 'shop' },
  { id: 'workshop', name: 'Atelier de Toma', icon: '🔨', desc: 'Les outils rouillent sous les ronces.', benefit: 'Améliorations d\'outils, agrandissement de la maison, recettes de meubles.', coins: 1200, items: [['wood', 40], ['stone', 30], ['copper_ore', 5]], requires: ['shop'], npc: 'toma', anchor: 'workshop', size: [5, 4], roof: 0x8a5a3a, wall: 0xe8d0a8, style: 'workshop' },
  { id: 'bakery', name: 'Boulangerie', icon: '🍞', desc: 'Le four est froid depuis longtemps.', benefit: 'Recettes de pâtisserie, achat de farine et sucre, la boulangerie achète vos plats +20%.', coins: 2000, items: [['wood', 30], ['brick', 20], ['wheat', 20]], requires: ['shop'], npc: 'brie', anchor: 'bakery', size: [4, 4], roof: 0xe8a33a, wall: 0xfff4e0, style: 'bakery' },
  { id: 'fishing_shop', name: 'Boutique de pêche', icon: '🎣', desc: 'Un vieux cabanon au bord de l\'eau.', benefit: 'Appâts, ponton de pêche, Niko achète les poissons +25%. Ouvre la route de Sunny Coast.', coins: 1500, items: [['wood', 40], ['rope', 10], ['fiber', 20]], requires: ['workshop'], npc: 'niko', anchor: 'fishing_shop', size: [4, 3], roof: 0x3a7ab8, wall: 0xd8e8f0, style: 'fishing' },
  { id: 'florist', name: 'Fleuriste', icon: '🌸', desc: 'Des pots vides et une enseigne délavée.', benefit: 'Graines de fleurs rares, décorations florales, bonus des ruches.', coins: 2500, items: [['plank', 15], ['tulip', 10], ['clay', 10]], requires: ['bakery'], npc: 'pippa', anchor: 'florist', size: [4, 3], roof: 0xff8ab8, wall: 0xfff8f0, style: 'florist' },
  { id: 'stable', name: 'Écurie du village', icon: '🐴', desc: 'Des box vides et du foin moisi.', benefit: 'Achat d\'animaux, chevaux, friandises. Hazel soigne vos bêtes.', coins: 3000, items: [['plank', 30], ['hay', 40], ['iron_bar', 5]], requires: ['workshop'], npc: 'hazel', anchor: 'stable', size: [6, 4], roof: 0x7a5a9a, wall: 0xe8d8c0, style: 'stable' },
  { id: 'market', name: 'Marché couvert', icon: '🧺', desc: 'Des étals renversés sous une halle de bois.', benefit: 'Vente +15% sur tout, demandes du jour mieux payées, mini-jeu du marché.', coins: 4000, items: [['plank', 40], ['cloth', 5], ['iron_bar', 5]], requires: ['bakery', 'florist'], anchor: 'market', size: [6, 4], roof: 0xe85a5a, wall: 0xf4e6c8, style: 'market' },
  { id: 'houses', name: 'Maisons du village', icon: '🏡', desc: 'Trois maisonnettes abandonnées.', benefit: 'De nouveaux habitants emménagent : plus de demandes et de cadeaux.', coins: 5000, items: [['plank', 50], ['brick', 40], ['glass', 15]], requires: ['market'], anchor: 'houses', size: [8, 4], roof: 0x6ab86a, wall: 0xfff0e0, style: 'house' },
  { id: 'fountain', name: 'Fontaine de la place', icon: '⛲', desc: 'Une fontaine tarie couverte de mousse.', benefit: 'Les festivals se tiennent sur la place. +1 Moon Gem par jour en jetant une pièce.', coins: 3000, items: [['stone', 80], ['aquamarine', 2], ['copper_bar', 10]], requires: ['shop'], anchor: 'plaza', size: [4, 4], roof: 0x6ac8f0, wall: 0xd8d0c0, style: 'fountain' },
  { id: 'park', name: 'Parc du village', icon: '🌳', desc: 'Un terrain vague envahi d\'herbes folles.', benefit: 'Créatures rares au crépuscule, course du village, coin pique-nique.', coins: 3500, items: [['fiber', 60], ['daisy', 10], ['wood', 40]], requires: ['fountain'], anchor: 'park', size: [8, 6], roof: 0x5aa84a, wall: 0xb07a4a, style: 'park' },
];
export const VILLAGE_BY_ID: Record<string, VillageBuildingDef> = Object.fromEntries(VILLAGE_BUILDINGS.map((b) => [b.id, b]));
