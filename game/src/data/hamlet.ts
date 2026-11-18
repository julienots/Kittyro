import { TEX } from '../models/tex';

/**
 * The Hamlet ("Hameau de Clairefontaine"): an empty clearing south of the farm
 * where the player builds a village from scratch. Homes attract villagers,
 * workplaces give them jobs, and every morning their work fills the hamlet chest.
 */

export type HamletKind = 'home' | 'work' | 'service';

export interface HamletBuildingDef {
  id: string;
  name: string;
  icon: string;
  kind: HamletKind;
  size: [number, number];
  coins: number;
  items: [string, number][];
  desc: string;
  /** beds for villagers (homes) */
  beds?: number;
  /** worker slots (workplaces) */
  jobs?: number;
  /** job title shown on villagers */
  job?: string;
  /** daily output per worker at 100% happiness. Season-specific outputs use `season`. */
  output?: { id: string; qty: number; season?: string[] }[];
  /** coins per worker per day (tavern, market) */
  coinsPerWorker?: number;
  /** happiness/appeal bonus for the whole hamlet */
  appeal: number;
  max: number;
  level: number; // hamlet level required
  roof: number;
  wall: number;
  mat: number;
  roofTex: number;
}

const B = (d: Omit<HamletBuildingDef, 'mat' | 'roofTex'> & { mat?: number; roofTex?: number }): HamletBuildingDef => ({ mat: TEX.plaster, roofTex: TEX.shingle, ...d });

