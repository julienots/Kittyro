/** Shops & the Cozy Pass. Monetization is purely cosmetic: Moon Gems are earned by playing. */
export interface ShopEntry {
  kind: 'item' | 'decor' | 'wear' | 'animal' | 'special' | 'theme' | 'trail';
  id: string;
  price: number;
  currency: 'coins' | 'gems' | 'tokens';
  stock?: number;
  minLevel?: number;
  requires?: string; // village building restored
  season?: boolean; // seeds: only in season
}

export const FARM_THEMES = [
  { id: 'classic', name: 'Prairie classique', gems: 0, grass: [0x8fcf5f, 0x6fb84f] },
  { id: 'pastel', name: 'Rêve pastel', gems: 60, grass: [0xb8e8a8, 0xa0d8b8] },
  { id: 'autumn', name: 'Automne éternel', gems: 60, grass: [0xd8b860, 0xc89a4a] },
  { id: 'sakura', name: 'Pétales roses', gems: 80, grass: [0xa8d88a, 0xf0c8d8] },
  { id: 'moon', name: 'Nuit lunaire', gems: 100, grass: [0x7a9ab8, 0x6a8aa8] },
];
export const TRAILS = [
  { id: 'none', name: 'Aucune', gems: 0, color: 0xffffff },
  { id: 'petals', name: 'Pétales', gems: 30, color: 0xffb8d8 },
  { id: 'sparkles', name: 'Étincelles', gems: 40, color: 0xfff0a0 },
  { id: 'leaves', name: 'Feuilles', gems: 30, color: 0x8ad07a },
  { id: 'bubbles', name: 'Bulles', gems: 40, color: 0xa8e8ff },
  { id: 'snow', name: 'Flocons', gems: 40, color: 0xffffff },
];

export const BACKPACK_UPGRADES = [
  { size: 32, coins: 2000 },
  { size: 40, coins: 8000 },
  { size: 48, coins: 20000 },
];

export const HOUSE_UPGRADES = [
  { level: 1, name: 'Petite maison', coins: 0, items: [] as [string, number][], rooms: ['bedroom', 'kitchen', 'living'] },
  { level: 2, name: 'Maison avec bureau', coins: 10000, items: [['plank', 60], ['brick', 30]] as [string, number][], rooms: ['office'] },
  { level: 3, name: 'Maison avec véranda', coins: 30000, items: [['plank', 80], ['glass', 40], ['iron_bar', 10]] as [string, number][], rooms: ['veranda'] },
];
export const ROOM_NAMES: Record<string, string> = { bedroom: 'Chambre', kitchen: 'Cuisine', living: 'Salon', office: 'Bureau', veranda: 'Véranda' };

export const PASS_TIERS = 30;
export const PASS_POINTS_PER_TIER = 100;
export const PASS_PREMIUM_GEMS = 150;
export interface PassReward { kind: 'coins' | 'gems' | 'item' | 'decor' | 'wear' | 'trail'; id?: string; qty: number; label: string; icon: string }
export function passReward(tier: number, premium: boolean): PassReward {
  // deterministic reward table
  if (!premium) {
    if (tier % 5 === 4) return { kind: 'gems', qty: 10, label: '10 Moon Gems', icon: '💎' };
    if (tier % 3 === 0) return { kind: 'coins', qty: 300 + tier * 50, label: `${300 + tier * 50} pièces`, icon: '🪙' };
    if (tier % 3 === 1) return { kind: 'item', id: 'deluxe_fertilizer', qty: 2, label: '2 Engrais luxe', icon: '✨' };
    return { kind: 'item', id: 'animal_treat', qty: 5, label: '5 Friandises', icon: '🍪' };
  }
  const premiumList: PassReward[] = [
    { kind: 'decor', id: 'star_lantern', qty: 1, label: 'Lanterne étoile', icon: '⭐' },
    { kind: 'trail', id: 'petals', qty: 1, label: 'Traînée de pétales', icon: '🌸' },
    { kind: 'decor', id: 'glow_shrooms', qty: 2, label: '2 Champilueurs', icon: '🍄' },
    { kind: 'wear', id: 'top:starcloak', qty: 1, label: 'Cape étoilée', icon: '🌌' },
    { kind: 'decor', id: 'fairy_ring', qty: 1, label: 'Cercle des fées', icon: '🧚' },
    { kind: 'gems', qty: 20, label: '20 Moon Gems', icon: '💎' },
    { kind: 'decor', id: 'moon_statue', qty: 1, label: 'Statue lunaire', icon: '🌙' },
    { kind: 'trail', id: 'sparkles', qty: 1, label: 'Traînée d\'étincelles', icon: '✨' },
    { kind: 'wear', id: 'hat:crown', qty: 1, label: 'Couronne de mousse', icon: '👑' },
    { kind: 'decor', id: 'crystal_lamp', qty: 2, label: '2 Lampes de cristal', icon: '💎' },
  ];
  if (tier % 3 === 2) return premiumList[Math.floor(tier / 3) % premiumList.length];
  if (tier % 3 === 0) return { kind: 'coins', qty: 600 + tier * 80, label: `${600 + tier * 80} pièces`, icon: '🪙' };
  return { kind: 'item', id: 'magic_bait', qty: 2, label: '2 Appâts magiques', icon: '🌟' };
}
