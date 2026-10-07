/** Farm buildings placed with the construction system. */
export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  size: [number, number]; // footprint in tiles (w, d) at rot 0
  coins: number;
  items: [string, number][];
  desc: string;
  capacity?: number;
  houses?: 'coop' | 'barn' | 'stable' | 'sanctuary';
  station?: string; // crafting station id
  max: number;
  unlockLevel: number;
  roof: number;
  wall: number;
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'house', name: 'Maison', icon: '🏡', size: [5, 4], coins: 0, items: [], desc: 'Votre maison. Entrez pour décorer et dormir.', max: 1, unlockLevel: 99, roof: 0xd8665a, wall: 0xfff1d6 },
  { id: 'coop', name: 'Poulailler', icon: '🐔', size: [4, 3], coins: 1200, items: [['wood', 30], ['stone', 10]], desc: 'Abrite 6 poules, canards ou lapins.', capacity: 6, houses: 'coop', max: 3, unlockLevel: 1, roof: 0xe8a33a, wall: 0xf4dfb6 },
  { id: 'barn', name: 'Étable', icon: '🐮', size: [5, 4], coins: 3500, items: [['wood', 60], ['stone', 30], ['plank', 10]], desc: 'Abrite 6 vaches, moutons, chèvres ou cochons.', capacity: 6, houses: 'barn', max: 3, unlockLevel: 2, roof: 0xc8463a, wall: 0xf0d8b0 },
  { id: 'stable', name: 'Écurie', icon: '🐴', size: [4, 3], coins: 4000, items: [['wood', 50], ['plank', 15], ['iron_bar', 2]], desc: 'Abrite 2 chevaux. Montez-les pour aller plus vite !', capacity: 2, houses: 'stable', max: 1, unlockLevel: 4, roof: 0x7a5a9a, wall: 0xe8d8c0 },
  { id: 'sanctuary', name: 'Refuge sauvage', icon: '🦊', size: [5, 4], coins: 2500, items: [['wood', 40], ['fiber', 30], ['stone', 20]], desc: 'Un coin de nature pour les animaux rares que vous avez apprivoisés.', capacity: 6, houses: 'sanctuary', max: 1, unlockLevel: 3, roof: 0x5a9a5a, wall: 0xd8c8a0 },
  { id: 'silo', name: 'Silo', icon: '🏗️', size: [2, 2], coins: 800, items: [['stone', 40], ['copper_bar', 2]], desc: 'Stocke 240 foin. Remplit automatiquement les mangeoires le matin.', max: 4, unlockLevel: 1, roof: 0x8aa8c8, wall: 0xe8e0d0 },
  { id: 'greenhouse', name: 'Serre', icon: '🌱', size: [5, 4], coins: 6000, items: [['glass', 30], ['plank', 20], ['iron_bar', 4]], desc: 'Les cultures sous la serre poussent en toute saison.', max: 2, unlockLevel: 5, roof: 0xbfe8f0, wall: 0xffffff },
  { id: 'mill', name: 'Moulin', icon: '🌀', size: [3, 3], coins: 1500, items: [['wood', 40], ['stone', 30]], desc: 'Transforme le blé en farine, le maïs en semoule.', station: 'mill', max: 1, unlockLevel: 2, roof: 0x8a5a3a, wall: 0xf4e6c8 },
  { id: 'workshop', name: 'Atelier', icon: '🔨', size: [3, 3], coins: 1000, items: [['wood', 40], ['stone', 10]], desc: 'Établi : fabriquer meubles, décorations et outils agricoles.', station: 'workbench', max: 1, unlockLevel: 1, roof: 0x4a7aa8, wall: 0xf0dcb8 },
  { id: 'kitchen', name: 'Cuisine d\'été', icon: '🍳', size: [3, 2], coins: 1200, items: [['wood', 20], ['brick', 15]], desc: 'Fourneau extérieur pour cuisiner.', station: 'kitchen', max: 1, unlockLevel: 2, roof: 0xe86a4a, wall: 0xfff0d8 },
  { id: 'forge', name: 'Fourneau', icon: '🔥', size: [2, 2], coins: 600, items: [['stone', 30], ['clay', 5]], desc: 'Fond les minerais en lingots, le sable en verre.', station: 'forge', max: 1, unlockLevel: 1, roof: 0x5a5a6a, wall: 0xa8988a },
  { id: 'dairy', name: 'Laiterie', icon: '🧀', size: [3, 2], coins: 2000, items: [['wood', 30], ['plank', 10]], desc: 'Fromage, beurre et tissu à partir des produits animaux.', station: 'dairy', max: 1, unlockLevel: 3, roof: 0x5aa8c8, wall: 0xfff8e8 },
  { id: 'beehive', name: 'Ruche', icon: '🐝', size: [1, 1], coins: 400, items: [['wood', 20], ['fiber', 10]], desc: 'Produit du miel tous les 2 jours. Encore plus près des fleurs.', max: 8, unlockLevel: 2, roof: 0xffc42a, wall: 0xf4d27a },
  { id: 'pond', name: 'Étang', icon: '🪷', size: [3, 3], coins: 1500, items: [['stone', 30], ['clay', 10]], desc: 'Pêchez à la ferme. Les canards adorent.', max: 2, unlockLevel: 2, roof: 0x5ab8e8, wall: 0x8ac8a0 },
  { id: 'shed', name: 'Remise', icon: '📦', size: [2, 2], coins: 900, items: [['wood', 40]], desc: 'Stockage illimité accessible depuis la ferme.', max: 1, unlockLevel: 1, roof: 0x6a8a4a, wall: 0xe8d0a8 },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