export const HAMLET_BUILDINGS: HamletBuildingDef[] = [
  // ---- homes
  B({ id: 'h_hut', name: 'Cabane', icon: '🛖', kind: 'home', size: [2, 2], coins: 150, items: [['wood', 20], ['fiber', 10]], desc: 'Un abri simple pour 1 villageois.', beds: 1, appeal: 0, max: 8, level: 1, roof: 0xc8a050, wall: 0xa87a4a, mat: TEX.log, roofTex: TEX.thatch }),
  B({ id: 'h_cottage', name: 'Chaumière', icon: '🏠', kind: 'home', size: [3, 3], coins: 600, items: [['wood', 40], ['stone', 15], ['thatch', 4]], desc: 'Une jolie maison au toit de chaume pour 2 villageois.', beds: 2, appeal: 2, max: 8, level: 1, roof: 0xd8b060, wall: 0xfff0d8, roofTex: TEX.thatch }),
  B({ id: 'h_stonehouse', name: 'Maison de pierre', icon: '🏡', kind: 'home', size: [4, 3], coins: 2200, items: [['cut_stone', 12], ['timber', 8], ['glass', 4]], desc: 'Solide et chaleureuse : 4 villageois.', beds: 4, appeal: 4, max: 6, level: 2, roof: 0x5a7aa8, wall: 0xd8d0c0, mat: TEX.stone }),
  B({ id: 'h_manor', name: 'Grande demeure', icon: '🏘️', kind: 'home', size: [4, 4], coins: 6000, items: [['cut_stone', 25], ['timber', 20], ['brick', 20], ['glass', 10]], desc: 'Une belle demeure à colombages pour 6 villageois.', beds: 6, appeal: 8, max: 3, level: 4, roof: 0xb84a3a, wall: 0xfff4e0, mat: TEX.brick }),
  // ---- workplaces
  B({ id: 'h_lumber', name: 'Scierie', icon: '🪚', kind: 'work', size: [3, 3], coins: 400, items: [['wood', 30], ['stone', 10]], desc: 'Bûcherons : bois, bois dur et poutres chaque matin.', jobs: 2, job: 'Bûcheron·ne', output: [{ id: 'wood', qty: 5 }, { id: 'hardwood', qty: 0.6 }, { id: 'timber', qty: 0.7 }], appeal: 0, max: 3, level: 1, roof: 0x6a8a4a, wall: 0xb07a4a, mat: TEX.plank }),
  B({ id: 'h_quarry', name: 'Carrière', icon: '⛏️', kind: 'work', size: [3, 3], coins: 400, items: [['wood', 25], ['stone', 20]], desc: 'Tailleurs de pierre : pierre, argile, charbon et pierre taillée.', jobs: 2, job: 'Tailleur·se de pierre', output: [{ id: 'stone', qty: 5 }, { id: 'clay', qty: 1 }, { id: 'coal', qty: 0.6 }, { id: 'cut_stone', qty: 0.7 }], appeal: -1, max: 3, level: 1, roof: 0x7a7a8a, wall: 0xb8b0a0, mat: TEX.stone }),
  B({ id: 'h_fields', name: 'Champs communaux', icon: '🌾', kind: 'work', size: [4, 3], coins: 500, items: [['wood', 20], ['fiber', 20]], desc: 'Paysans : récoltes de saison et chaume.', jobs: 3, job: 'Paysan·ne', output: [{ id: 'wheat', qty: 2, season: ['spring', 'summer', 'autumn'] }, { id: 'carrot', qty: 1, season: ['spring'] }, { id: 'tomato', qty: 1, season: ['summer'] }, { id: 'pumpkin', qty: 0.4, season: ['autumn'] }, { id: 'kale', qty: 1.5, season: ['winter'] }, { id: 'thatch', qty: 0.8 }], appeal: 1, max: 3, level: 1, roof: 0xd8b060, wall: 0xc8a06a, mat: TEX.plank, roofTex: TEX.thatch }),
  B({ id: 'h_fishery', name: 'Cabane de pêche', icon: '🎣', kind: 'work', size: [3, 2], coins: 700, items: [['wood', 30], ['rope', 6]], desc: 'Pêcheurs : poissons frais et appâts.', jobs: 2, job: 'Pêcheur·se', output: [{ id: 'minnow', qty: 1 }, { id: 'carp', qty: 0.6 }, { id: 'perch', qty: 0.4 }, { id: 'bait', qty: 1 }], appeal: 1, max: 2, level: 1, roof: 0x4a8ab8, wall: 0xe8dcc0, mat: TEX.plank }),
  B({ id: 'h_bakery', name: 'Fournil', icon: '🥖', kind: 'work', size: [3, 3], coins: 1500, items: [['brick', 15], ['timber', 4], ['stone', 20]], desc: 'Boulangers : pain, cookies et tourtes. Les villageois adorent l\'odeur du pain chaud (+bonheur).', jobs: 2, job: 'Boulanger·e', output: [{ id: 'bread', qty: 0.8 }, { id: 'cookies', qty: 0.5 }, { id: 'veggie_pie', qty: 0.3 }], appeal: 3, max: 1, level: 2, roof: 0xe8a33a, wall: 0xfff0d8, mat: TEX.brick }),
  B({ id: 'h_weaver', name: 'Atelier de tissage', icon: '🧶', kind: 'work', size: [3, 2], coins: 1800, items: [['timber', 6], ['plank', 10], ['rope', 6]], desc: 'Tisserands : corde, tissu et paniers.', jobs: 2, job: 'Tisserand·e', output: [{ id: 'rope', qty: 2 }, { id: 'cloth', qty: 0.4 }, { id: 'wicker_basket', qty: 0.4 }], appeal: 1, max: 1, level: 2, roof: 0xb08ae8, wall: 0xf4e6c8, mat: TEX.plank }),
  B({ id: 'h_smithy', name: 'Forge du hameau', icon: '⚒️', kind: 'work', size: [3, 3], coins: 3500, items: [['cut_stone', 15], ['iron_bar', 3], ['coal', 10]], desc: 'Forgerons : lingots de cuivre et de fer.', jobs: 2, job: 'Forgeron·ne', output: [{ id: 'copper_bar', qty: 0.7 }, { id: 'iron_bar', qty: 0.35 }], appeal: -1, max: 1, level: 3, roof: 0x4a4a5a, wall: 0x9a948a, mat: TEX.stone }),
  B({ id: 'h_apiary', name: 'Rucher', icon: '🐝', kind: 'work', size: [3, 2], coins: 1200, items: [['timber', 4], ['wood', 30], ['fiber', 20]], desc: 'Apiculteurs : miel et cire d\'abeille.', jobs: 1, job: 'Apiculteur·rice', output: [{ id: 'honey', qty: 0.8, season: ['spring', 'summer', 'autumn'] }, { id: 'beeswax', qty: 0.8, season: ['spring', 'summer', 'autumn'] }], appeal: 2, max: 2, level: 2, roof: 0xffc42a, wall: 0xf4d27a, mat: TEX.plank, roofTex: TEX.thatch }),
  B({ id: 'h_tavern', name: 'Taverne du Lapin Joyeux', icon: '🍺', kind: 'work', size: [4, 3], coins: 2500, items: [['timber', 10], ['plank', 20], ['glass', 4]], desc: 'Le cœur du hameau ! Gros bonus de bonheur, rapporte des pièces et sert du cidre.', jobs: 2, job: 'Aubergiste', coinsPerWorker: 60, output: [{ id: 'cider', qty: 0.5 }], appeal: 8, max: 1, level: 2, roof: 0x8a4a3a, wall: 0xf0dcb8, mat: TEX.plank }),
  B({ id: 'h_market', name: 'Halle du marché', icon: '🏪', kind: 'work', size: [4, 3], coins: 4000, items: [['timber', 16], ['cut_stone', 10], ['cloth', 4]], desc: 'Marchands : rapporte des pièces chaque jour selon la population.', jobs: 3, job: 'Marchand·e', coinsPerWorker: 90, appeal: 4, max: 1, level: 3, roof: 0x5aa8c8, wall: 0xfff8e8, mat: TEX.plaster }),
  // ---- services
  B({ id: 'h_well', name: 'Puits du hameau', icon: '🪣', kind: 'service', size: [1, 1], coins: 200, items: [['stone', 20], ['wood', 5]], desc: 'De l\'eau fraîche pour tous (+bonheur).', appeal: 4, max: 3, level: 1, roof: 0xc8463a, wall: 0xb8b0a0, mat: TEX.stone }),
  B({ id: 'h_bandstand', name: 'Kiosque à musique', icon: '🎶', kind: 'service', size: [3, 3], coins: 3000, items: [['timber', 10], ['plank', 20], ['copper_bar', 4]], desc: 'Concerts au crépuscule ! Gros bonus de bonheur.', appeal: 10, max: 1, level: 3, roof: 0x6a9ad8, wall: 0xffffff }),
  B({ id: 'h_statue', name: 'Statue du fondateur', icon: '🗿', kind: 'service', size: [2, 2], coins: 5000, items: [['cut_stone', 30], ['gold_bar', 2]], desc: 'Votre statue, au centre du hameau. Les villageois sont fiers (+bonheur).', appeal: 12, max: 1, level: 4, roof: 0xd8d0c8, wall: 0xb8b0a8, mat: TEX.stone }),
];
export const HAMLET_BY_ID: Record<string, HamletBuildingDef> = Object.fromEntries(HAMLET_BUILDINGS.map((b) => [b.id, b]));

