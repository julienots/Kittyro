import type { QuestKind, QuestState } from '../state/types';

export interface QuestTemplate {
  id: string;
  kind: QuestKind;
  title: string;
  desc: string;
  giver?: string;
  objectives: { type: string; target?: string; count: number }[];
  rewards: QuestState['rewards'];
  /** side-effect key applied on completion (unlock region, give items...) */
  effect?: string;
}

/** The main story: "Le renouveau de la vallée". Linear but never time-limited. */
export const STORY: QuestTemplate[] = [
  { id: 's0', kind: 'story', giver: 'moss', title: 'Bienvenue à Green Valley', desc: 'Parlez à Moss, le vieux jardinier, qui vous attend près de la maison.', objectives: [{ type: 'talk', target: 'moss', count: 1 }], rewards: { coins: 100, items: [{ id: 'seed_lettuce', qty: 6 }, { id: 'seed_carrot', qty: 4 }] } },
  { id: 'sh', kind: 'story', giver: 'moss', title: 'Un toit sur la tête', desc: 'La maison de grand-mère Rose tombe en ruine. Rassemblez 20 bois et 10 pierres, puis réparez-la devant la porte.', objectives: [{ type: 'repair', target: 'house', count: 1 }], rewards: { coins: 150, xp: 40, items: [{ id: 'bread', qty: 2 }] } },
  { id: 's1', kind: 'story', giver: 'moss', title: 'Premiers sillons', desc: 'Préparez la terre avec la houe, plantez des graines et arrosez-les.', objectives: [{ type: 'till', count: 6 }, { type: 'plant', count: 6 }, { type: 'water', count: 6 }], rewards: { coins: 150, xp: 40 } },
  { id: 's2', kind: 'story', giver: 'moss', title: 'La première récolte', desc: 'Récoltez 5 légumes. (Astuce : la salade pousse vite !)', objectives: [{ type: 'harvest', target: '*', count: 5 }], rewards: { coins: 200, xp: 50, items: [{ id: 'seed_wheat', qty: 10 }] } },
  { id: 's3', kind: 'story', giver: 'moss', title: 'Le chemin du village', desc: 'Suivez le chemin à l\'est pour découvrir Willowbrook et rencontrer Mallow.', objectives: [{ type: 'visit', target: 'village', count: 1 }, { type: 'talk', target: 'mallow', count: 1 }], rewards: { coins: 200, xp: 40 } },
  { id: 's4', kind: 'story', giver: 'mallow', title: 'Les affaires reprennent', desc: 'Vendez 10 objets dans la caisse d\'expédition de la ferme ou chez Mallow.', objectives: [{ type: 'sell', target: '*', count: 10 }], rewards: { coins: 300, xp: 60 } },
  { id: 's5', kind: 'story', giver: 'moss', title: 'Du bois et de la pierre', desc: 'Coupez des arbres et cassez des pierres autour de la ferme.', objectives: [{ type: 'collect', target: 'wood', count: 30 }, { type: 'collect', target: 'stone', count: 15 }], rewards: { coins: 300, xp: 60 } },
  { id: 's6', kind: 'story', giver: 'mallow', title: 'Rouvrir la boutique', desc: 'Restaurez la boutique de Mallow au village.', objectives: [{ type: 'restore', target: 'shop', count: 1 }], rewards: { coins: 500, gems: 10, xp: 100 } },
  { id: 's7', kind: 'story', giver: 'hazel', title: 'Un toit pour les poules', desc: 'Construisez un poulailler sur la ferme puis adoptez une poule.', objectives: [{ type: 'build', target: 'coop', count: 1 }, { type: 'adopt', target: 'chicken', count: 1 }], rewards: { coins: 400, xp: 80, items: [{ id: 'hay', qty: 20 }] } },
  { id: 's8', kind: 'story', giver: 'toma', title: 'L\'atelier de Toma', desc: 'Restaurez l\'atelier de Toma pour améliorer vos outils.', objectives: [{ type: 'restore', target: 'workshop', count: 1 }], rewards: { coins: 600, gems: 10, xp: 120 } },
  { id: 's9', kind: 'story', giver: 'moss', title: 'Le pont de la forêt', desc: 'Apportez 30 planches au vieux pont au nord-ouest de la ferme pour ouvrir Whispering Woods.', objectives: [{ type: 'deliver', target: 'plank', count: 30 }], rewards: { coins: 500, xp: 120 }, effect: 'unlock_woods' },
  { id: 's10', kind: 'story', giver: 'bibi', title: 'Expédition forestière', desc: 'Explorez Whispering Woods et découvrez 3 créatures pour le bestiaire.', objectives: [{ type: 'visit', target: 'woods', count: 1 }, { type: 'discover', target: '*', count: 3 }], rewards: { coins: 600, gems: 15, xp: 150 } },
  { id: 's11', kind: 'story', giver: 'brie', title: 'Le four de Brie', desc: 'Restaurez la boulangerie.', objectives: [{ type: 'restore', target: 'bakery', count: 1 }], rewards: { coins: 700, xp: 150 } },
  { id: 's12', kind: 'story', giver: 'bibi', title: 'Le rocher du col', desc: 'Améliorez votre pioche en cuivre chez Toma puis brisez le rocher qui bloque Crystal Mountains.', objectives: [{ type: 'upgrade', target: 'pickaxe', count: 1 }, { type: 'break_boulder', target: 'mountains', count: 1 }], rewards: { coins: 800, gems: 15, xp: 180 }, effect: 'unlock_mountains' },
  { id: 's13', kind: 'story', giver: 'niko', title: 'L\'appel du large', desc: 'Restaurez la boutique de pêche de Niko pour ouvrir la route de Sunny Coast.', objectives: [{ type: 'restore', target: 'fishing_shop', count: 1 }], rewards: { coins: 800, xp: 180 }, effect: 'unlock_coast' },
  { id: 's14', kind: 'story', giver: 'bibi', title: 'Les profondeurs', desc: 'Descendez au niveau 5 des mines de cristal.', objectives: [{ type: 'mine_depth', count: 5 }], rewards: { coins: 1000, gems: 20, xp: 220 } },
  { id: 's15', kind: 'story', giver: 'hazel', title: 'Un manteau pour les cimes', desc: 'Fabriquez un manteau chaud (tissu, laine, corde) pour affronter Frosty Peaks.', objectives: [{ type: 'craft', target: 'warm_coat', count: 1 }], rewards: { coins: 1000, xp: 220 }, effect: 'unlock_frosty' },
  { id: 's16', kind: 'story', giver: 'pippa', title: 'La vallée en fleurs', desc: 'Restaurez la boutique de Pippa et l\'écurie.', objectives: [{ type: 'restore', target: 'florist', count: 1 }, { type: 'restore', target: 'stable', count: 1 }], rewards: { coins: 1500, gems: 20, xp: 260 } },
  { id: 's17', kind: 'story', giver: 'bibi', title: 'La clé de braise', desc: 'Atteignez le niveau 15 de la mine pour trouver la clé de braise.', objectives: [{ type: 'mine_depth', count: 15 }], rewards: { coins: 2000, gems: 25, xp: 320 }, effect: 'unlock_ember' },
  { id: 's18', kind: 'story', giver: 'mallow', title: 'Le cœur du village', desc: 'Restaurez le marché et la fontaine de la place.', objectives: [{ type: 'restore', target: 'market', count: 1 }, { type: 'restore', target: 'fountain', count: 1 }], rewards: { coins: 3000, gems: 30, xp: 400 } },
  { id: 's19', kind: 'story', giver: 'moss', title: 'Le renouveau', desc: 'Restaurez les maisons et le parc. Willowbrook revivra pour de bon !', objectives: [{ type: 'restore', target: 'houses', count: 1 }, { type: 'restore', target: 'park', count: 1 }], rewards: { coins: 5000, gems: 100, xp: 800 }, effect: 'finale' },
];

