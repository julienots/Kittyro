/** Character customization catalog. Items with price 0 are owned from the start. */
export interface WearDef {
  id: string;
  slot: 'top' | 'bottom' | 'shoes' | 'hat' | 'accessory';
  name: string;
  icon: string;
  price: number;
  gems?: number;
  tokens?: number;
  pass?: boolean;
}

export const SKIN_TONES = [0xffe0c8, 0xf6c9a4, 0xe0a882, 0xb87a56, 0x8a5a3e, 0x5e3a28, 0xf2d0b0, 0xc89068];
export const HAIR_COLORS = [0x2a1e1a, 0x5a3420, 0x8a5a2a, 0xd8a050, 0xf4d890, 0xd8603a, 0xff9ac8, 0xf0f0f0, 0x5a8ad8, 0x7ac88a, 0x9a3a2a, 0x8a8a96, 0xb07ae0, 0x3a2a4a];
export const EYE_COLORS = [0x2a1e1a, 0x3a6a9a, 0x3a8a5a, 0x8a5a2a, 0x7a4ab8];
export const CLOTH_COLORS = [0xffffff, 0xe85a5a, 0xff9ac8, 0xffd03a, 0x8ad07a, 0x5ab8e8, 0x5a6ad8, 0xb08ae8, 0x8a6a4a, 0x3a3a4a, 0xff8a3a, 0x6ad8c8];
export const HAIR_STYLES = ['Courts', 'Mèche', 'Couettes', 'Hérisson', 'Chignon', 'Tresses', 'Dégarni sage', 'Carré bouclé', 'Queue de cheval', 'Afro doux', 'Longs lisses', 'Longs ondulés', 'Carré lisse', 'Crête', 'Raie de côté', 'Deux macarons', 'Rasés', 'Mulet', 'Longs à frange', 'Tresse unique'];
export const BROW_STYLES = ['Arrondis', 'Épais', 'Surpris', 'Fins'];
export const MOUTH_STYLES = ['Sourire', 'Rieur', 'Étonné', 'Malicieux'];
export const FACIAL_HAIR = ['Aucune', 'Moustache', 'Barbe', 'Bouc'];
export const EYE_STYLES = ['Ronds', 'Joyeux', 'Étoiles', 'Doux', 'Amande'];