export interface HamletLevel {
  level: number;
  name: string;
  pop: number; // villagers needed
  gems: number;
  reward: string;
}
export const HAMLET_LEVELS: HamletLevel[] = [
  { level: 1, name: 'Campement', pop: 0, gems: 0, reward: '' },
  { level: 2, name: 'Hameau', pop: 3, gems: 10, reward: 'Fournil, taverne, tissage, rucher et maisons de pierre' },
  { level: 3, name: 'Village', pop: 7, gems: 20, reward: 'Forge, halle du marché et kiosque à musique' },
  { level: 4, name: 'Bourg', pop: 12, gems: 30, reward: 'Grande demeure et statue du fondateur' },
  { level: 5, name: 'Petite ville', pop: 18, gems: 50, reward: 'Le titre de Maire·sse de Clairefontaine 🎖️' },
];

export const VILLAGER_TRAITS = {
  gourmand: { name: 'Gourmand·e', icon: '🍰', wishes: ['bread', 'cookies', 'berry_pie', 'omelette', 'jam', 'apple', 'strawberry', 'cider', 'veggie_pie', 'honey'] },
  jardinier: { name: 'Main verte', icon: '🌷', wishes: ['tulip', 'sunflower', 'rose', 'daisy', 'carrot', 'lettuce', 'herb', 'mint', 'fertilizer'] },
  pecheur: { name: 'Amoureux·se de l\'eau', icon: '🐟', wishes: ['minnow', 'carp', 'perch', 'trout', 'bait', 'seashell', 'grilled_fish'] },
  bricoleur: { name: 'Bricoleur·se', icon: '🔧', wishes: ['plank', 'rope', 'copper_bar', 'iron_bar', 'brick', 'glass', 'timber'] },
  reveur: { name: 'Rêveur·se', icon: '✨', wishes: ['crystal_shard', 'amethyst', 'moonstone', 'pearl', 'glowcap', 'honey_tea', 'feather'] },
  fetard: { name: 'Fêtard·e', icon: '🎉', wishes: ['cider', 'pizza', 'cupcake', 'smoothie', 'cookies', 'hot_cocoa', 'roasted_corn'] },
} as const;
export type TraitId = keyof typeof VILLAGER_TRAITS;
export const TRAIT_IDS = Object.keys(VILLAGER_TRAITS) as TraitId[];

