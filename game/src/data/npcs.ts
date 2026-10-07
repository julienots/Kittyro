import type { Appearance } from '../state/types';

export interface NpcSchedule {
  from: number; // minute of day
  region: string;
  anchor: string; // named anchor in region layout
}

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  desc: string;
  look: Appearance;
  scale: number;
  loves: string[];
  likes: string[];
  dislikes: string[];
  schedule: NpcSchedule[];
  /** dialogue by friendship tier: 0 (stranger) .. 3 (best friends) */
  lines: string[][];
  /** contextual lines */
  rain: string;
  night: string;
  winter: string;
  shop?: string; // shop id opened when talking
  village?: string; // village building they run
}

const look = (o: Partial<Appearance>): Appearance => ({
  skin: 1, hairStyle: 0, hairColor: 2, eyeStyle: 0, eyeColor: 0,
  top: 'tee', topColor: 0xffffff, bottom: 'pants', bottomColor: 0x4a5a8a,
  shoes: 'boots', shoesColor: 0x6a4a3a, hat: 'none', hatColor: 0xffffff, accessory: 'none', cheeks: true, ...o,
});

export const NPCS: NpcDef[] = [
  {
    id: 'moss', name: 'Moss', role: 'Vieux jardinier', desc: 'Il a planté la moitié des arbres de la vallée. Parle aux plantes (et elles répondent, dit-il).',
    look: look({ skin: 2, hairStyle: 6, hairColor: 7, top: 'overalls', topColor: 0x6a9a5a, bottom: 'pants', bottomColor: 0x6a5a4a, hat: 'straw', hatColor: 0xe8c86a, accessory: 'glasses' }),
    scale: 0.95, loves: ['moonbloom', 'honey_tea', 'blossom_tree', 'truffle'], likes: ['tulip', 'sunflower', 'herb', 'mint', 'apple', 'veggie_soup'], dislikes: ['old_boot', 'coal'],
    schedule: [{ from: 360, region: 'farm', anchor: 'moss_bench' }, { from: 720, region: 'village', anchor: 'park' }, { from: 1080, region: 'village', anchor: 'moss_home' }],
    lines: [
      ['Ah, te voilà ! Cette vieille ferme attendait quelqu\'un comme toi.', 'La terre ici est bonne. Elle a juste besoin d\'un peu d\'attention.', 'Arrose tes plantes le matin, elles te le rendront.'],
      ['Tes cultures ont fière allure aujourd\'hui.', 'J\'ai vu un Moussinet près de la rivière. Bon signe !', 'Le vent sent la pluie... ou les cookies de Brie.'],
      ['Tu sais, avant, toute la vallée était couverte de fleurs.', 'Grâce à toi, les oiseaux reviennent.', 'Les jeunes pousses, c\'est comme les amis : on les arrose un peu chaque jour.'],
      ['Je suis fier de ce que tu as fait de la vallée.', 'Tu veux connaître un secret ? Le Roi Moussu se montre les nuits de brouillard dans la forêt.', 'Prends soin de toi comme tu prends soin de tes plantes.'],
    ],
    rain: 'La pluie, c\'est un jour de congé pour l\'arrosoir !', night: 'Il est tard, petite pousse. Va te reposer.', winter: 'L\'hiver, la terre dort. Mais le chou, lui, ne dort jamais !',
  },
  {
    id: 'mallow', name: 'Mallow', role: 'Commerçant', desc: 'Petit, rapide, toujours en train de réorganiser ses étagères. Adore négocier.',
    look: look({ skin: 0, hairStyle: 3, hairColor: 4, top: 'vest', topColor: 0xe8a33a, bottom: 'shorts', bottomColor: 0x5a6a9a, hat: 'cap', hatColor: 0xe85a4a, accessory: 'none' }),
    scale: 0.85, loves: ['pizza', 'gold_bar', 'cupcake', 'pearl'], likes: ['cookies', 'egg', 'corn', 'coconut', 'apple'], dislikes: ['fiber', 'old_boot'],
    schedule: [{ from: 360, region: 'village', anchor: 'shop' }, { from: 1200, region: 'village', anchor: 'plaza' }, { from: 1320, region: 'village', anchor: 'mallow_home' }],
    lines: [
      ['Bienvenue, bienvenue ! Graines fraîches, prix doux !', 'Tu es nouveau ? J\'ai TOUT ce qu\'il te faut. Enfin, presque.', 'Les affaires reprennent, je le sens !'],
      ['Mon meilleur client ! Enfin, mon seul client... pour l\'instant !', 'J\'ai reçu des graines de saison, jette un œil !', 'Le marché du samedi, c\'est sacré.'],
      ['Tu sais quoi ? Pour toi, je fais un prix.', 'Grâce à toi, le village revit. Les clients reviennent !', 'J\'ai gardé les meilleures graines de côté pour toi.'],
      ['Associé d\'honneur de la boutique Mallow & Co !', 'Sans toi, je serais encore en train de vendre des cailloux.', 'Tiens, prends ça. C\'est pour la maison !'],
    ],
    rain: 'La pluie fait pousser les ventes de parapluies... si j\'en avais.', night: 'La boutique est fermée, mais pour toi j\'ai toujours un sourire.', winter: 'Graines d\'hiver en promo ! Chou, ail, clochettes !',
    shop: 'general', village: 'shop',
  },
  {
    id: 'pippa', name: 'Pippa', role: 'Fleuriste', desc: 'Très expressive, s\'exclame devant chaque pétale. Rêve de couvrir le village de fleurs.',
    look: look({ skin: 1, hairStyle: 2, hairColor: 6, top: 'dress', topColor: 0xff9ac8, bottom: 'skirt', bottomColor: 0xff9ac8, hat: 'flower', hatColor: 0xffd03a, shoes: 'flats', shoesColor: 0xffffff, accessory: 'none' }),
    scale: 0.9, loves: ['rose', 'moonbloom', 'lotus', 'edelweiss', 'frostbell'], likes: ['tulip', 'sunflower', 'daisy', 'poppy', 'bluebell', 'honey'], dislikes: ['coal', 'stone', 'fish_stew'],
    schedule: [{ from: 360, region: 'village', anchor: 'florist' }, { from: 960, region: 'village', anchor: 'park' }, { from: 1260, region: 'village', anchor: 'pippa_home' }],
    lines: [
      ['Oh ! Oh ! Tu sens ça ? C\'est le parfum du printemps !', 'Bonjour ! Tu aimes les fleurs ? Moi je les ADORE.', 'Chaque fleur a sa petite personnalité, tu savais ?'],
      ['Tes tulipes sont magnifiques, je suis jalouse !', 'Si tu trouves des edelweiss en montagne, pense à moi !', 'Une fleur par jour, et le monde sourit.'],
      ['Tu es devenu un vrai jardinier-poète !', 'J\'ai composé un bouquet en ton honneur. Il s\'appelle « Bottes boueuses ».', 'Le village est tellement plus coloré grâce à toi !'],
      ['Ma meilleure amie des fleurs !', 'On devrait planter des roses tout le long du chemin !', 'Merci d\'avoir rendu la vallée si jolie.'],
    ],
    rain: 'La pluie fait briller les pétales, c\'est trop beau !', night: 'Les fleurs dorment... chut !', winter: 'Les clochettes de givre sont les fleurs les plus courageuses.',
    shop: 'florist', village: 'florist',
  },
  {
    id: 'niko', name: 'Niko', role: 'Pêcheur', desc: 'Calme, patient, parle peu mais connaît chaque poisson par son prénom.',
    look: look({ skin: 3, hairStyle: 1, hairColor: 0, top: 'raincoat', topColor: 0xffd03a, bottom: 'pants', bottomColor: 0x3a5a7a, hat: 'beanie', hatColor: 0x3a6a9a, accessory: 'none' }),
    scale: 1.0, loves: ['storm_marlin', 'fish_stew', 'sushi', 'aurora_fish'], likes: ['bait', 'tuna', 'trout', 'coffee', 'grilled_fish', 'seaweed'], dislikes: ['tulip', 'sugar'],
    schedule: [{ from: 360, region: 'village', anchor: 'pier' }, { from: 840, region: 'village', anchor: 'fishing_shop' }, { from: 1200, region: 'village', anchor: 'pier' }],
    lines: [
      ['... Salut.', 'Le poisson, ça ne se force pas. Ça s\'attend.', 'Tu pêches ? Hm. Bien.'],
      ['La perche dorée aime le soleil. La carpe, elle, aime tout.', 'Tire quand le poisson se fatigue, pas avant.', 'Il paraît qu\'un marlin rôde quand l\'orage gronde.'],
      ['Tu as la patience. C\'est rare.', 'Viens au concours de pêche, cette année. On verra qui est le meilleur.', 'La mer raconte des histoires, si on écoute.'],
      ['Mon ami de pêche.', 'Je t\'ai gardé ma meilleure ligne. Prends-en soin.', 'Le poisson aurore... je ne l\'ai vu qu\'une fois. Sous la neige.'],
    ],
    rain: 'La pluie... meilleur temps pour les poissons-chats.', night: 'La nuit, les gros poissons remontent.', winter: 'Même l\'hiver, la mer ne dort pas.',
    shop: 'fishing', village: 'fishing_shop',
  },
  {
    id: 'bibi', name: 'Bibi', role: 'Petite exploratrice', desc: 'Huit ans et demi (elle insiste sur le « et demi »). Carte en main, sac trop grand, curiosité infinie.',
    look: look({ skin: 1, hairStyle: 5, hairColor: 3, top: 'explorer', topColor: 0xc8a06a, bottom: 'shorts', bottomColor: 0x6a5a3a, hat: 'explorer', hatColor: 0xd8b07a, accessory: 'backpack' }),
    scale: 0.72, loves: ['fossil', 'treasure_map', 'geode', 'cookies', 'starfish_ray'], likes: ['seashell', 'acorn', 'pinecone', 'amethyst', 'cupcake'], dislikes: ['kale', 'garlic'],
    schedule: [{ from: 420, region: 'village', anchor: 'map_board' }, { from: 660, region: 'woods', anchor: 'camp' }, { from: 1080, region: 'village', anchor: 'bibi_home' }],
    lines: [
      ['Halte ! Qui va là ? ... Oh, un nouveau voisin !', 'Je suis Bibi, exploratrice officielle de la vallée. Enfin, presque officielle.', 'Tu as vu une grotte ? Une cascade ? Un trésor ?!'],
      ['J\'ai dessiné la forêt sur ma carte ! Bon, les arbres ressemblent à des brocolis.', 'Il paraît qu\'il y a des cristaux qui chantent dans la montagne !', 'Un jour, j\'irai jusqu\'à Ember Valley.'],
      ['Tu es mon co-explorateur préféré !', 'On forme une super équipe d\'expédition.', 'Regarde ma collection de cailloux ! Celui-ci a une tête de chat.'],
      ['Meilleurs aventuriers du monde ! Toi et moi !', 'J\'ai trouvé un raccourci secret, je te le montre ?', 'Quand je serai grande, je serai comme toi.'],
    ],
    rain: 'Les flaques, c\'est des mini-lacs à explorer !', night: 'Maman dit qu\'il faut rentrer... mais les lucioles !', winter: 'Bataille de boules de neige ? Tu vas perdre !',
  },
  {
    id: 'toma', name: 'Toma', role: 'Artisan', desc: 'Mains calleuses, cœur tendre. Répare tout ce qui grince, fabrique tout ce qui manque.',
    look: look({ skin: 2, hairStyle: 4, hairColor: 1, top: 'apron', topColor: 0x8a6a4a, bottom: 'pants', bottomColor: 0x4a4a5a, hat: 'bandana', hatColor: 0x5a8ad8, accessory: 'none' }),
    scale: 1.1, loves: ['steel_bar', 'hardwood', 'gold_bar', 'pumpkin_pie'], likes: ['plank', 'iron_bar', 'copper_bar', 'bread', 'coal'], dislikes: ['tulip', 'lettuce'],
    schedule: [{ from: 360, region: 'village', anchor: 'workshop' }, { from: 1140, region: 'village', anchor: 'plaza' }, { from: 1260, region: 'village', anchor: 'toma_home' }],
    lines: [
      ['Mm. Tu as besoin de quelque chose ? Je répare, je fabrique.', 'L\'atelier est en piteux état. Comme moi le matin.', 'Apporte-moi du bois, je ferai des merveilles.'],
      ['Ta houe tient le coup ? Je peux l\'améliorer.', 'Le cuivre, c\'est bien. Le fer, c\'est mieux. Le cristal... c\'est un rêve.', 'Bon travail sur ta ferme. Solide.'],
      ['J\'ai sculpté un petit lapin en bois. Pour toi.', 'Grâce à toi, l\'atelier ronronne à nouveau.', 'Chaque outil a une âme. Même la pelle.'],
      ['Toi et moi, on a reconstruit ce village planche par planche.', 'Je t\'ai fabriqué un manche sur mesure. Personne d\'autre n\'en a.', 'Merci, l\'ami.'],
    ],
    rain: 'La pluie, ça rouille. Pense à huiler tes outils.', night: 'Même les marteaux dorment, la nuit.', winter: 'L\'hiver, je fabrique des luges. Tu en veux une ?',
    shop: 'workshop', village: 'workshop',
  },
  {
    id: 'brie', name: 'Brie', role: 'Boulangère', desc: 'Toujours couverte de farine, rit très fort, offre des croissants à tout le monde.',
    look: look({ skin: 0, hairStyle: 7, hairColor: 5, top: 'apron', topColor: 0xffffff, bottom: 'skirt', bottomColor: 0xe8a07a, hat: 'chef', hatColor: 0xffffff, shoes: 'flats', shoesColor: 0x8a5a3a, accessory: 'none' }),
    scale: 0.95, loves: ['honey', 'strawberry', 'butter', 'berry_pie'], likes: ['wheat', 'flour', 'egg', 'milk', 'sugar', 'blueberry'], dislikes: ['old_boot', 'truffle'],
    schedule: [{ from: 360, region: 'village', anchor: 'bakery' }, { from: 1080, region: 'village', anchor: 'plaza' }, { from: 1260, region: 'village', anchor: 'brie_home' }],
    lines: [
      ['Coucou ! Tu veux goûter ? C\'est tout chaud !', 'Mon four est un peu capricieux depuis que la boulangerie est en ruine.', 'De la farine, des œufs, et beaucoup d\'amour !'],
      ['Ah, mon fournisseur de blé préféré !', 'J\'essaie une nouvelle recette de cupcake. Résultat : catastrophe délicieuse.', 'Le secret d\'un bon pain ? La patience. Et le beurre.'],
      ['Tu sens ça ? C\'est la tarte que j\'ai faite pour toi !', 'Le village sent bon le pain grâce à toi.', 'Je t\'apprends une recette secrète ?'],
      ['Ma petite brioche préférée !', 'Si tu as faim, la porte est toujours ouverte.', 'Le jour où tu es arrivé, j\'ai fait un gâteau. Je ne te l\'ai jamais dit !'],
    ],
    rain: 'Rien de mieux qu\'un chocolat chaud quand il pleut.', night: 'Le levain repose... moi aussi bientôt.', winter: 'Les biscuits de neige sont de retour !',
    shop: 'bakery', village: 'bakery',
  },
  {
    id: 'hazel', name: 'Hazel', role: 'Gardienne de l\'écurie', desc: 'Grande, calme, murmure à l\'oreille des chevaux. Adore les longues balades.',
    look: look({ skin: 4, hairStyle: 2, hairColor: 0, top: 'vest', topColor: 0x7a5a9a, bottom: 'pants', bottomColor: 0x5a4a3a, hat: 'cowboy', hatColor: 0x8a5a3a, accessory: 'scarf' }),
    scale: 1.08, loves: ['carrot_cake', 'apple', 'hay', 'chanterelle'], likes: ['carrot', 'wheat', 'animal_treat', 'peach'], dislikes: ['coal', 'sugar'],
    schedule: [{ from: 360, region: 'village', anchor: 'stable' }, { from: 900, region: 'farm', anchor: 'meadow' }, { from: 1140, region: 'village', anchor: 'stable' }],
    lines: [
      ['Salut. Doucement, tu vas effrayer les chevaux... Je plaisante, ils sont partis.', 'L\'écurie est vide depuis des années.', 'Les animaux sentent quand on les aime.'],
      ['Tes animaux ont l\'air heureux. Ça se voit à leurs yeux.', 'Une vache qu\'on caresse donne du meilleur lait. C\'est prouvé. Par moi.', 'Tu devrais adopter un cheval, la vallée est grande.'],
      ['Tu as le don avec les bêtes.', 'Si tu trouves un renard dans la forêt, sois patient. Une friandise, puis une autre.', 'On part en balade au coucher du soleil ?'],
      ['Mon amie des animaux.', 'Les chevaux te reconnaissent, maintenant. Moi aussi, d\'ailleurs.', 'Merci d\'avoir ramené la vie à l\'écurie.'],
    ],
    rain: 'Les chevaux n\'aiment pas l\'orage. Moi non plus.', night: 'Bonne nuit... les étoiles sont belles d\'ici.', winter: 'J\'ai tricoté des couvertures pour tout le monde.',
    shop: 'animals', village: 'stable',
  },
];

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));
export const FRIEND_REWARDS: Record<string, { level: number; reward: string; items?: [string, number][]; gems?: number }[]> = {
  moss: [{ level: 2, reward: 'Recette : Thé au miel', }, { level: 4, reward: '5 Engrais luxe', items: [['deluxe_fertilizer', 5]] }, { level: 6, reward: 'Graines de lune', items: [['seed_moonbloom', 3]] }, { level: 10, reward: '50 Moon Gems', gems: 50 }],
  mallow: [{ level: 3, reward: 'Remise de 10% en boutique' }, { level: 6, reward: 'Remise de 20% en boutique' }, { level: 10, reward: '50 Moon Gems', gems: 50 }],
  pippa: [{ level: 2, reward: 'Graines de rose', items: [['seed_rose', 5]] }, { level: 5, reward: 'Arche de roses' }, { level: 10, reward: '50 Moon Gems', gems: 50 }],
  niko: [{ level: 3, reward: 'Recette : Bouillabaisse' }, { level: 4, reward: '20 Appâts', items: [['bait', 20]] }, { level: 6, reward: '5 Appâts magiques', items: [['magic_bait', 5]] }, { level: 10, reward: '50 Moon Gems', gems: 50 }],
  bibi: [{ level: 2, reward: 'Carte au trésor', items: [['treasure_map', 1]] }, { level: 3, reward: 'Recette : Risotto forestier' }, { level: 10, reward: '50 Moon Gems', gems: 50 }],
  toma: [{ level: 1, reward: 'Recette : Lit douillet' }, { level: 2, reward: 'Recette : Bibliothèque' }, { level: 3, reward: 'Recette : Fauteuil' }, { level: 10, reward: '50 Moon Gems', gems: 50 }],
  brie: [{ level: 2, reward: 'Recette : Gâteau aux carottes' }, { level: 4, reward: 'Recette : Tarte à la citrouille' }, { level: 10, reward: '50 Moon Gems', gems: 50 }],
  hazel: [{ level: 2, reward: '10 Friandises', items: [['animal_treat', 10]] }, { level: 5, reward: 'Réduction 25% sur les animaux' }, { level: 10, reward: '50 Moon Gems', gems: 50 }],
};