export const WEAR: WearDef[] = [
  { id: 'tee', slot: 'top', name: 'T-shirt', icon: '👕', price: 0 },
  { id: 'overalls', slot: 'top', name: 'Salopette', icon: '👖', price: 0 },
  { id: 'hoodie', slot: 'top', name: 'Sweat à capuche', icon: '🧥', price: 0 },
  { id: 'vest', slot: 'top', name: 'Gilet', icon: '🦺', price: 300 },
  { id: 'dress', slot: 'top', name: 'Robe', icon: '👗', price: 400 },
  { id: 'raincoat', slot: 'top', name: 'Ciré', icon: '🧥', price: 500 },
  { id: 'apron', slot: 'top', name: 'Tablier', icon: '🥼', price: 250 },
  { id: 'explorer', slot: 'top', name: 'Chemise d\'explorateur', icon: '👔', price: 450 },
  { id: 'sweater', slot: 'top', name: 'Pull tricoté', icon: '🧶', price: 600 },
  { id: 'kimono', slot: 'top', name: 'Veste fleurie', icon: '👘', price: 0, gems: 25 },
  { id: 'starcloak', slot: 'top', name: 'Cape étoilée', icon: '🌌', price: 0, pass: true },
  { id: 'shirt', slot: 'top', name: 'Chemise', icon: '👔', price: 0 },
  { id: 'tank', slot: 'top', name: 'Débardeur', icon: '🎽', price: 0 },
  { id: 'jacket', slot: 'top', name: 'Veste ouverte', icon: '🧥', price: 450 },
  { id: 'pants', slot: 'bottom', name: 'Pantalon', icon: '👖', price: 0 },
  { id: 'shorts', slot: 'bottom', name: 'Short', icon: '🩳', price: 0 },
  { id: 'skirt', slot: 'bottom', name: 'Jupe', icon: '🩱', price: 0 },
  { id: 'cargo', slot: 'bottom', name: 'Pantalon cargo', icon: '👖', price: 350 },
  { id: 'boots', slot: 'shoes', name: 'Bottes', icon: '🥾', price: 0 },
  { id: 'sneakers', slot: 'shoes', name: 'Baskets', icon: '👟', price: 0 },
  { id: 'flats', slot: 'shoes', name: 'Ballerines', icon: '🥿', price: 200 },
  { id: 'rainboots', slot: 'shoes', name: 'Bottes de pluie', icon: '🥾', price: 300 },
  { id: 'none', slot: 'hat', name: 'Aucun', icon: '🚫', price: 0 },
  { id: 'straw', slot: 'hat', name: 'Chapeau de paille', icon: '👒', price: 0 },
  { id: 'cap', slot: 'hat', name: 'Casquette', icon: '🧢', price: 0 },
  { id: 'beanie', slot: 'hat', name: 'Bonnet', icon: '🧶', price: 250 },
  { id: 'flower', slot: 'hat', name: 'Couronne de fleurs', icon: '🌼', price: 300 },
  { id: 'bandana', slot: 'hat', name: 'Bandana', icon: '🧣', price: 200 },
  { id: 'explorer', slot: 'hat', name: 'Casque colonial', icon: '🪖', price: 500 },
  { id: 'cowboy', slot: 'hat', name: 'Chapeau de cowboy', icon: '🤠', price: 600 },
  { id: 'chef', slot: 'hat', name: 'Toque', icon: '👨‍🍳', price: 400 },
  { id: 'bunny', slot: 'hat', name: 'Oreilles de lapin', icon: '🐰', price: 0, gems: 20 },
  { id: 'frog', slot: 'hat', name: 'Chapeau grenouille', icon: '🐸', price: 0, gems: 20 },
  { id: 'witch', slot: 'hat', name: 'Chapeau pointu', icon: '🧙', price: 0, tokens: 10 },
  { id: 'crown', slot: 'hat', name: 'Couronne de mousse', icon: '👑', price: 0, pass: true },
  { id: 'beret', slot: 'hat', name: 'Béret', icon: '🎨', price: 0 },
  { id: 'bow', slot: 'hat', name: 'Nœud', icon: '🎀', price: 0 },
  { id: 'headband', slot: 'hat', name: 'Serre-tête', icon: '💫', price: 150 },
  { id: 'none', slot: 'accessory', name: 'Aucun', icon: '🚫', price: 0 },
  { id: 'glasses', slot: 'accessory', name: 'Lunettes rondes', icon: '👓', price: 0 },
  { id: 'scarf', slot: 'accessory', name: 'Écharpe', icon: '🧣', price: 200 },
  { id: 'backpack', slot: 'accessory', name: 'Sac à dos', icon: '🎒', price: 350 },
  { id: 'flower_pin', slot: 'accessory', name: 'Fleur à l\'oreille', icon: '🌺', price: 150 },
  { id: 'bell', slot: 'accessory', name: 'Clochette', icon: '🔔', price: 0, tokens: 6 },
  { id: 'wings', slot: 'accessory', name: 'Ailes de fée', icon: '🧚', price: 0, gems: 40 },
  { id: 'earrings', slot: 'accessory', name: 'Boucles d\'oreilles', icon: '💎', price: 0 },
  { id: 'necklace', slot: 'accessory', name: 'Collier', icon: '📿', price: 200 },
  { id: 'satchel', slot: 'accessory', name: 'Besace', icon: '👜', price: 300 },
];
export const wearKey = (w: { slot: string; id: string }) => `${w.slot}:${w.id}`;