export const VILLAGER_NAMES = [
  'Albin', 'Rosalie', 'Basile', 'Capucine', 'Célestin', 'Prune', 'Firmin', 'Mirabelle', 'Gaston', 'Pâquerette', 'Hippolyte', 'Violette',
  'Jules', 'Clémence', 'Léon', 'Margaux', 'Marius', 'Noisette', 'Octave', 'Perrine', 'Sacha', 'Romane', 'Tiago', 'Suzon', 'Valentin',
  'Anouk', 'Barnabé', 'Colette', 'Désiré', 'Élise', 'Fernand', 'Gaëlle', 'Honoré', 'Iris', 'Joachim', 'Lison', 'Maël', 'Ninon', 'Oscar', 'Pia',
];

/** Lines by trait and mood. {name} = player name, {hamlet} = hamlet name. */
export const VILLAGER_LINES: Record<'happy' | 'ok' | 'sad', string[]> = {
  happy: [
    'Quelle belle journée à {hamlet} ! Merci de nous avoir accueillis.',
    'Je n\'ai jamais été aussi heureux·se ailleurs qu\'ici.',
    'Tu as vu les fleurs près du puits ? C\'est toi qui les as plantées ?',
    'Les voisins sont adorables. On organise un pique-nique bientôt !',
    'Le matin, on entend les oiseaux depuis ma fenêtre. Un bonheur.',
  ],
  ok: [
    'Bonjour {name} ! Le hameau grandit vite.',
    'Il manque encore un petit quelque chose pour que ce soit parfait…',
    'Un peu plus de décorations rendrait la place plus vivante, non ?',
    'Le travail avance bien. On sera prêts pour la récolte.',
    'Tu crois qu\'on aura une taverne un jour ? On en rêve tous.',
  ],
  sad: [
    'Je n\'ai pas de vrai toit… une cabane me suffirait, tu sais.',
    'Je m\'ennuie un peu sans travail. Il y aurait une place à la scierie ?',
    'Le hameau est un peu triste. Un puits, des fleurs, un banc… ça aiderait.',
  ],
};