/** What NPCs say while a given story quest is active (questId -> npc -> line). */
export const STORY_TALK: Record<string, Record<string, string>> = {
  s0: { moss: 'Te voilà enfin ! Ta grand-mère Rose m\'avait dit que tu viendrais un jour. Regarde-moi cette pauvre maison… le toit fuit de partout. Commençons par la retaper : il te faut 20 bois et 10 pierres. Les arbres et les cailloux autour de la ferme feront l\'affaire !' },
  sh: { moss: 'Coupe du bois 🪓 et casse quelques pierres ⛏️ : approche-toi et touche le gros bouton, l\'outil se choisit tout seul. Ensuite, répare la maison devant la porte. Je t\'attends ici !' },
  s1: { moss: 'Quelle belle maison ! Rose serait fière. Maintenant, la terre : laboure avec la houe, plante tes graines et arrose-les. Le champ près de la maison est parfait.' },
  s2: { moss: 'Les plantes poussent pendant la nuit, si elles ont été arrosées. Arrose, va dormir, et demain… surprise !' },
  s3: { moss: 'Le village de Willowbrook est à l\'est, au bout du chemin. Il s\'est endormi lui aussi… Va voir Mallow, il saura par où commencer.', mallow: 'Un visiteur ! Bienvenue à Willowbrook… enfin, ce qu\'il en reste. Tout le monde est parti quand la vallée a perdu ses couleurs. Avec ton aide, on pourrait tout reconstruire !' },
  s4: { mallow: 'Pour reconstruire, il faut des sous ! Vends tes récoltes : la caisse d\'expédition de ta ferme paie chaque matin.' },
  s5: { moss: 'Pour restaurer le village, il faudra beaucoup de bois et de pierre. Les arbres repoussent, ne t\'inquiète pas !', mallow: 'Rapporte du bois et de la pierre, on va en avoir besoin !' },
  s6: { mallow: 'Ma boutique est juste là, toute de travers. Apporte les matériaux et touche 🔨 devant la porte : on la remet sur pied ensemble !' },
};

