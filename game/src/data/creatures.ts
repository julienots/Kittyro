import type { Rarity, Season, WeatherType } from '../state/types';

export type CreatureShape = 'blob' | 'bunny' | 'bird' | 'sprite' | 'shroom' | 'fluff' | 'lizard' | 'jelly' | 'fox';

export interface CreatureDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  regions: string[];
  seasons: Season[] | 'all';
  time: 'any' | 'day' | 'night' | 'dawn' | 'dusk';
  weather?: WeatherType[];
  shape: CreatureShape;
  body: number;
  accent: number;
  glow?: boolean;
  /** behaviour: shy creatures flee unless approached slowly */
  shy: number; // 0..1
}

/**
 * Original "Meadowkin" — little wild spirits of the valley. Discovering them fills the Bestiary.
 * They never fight: you approach gently, and they let you note them in your journal.
 */
export const CREATURES: CreatureDef[] = [
  { id: 'mossling', name: 'Moussinet', desc: 'Une petite boule de mousse qui ronronne quand on la frôle.', rarity: 'common', regions: ['farm', 'woods'], seasons: 'all', time: 'any', shape: 'blob', body: 0x7fbf5a, accent: 0x4f8f3a, shy: 0.2 },
  { id: 'puffcap', name: 'Bouffechapeau', desc: 'Un champignon timide qui éternue des spores dorées.', rarity: 'common', regions: ['woods'], seasons: ['spring', 'summer', 'autumn'], time: 'any', shape: 'shroom', body: 0xf2e6d0, accent: 0xe85a4a, shy: 0.4 },
  { id: 'dewbun', name: 'Lapirosée', desc: 'Apparaît dans l\'herbe humide du matin. Ses oreilles retiennent la rosée.', rarity: 'common', regions: ['farm', 'village'], seasons: ['spring', 'summer'], time: 'dawn', shape: 'bunny', body: 0xe8f4ff, accent: 0x9ad8ff, shy: 0.5 },
  { id: 'chirpkin', name: 'Piaillon', desc: 'Un oiseau rond qui chante faux mais avec beaucoup de cœur.', rarity: 'common', regions: ['farm', 'village', 'woods'], seasons: 'all', time: 'day', shape: 'bird', body: 0xffc94a, accent: 0xff8a3a, shy: 0.6 },
  { id: 'pebblet', name: 'Caillounet', desc: 'Ressemble à un galet... jusqu\'à ce qu\'il cligne des yeux.', rarity: 'common', regions: ['mountains', 'coast', 'mine'], seasons: 'all', time: 'any', shape: 'blob', body: 0xa8a8b0, accent: 0x7a7a88, shy: 0.1 },
  { id: 'glowmite', name: 'Lumimite', desc: 'Minuscule étincelle qui suit les lanternes.', rarity: 'common', regions: ['village', 'farm'], seasons: 'all', time: 'night', shape: 'sprite', body: 0xfff27a, accent: 0xffd03a, glow: true, shy: 0.3 },
  { id: 'tidebun', name: 'Lapimarée', desc: 'Bondit d\'une flaque à l\'autre sur la plage.', rarity: 'uncommon', regions: ['coast'], seasons: ['summer', 'spring'], time: 'day', shape: 'bunny', body: 0x8ad8e8, accent: 0xffffff, shy: 0.5 },
  { id: 'fernfox', name: 'Renardfougère', desc: 'Sa queue est une grande fronde de fougère.', rarity: 'uncommon', regions: ['woods'], seasons: 'all', time: 'dusk', shape: 'fox', body: 0x6aa84f, accent: 0xd8f0a0, shy: 0.7 },
  { id: 'cloudpuff', name: 'Nuageon', desc: 'Un petit nuage égaré qui fait pleuvoir sur les fleurs.', rarity: 'uncommon', regions: ['farm', 'mountains'], seasons: 'all', time: 'day', weather: ['cloudy', 'rain'], shape: 'fluff', body: 0xffffff, accent: 0xc8d8f0, shy: 0.3 },
  { id: 'snailsprout', name: 'Escargerme', desc: 'Sa coquille est un pot de fleurs ambulant.', rarity: 'uncommon', regions: ['farm', 'woods', 'village'], seasons: ['spring', 'summer', 'autumn'], time: 'any', weather: ['rain'], shape: 'blob', body: 0xd8b07a, accent: 0xff7aa8, shy: 0.1 },
  { id: 'shellsprite', name: 'Coquillutin', desc: 'Il habite un coquillage nacré et collectionne les reflets.', rarity: 'uncommon', regions: ['coast'], seasons: 'all', time: 'dusk', shape: 'jelly', body: 0xffd8e8, accent: 0xb8a0ff, shy: 0.4 },
  { id: 'emberkit', name: 'Braisillon', desc: 'Un chaton de braise qui adore les pierres chaudes.', rarity: 'uncommon', regions: ['ember'], seasons: 'all', time: 'any', shape: 'fox', body: 0xff6a2a, accent: 0xffd03a, glow: true, shy: 0.5 },
  { id: 'snowpuff', name: 'Floconou', desc: 'Une boule de neige vivante. Fond de bonheur quand on la câline.', rarity: 'uncommon', regions: ['frosty'], seasons: 'all', time: 'any', shape: 'fluff', body: 0xf4f8ff, accent: 0xa8d0ff, shy: 0.3 },
  { id: 'crystaline', name: 'Cristalline', desc: 'Un lézard aux écailles de quartz, chante quand il fait froid.', rarity: 'rare', regions: ['mountains', 'mine'], seasons: 'all', time: 'any', shape: 'lizard', body: 0xc8e8ff, accent: 0x9a7aff, glow: true, shy: 0.6 },
  { id: 'lanternmoth', name: 'Phalanterne', desc: 'Porte une petite lanterne pour retrouver son chemin.', rarity: 'rare', regions: ['woods', 'village'], seasons: ['summer', 'autumn'], time: 'night', shape: 'sprite', body: 0xffb06a, accent: 0xfff0a0, glow: true, shy: 0.5 },
  { id: 'rainfrog', name: 'Grenouille-parapluie', desc: 'Elle porte une feuille en guise de parapluie.', rarity: 'rare', regions: ['farm', 'woods'], seasons: ['spring', 'summer'], time: 'any', weather: ['rain', 'storm'], shape: 'blob', body: 0x5ac86a, accent: 0xffd03a, shy: 0.4 },
  { id: 'acornling', name: 'Glandinou', desc: 'Il plante des glands partout et oublie où.', rarity: 'rare', regions: ['woods'], seasons: ['autumn'], time: 'day', shape: 'blob', body: 0xb07a4a, accent: 0x6a4a2a, shy: 0.7 },
  { id: 'seafoam', name: 'Écumette', desc: 'Faite d\'écume, elle disparaît au moindre bruit.', rarity: 'rare', regions: ['coast'], seasons: 'all', time: 'dawn', shape: 'jelly', body: 0xe8fff8, accent: 0x8af0e0, shy: 0.8 },
  { id: 'frostowl', name: 'Hibougivre', desc: 'Veille sur les sommets enneigés, ses yeux brillent comme la glace.', rarity: 'rare', regions: ['frosty'], seasons: 'all', time: 'night', shape: 'bird', body: 0xe8f0ff, accent: 0x7ab8ff, shy: 0.6 },
  { id: 'cindermole', name: 'Taupe cendrée', desc: 'Creuse des tunnels tièdes sous la lave refroidie.', rarity: 'rare', regions: ['ember', 'mine'], seasons: 'all', time: 'any', shape: 'blob', body: 0x5a4a4a, accent: 0xff8a3a, shy: 0.5 },
  { id: 'bloomdeer', name: 'Faonfleur', desc: 'Des fleurs poussent dans ses bois à chaque printemps.', rarity: 'epic', regions: ['woods', 'farm'], seasons: ['spring'], time: 'dawn', shape: 'fox', body: 0xf0d0b0, accent: 0xff9ac8, shy: 0.8 },
  { id: 'starling', name: 'Étoilin', desc: 'Une étoile tombée qui cherche à remonter au ciel.', rarity: 'epic', regions: ['mountains', 'frosty', 'farm'], seasons: 'all', time: 'night', weather: ['sun', 'cloudy'], shape: 'sprite', body: 0xfff8c0, accent: 0xffffff, glow: true, shy: 0.6 },
  { id: 'geodragon', name: 'Géodragonnet', desc: 'Un minuscule dragon qui dort dans les géodes.', rarity: 'epic', regions: ['mine'], seasons: 'all', time: 'any', shape: 'lizard', body: 0x9a6ad8, accent: 0xffd0ff, glow: true, shy: 0.4 },
  { id: 'auroracat', name: 'Chat aurore', desc: 'Son pelage change de couleur comme les aurores.', rarity: 'epic', regions: ['frosty'], seasons: ['winter'], time: 'night', shape: 'fox', body: 0x9af0d8, accent: 0xd89aff, glow: true, shy: 0.7 },
  { id: 'lavapup', name: 'Chiot de lave', desc: 'Remue la queue en crachant de petites étincelles.', rarity: 'epic', regions: ['ember'], seasons: 'all', time: 'dusk', shape: 'fox', body: 0x3a2a2a, accent: 0xff5a1a, glow: true, shy: 0.4 },
  { id: 'rainbowkin', name: 'Arcenciel', desc: 'Ne se montre que lorsqu\'un arc-en-ciel traverse la vallée.', rarity: 'mythic', regions: ['farm', 'village', 'woods', 'coast'], seasons: 'all', time: 'day', shape: 'fluff', body: 0xffb0e0, accent: 0x9ae0ff, glow: true, shy: 0.5 },
  { id: 'moonwhale', name: 'Baleine de lune', desc: 'Flotte dans le ciel les nuits claires au-dessus de la mer.', rarity: 'mythic', regions: ['coast'], seasons: 'all', time: 'night', weather: ['sun'], shape: 'jelly', body: 0xb8c8ff, accent: 0xffffff, glow: true, shy: 0.3 },
  { id: 'mossking', name: 'Roi Moussu', desc: 'Le gardien ancien de la vallée. On dit qu\'il a planté la première graine.', rarity: 'mythic', regions: ['woods'], seasons: 'all', time: 'night', weather: ['fog'], shape: 'blob', body: 0x4f8f3a, accent: 0xffd03a, glow: true, shy: 0.5 },
  { id: 'phoenixling', name: 'Phénixou', desc: 'Renaît chaque matin d\'une braise tiède.', rarity: 'mythic', regions: ['ember'], seasons: ['summer'], time: 'dawn', shape: 'bird', body: 0xffa02a, accent: 0xff3a2a, glow: true, shy: 0.6 },
  { id: 'yetibun', name: 'Lapin yéti', desc: 'Énorme lapin tout doux qui hiberne dans la neige.', rarity: 'rare', regions: ['frosty'], seasons: ['winter', 'autumn'], time: 'day', shape: 'bunny', body: 0xffffff, accent: 0xd0e0ff, shy: 0.5 },
];

export const CREATURE_BY_ID: Record<string, CreatureDef> = Object.fromEntries(CREATURES.map((c) => [c.id, c]));