export const TRAIT_LINES: Record<TraitId, string[]> = {
  gourmand: ['L\'odeur du pain chaud, il n\'y a rien de mieux.', 'Tu as goûté le cidre de la taverne ? Divin.'],
  jardinier: ['J\'ai repéré un coin parfait pour un massif de tulipes.', 'Les abeilles sont de retour, c\'est bon signe.'],
  pecheur: ['Hier j\'ai vu une carpe énorme dans le ruisseau !', 'Rien ne vaut l\'aube au bord de l\'eau.'],
  bricoleur: ['J\'ai réparé la barrière de mon voisin ce matin.', 'Donne-moi des planches et je construis n\'importe quoi.'],
  reveur: ['La nuit, les lucioles dessinent des étoiles au-dessus des champs.', 'Je crois qu\'un esprit de la forêt veille sur nous.'],
  fetard: ['Et si on faisait une fête ce soir ? Allez !', 'Un kiosque à musique… imagine les bals d\'été !'],
};

/** Guided goals shown in the hamlet register — a gentle tutorial with rewards. */
export interface HamletGoal {
  id: string;
  text: string;
  hint: string;
  reward: { coins?: number; gems?: number; items?: [string, number][] };
}
export const HAMLET_GOALS: HamletGoal[] = [
  { id: 'g_home', text: 'Construire un premier logement', hint: 'Ouvrez 🔨 Construire ici, choisissez une Cabane et placez-la sur l\'herbe.', reward: { coins: 200, items: [['thatch', 4]] } },
  { id: 'g_villager', text: 'Accueillir un premier villageois', hint: 'Dormez une nuit : un voyageur s\'installe dans chaque logement libre.', reward: { coins: 200, gems: 3 } },
  { id: 'g_work', text: 'Construire un lieu de travail', hint: 'Scierie, carrière, champs ou cabane de pêche : vos villageois y travaillent tout seuls.', reward: { items: [['timber', 4], ['cut_stone', 4]] } },
  { id: 'g_collect', text: 'Récupérer la production du hameau', hint: 'Chaque matin, le coffre du registre se remplit. Ouvrez le registre 📒 et touchez « Tout récupérer ».', reward: { coins: 300 } },
  { id: 'g_wish', text: 'Exaucer le souhait d\'un villageois', hint: 'Parlez aux villageois avec une bulle 💭 et apportez-leur ce qu\'ils désirent.', reward: { gems: 5, items: [['path_cobble', 10]] } },
  { id: 'g_decor', text: 'Placer 3 décorations au hameau', hint: 'Bancs, fleurs, lanternes… La beauté rend les villageois heureux (et en attire de nouveaux).', reward: { items: [['hamlet_banner', 1], ['lantern_blue', 2]] } },
  { id: 'g_pop3', text: 'Atteindre 3 villageois (niveau Hameau)', hint: 'Construisez plus de logements. Un hameau heureux attire du monde.', reward: { coins: 800, items: [['flowerbed_purple', 4]] } },
  { id: 'g_tavern', text: 'Ouvrir la taverne', hint: 'La Taverne du Lapin Joyeux se débloque au niveau Hameau.', reward: { gems: 8, items: [['cider', 3]] } },
  { id: 'g_happy', text: 'Bonheur moyen de 80 % ou plus', hint: 'Logement + travail + puits + décorations + taverne = villageois aux anges.', reward: { gems: 10, items: [['fox_statue', 1]] } },
  { id: 'g_pop7', text: 'Atteindre 7 villageois (niveau Village)', hint: 'Les maisons de pierre logent 4 villageois.', reward: { coins: 2000, gems: 10 } },
  { id: 'g_pop12', text: 'Atteindre 12 villageois (niveau Bourg)', hint: 'Le marché et le kiosque rendent le hameau irrésistible.', reward: { coins: 4000, gems: 20 } },
];

/** Buildable area of the hamlet clearing (inclusive min, exclusive max). */
export const HAMLET_AREA = { minX: 6, maxX: 46, minZ: 7, maxZ: 40 };
export const HAMLET_NAME = 'Clairefontaine';
