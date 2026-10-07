import type { RegionId } from '../state/types';

export interface RegionDef {
  id: RegionId;
  name: string;
  icon: string;
  desc: string;
  music: string;
  unlockHint: string;
  /** position on the world map (0..1) */
  map: [number, number];
  size: [number, number];
  ground: number;
  ground2: number;
  cliff: number;
  water: number;
  sky: [number, number];
  fog: number;
  outdoor: boolean;
}

export const REGIONS: RegionDef[] = [
  { id: 'farm', name: 'Green Valley', icon: '🌳', desc: 'Votre ferme, ses prairies, la rivière et le vieux moulin.', music: 'farm', unlockHint: '', map: [0.36, 0.55], size: [52, 46], ground: 0x8fcf5f, ground2: 0x6fb84f, cliff: 0xb08a5a, water: 0x5ac8e8, sky: [0x8fd3ff, 0xfff4d6], fog: 0xcfeaf0, outdoor: true },
  { id: 'village', name: 'Willowbrook', icon: '🏘️', desc: 'Le petit village à restaurer, au bord du ruisseau.', music: 'village', unlockHint: 'Suivez le chemin à l\'est de la ferme.', map: [0.58, 0.5], size: [48, 42], ground: 0x9ad46a, ground2: 0x7cc25a, cliff: 0xb08a5a, water: 0x5ac8e8, sky: [0x8fd3ff, 0xfff4d6], fog: 0xd8eef0, outdoor: true },
  { id: 'woods', name: 'Whispering Woods', icon: '🌲', desc: 'Une grande forêt murmurante. Champignons, animaux sauvages, secrets.', music: 'forest', unlockHint: 'Réparez le pont de la forêt (quête de Moss).', map: [0.2, 0.3], size: [56, 52], ground: 0x5fae5a, ground2: 0x4a9a52, cliff: 0x8a6a4a, water: 0x4ab0c8, sky: [0x7fc0e0, 0xe8f4d8], fog: 0xa8d0b8, outdoor: true },
  { id: 'mountains', name: 'Crystal Mountains', icon: '🏔️', desc: 'Falaises, cascades et l\'entrée des mines de cristal.', music: 'mountain', unlockHint: 'Brisez le rocher du col avec une pioche en cuivre.', map: [0.42, 0.17], size: [52, 48], ground: 0x9ab87a, ground2: 0x8aa070, cliff: 0x9a9aa8, water: 0x6ad0f0, sky: [0x9ad8ff, 0xf0f8ff], fog: 0xd8e8f4, outdoor: true },
  { id: 'coast', name: 'Sunny Coast', icon: '🌊', desc: 'Plage dorée, petites îles, coquillages et grand large.', music: 'beach', unlockHint: 'Restaurez la boutique de pêche de Niko.', map: [0.78, 0.72], size: [56, 48], ground: 0xf4e0a8, ground2: 0x9ad46a, cliff: 0xd8b880, water: 0x3ac8e0, sky: [0x7fd8ff, 0xfff8e0], fog: 0xd8f4f8, outdoor: true },
  { id: 'frosty', name: 'Frosty Peaks', icon: '❄️', desc: 'Sommets enneigés, aurores et animaux rares.', music: 'winter', unlockHint: 'Fabriquez un manteau chaud.', map: [0.66, 0.12], size: [48, 46], ground: 0xf0f6ff, ground2: 0xd8e8f8, cliff: 0x9ab0c8, water: 0x9ad8f0, sky: [0xb8d8ff, 0xf4f8ff], fog: 0xe8f0ff, outdoor: true },
  { id: 'ember', name: 'Ember Valley', icon: '🌋', desc: 'Volcans endormis, rivières de lave, minerais rarissimes.', music: 'ember', unlockHint: 'Trouvez la clé de braise au 15e niveau de la mine.', map: [0.86, 0.32], size: [48, 46], ground: 0x8a6a5a, ground2: 0x6a5048, cliff: 0x4a3a3a, water: 0xff6a2a, sky: [0xffb08a, 0xffe0c0], fog: 0xe8b8a0, outdoor: true },
  { id: 'mine', name: 'Mines de cristal', icon: '⛏️', desc: 'Des galeries qui descendent toujours plus profond.', music: 'cave', unlockHint: 'Entrée dans Crystal Mountains.', map: [0.5, 0.22], size: [22, 22], ground: 0x8a7a70, ground2: 0x7a6a62, cliff: 0x5a4a48, water: 0x4ab0c8, sky: [0x1a1420, 0x2a2030], fog: 0x1a1420, outdoor: false },
  { id: 'house', name: 'Maison', icon: '🏡', desc: 'Votre chez-vous.', music: 'home', unlockHint: '', map: [0.36, 0.55], size: [22, 16], ground: 0xc8925a, ground2: 0xb07a4a, cliff: 0xfff3dc, water: 0x5ac8e8, sky: [0xfff4e0, 0xfff4e0], fog: 0xfff4e0, outdoor: false },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;