/** Templates for procedurally generated daily / weekly / board quests. */
export interface QuestGen {
  kind: QuestKind;
  title: string;
  type: string;
  targets: string[];
  count: [number, number];
  coins: number; // per unit
  minLevel?: number;
}

export const DAILY_GEN: QuestGen[] = [
  { kind: 'farm', title: 'Récolte du jour', type: 'harvest', targets: ['*'], count: [5, 15], coins: 12 },
  { kind: 'farm', title: 'Arrosage matinal', type: 'water', targets: ['*'], count: [8, 20], coins: 6 },
  { kind: 'animal', title: 'Câlins à la ferme', type: 'pet', targets: ['*'], count: [2, 5], coins: 20 },
  { kind: 'fish', title: 'Partie de pêche', type: 'catch', targets: ['*'], count: [2, 5], coins: 30 },
  { kind: 'explore', title: 'Cueillette', type: 'forage', targets: ['*'], count: [4, 10], coins: 15 },
  { kind: 'farm', title: 'Bûcheronnage', type: 'collect', targets: ['wood'], count: [15, 30], coins: 4 },
  { kind: 'explore', title: 'Carrière', type: 'collect', targets: ['stone'], count: [10, 25], coins: 5 },
  { kind: 'village', title: 'Petit commerce', type: 'sell', targets: ['*'], count: [10, 25], coins: 8 },
  { kind: 'village', title: 'Papotage', type: 'talk', targets: ['*'], count: [3, 5], coins: 20 },
  { kind: 'farm', title: 'Cuisinier du jour', type: 'cook', targets: ['*'], count: [1, 3], coins: 60, minLevel: 2 },
  { kind: 'explore', title: 'Chasse aux insectes', type: 'catch_bug', targets: ['*'], count: [2, 4], coins: 30 },
  { kind: 'animal', title: 'Produits frais', type: 'collect_product', targets: ['*'], count: [2, 6], coins: 25, minLevel: 2 },
];

export const WEEKLY_GEN: QuestGen[] = [
  { kind: 'weekly', title: 'Grand fermier', type: 'harvest', targets: ['*'], count: [60, 100], coins: 15 },
  { kind: 'weekly', title: 'Maître pêcheur', type: 'catch', targets: ['*'], count: [15, 25], coins: 40 },
  { kind: 'weekly', title: 'Ami des créatures', type: 'discover_any', targets: ['*'], count: [3, 6], coins: 120 },
  { kind: 'weekly', title: 'Chef étoilé', type: 'cook', targets: ['*'], count: [6, 12], coins: 80 },
  { kind: 'weekly', title: 'Mineur aguerri', type: 'collect', targets: ['copper_ore', 'iron_ore', 'crystal_shard'], count: [10, 25], coins: 30 },
  { kind: 'weekly', title: 'Bâtisseur', type: 'craft', targets: ['*'], count: [8, 15], coins: 50 },
];

/** Items villagers may request on the request board. */
export const REQUEST_ITEMS: Record<string, string[]> = {
  moss: ['lettuce', 'carrot', 'tulip', 'herb', 'apple', 'honey', 'sunflower', 'kale'],
  mallow: ['egg', 'wheat', 'corn', 'tomato', 'potato', 'wood', 'milk'],
  pippa: ['tulip', 'daisy', 'poppy', 'sunflower', 'rose', 'bluebell', 'frostbell'],
  niko: ['minnow', 'carp', 'perch', 'sardine', 'bait', 'seaweed'],
  bibi: ['seashell', 'acorn', 'pinecone', 'geode', 'copper_ore', 'amethyst'],
  toma: ['wood', 'stone', 'plank', 'copper_bar', 'iron_bar', 'coal'],
  brie: ['wheat', 'flour', 'egg', 'milk', 'strawberry', 'blueberry', 'butter', 'sugar'],
  hazel: ['hay', 'carrot', 'apple', 'animal_treat', 'wheat'],
};
