import type { Season } from '../state/types';

export type NodeTool = 'axe' | 'pickaxe' | 'sickle' | 'hand';

export interface Drop {
  id: string;
  min: number;
  max: number;
  chance?: number;
}

export interface NodeKind {
  id: string;
  name: string;
  tool: NodeTool;
  hp: number;
  minTier: number;
  respawn: number; // game minutes
  drops: Drop[];
  xp: number;
  activity: 'chop' | 'mine' | 'forage' | 'cut';
  blocks: boolean;
  radius: number;
}

const K = (id: string, name: string, tool: NodeTool, hp: number, minTier: number, respawn: number, drops: Drop[], xp: number, activity: NodeKind['activity'], blocks = true, radius = 0.45): NodeKind =>
  ({ id, name, tool, hp, minTier, respawn, drops, xp, activity, blocks, radius });

const DAY = 1440;
export const NODE_KINDS: Record<string, NodeKind> = Object.fromEntries([
  K('tree_oak', 'Chêne', 'axe', 4, 0, DAY * 2, [{ id: 'wood', min: 4, max: 7 }, { id: 'sap', min: 1, max: 2, chance: 0.5 }, { id: 'acorn', min: 1, max: 1, chance: 0.3 }], 6, 'chop', true, 0.5),
  K('tree_pine', 'Pin', 'axe', 4, 0, DAY * 2, [{ id: 'wood', min: 4, max: 6 }, { id: 'sap', min: 1, max: 3, chance: 0.6 }, { id: 'pinecone', min: 1, max: 1, chance: 0.35 }], 6, 'chop', true, 0.5),
  K('tree_birch', 'Bouleau', 'axe', 3, 0, DAY * 2, [{ id: 'wood', min: 3, max: 5 }, { id: 'sap', min: 1, max: 1, chance: 0.4 }], 5, 'chop', true, 0.45),
  K('tree_palm', 'Palmier', 'axe', 3, 0, DAY * 2, [{ id: 'wood', min: 3, max: 5 }, { id: 'coconut', min: 1, max: 2, chance: 0.6 }], 6, 'chop', true, 0.45),
  K('tree_snow', 'Sapin enneigé', 'axe', 5, 1, DAY * 3, [{ id: 'wood', min: 5, max: 8 }, { id: 'hardwood', min: 1, max: 2, chance: 0.4 }, { id: 'pinecone', min: 1, max: 2, chance: 0.4 }], 8, 'chop', true, 0.5),
  K('tree_ash', 'Arbre de cendre', 'axe', 5, 2, DAY * 3, [{ id: 'hardwood', min: 2, max: 4 }, { id: 'coal', min: 1, max: 2, chance: 0.5 }], 10, 'chop', true, 0.5),
  K('tree_giant', 'Arbre ancien', 'axe', 6, 1, DAY * 4, [{ id: 'wood', min: 8, max: 12 }, { id: 'hardwood', min: 2, max: 3 }, { id: 'sap', min: 2, max: 4 }], 14, 'chop', true, 0.8),
  K('stump', 'Grosse souche', 'axe', 4, 2, DAY * 3, [{ id: 'hardwood', min: 2, max: 3 }], 10, 'chop', true, 0.5),
  K('bush_berry', 'Buisson de baies', 'hand', 1, 0, DAY, [{ id: 'wild_berry', min: 2, max: 4 }], 2, 'forage', true, 0.4),
  K('bush_snow', 'Buisson des neiges', 'hand', 1, 0, DAY, [{ id: 'snowberry', min: 1, max: 3 }], 3, 'forage', true, 0.4),
  K('rock', 'Pierre', 'pickaxe', 2, 0, DAY * 2, [{ id: 'stone', min: 2, max: 4 }, { id: 'coal', min: 1, max: 1, chance: 0.12 }, { id: 'clay', min: 1, max: 1, chance: 0.15 }], 3, 'mine', true, 0.45),
  K('rock_big', 'Gros rocher', 'pickaxe', 4, 1, DAY * 3, [{ id: 'stone', min: 6, max: 10 }, { id: 'geode', min: 1, max: 1, chance: 0.2 }], 8, 'mine', true, 0.7),
  K('ore_copper', 'Filon de cuivre', 'pickaxe', 3, 0, DAY * 2, [{ id: 'copper_ore', min: 2, max: 3 }, { id: 'stone', min: 1, max: 1 }], 6, 'mine', true, 0.45),
  K('ore_coal', 'Veine de charbon', 'pickaxe', 3, 0, DAY * 2, [{ id: 'coal', min: 1, max: 3 }, { id: 'stone', min: 1, max: 1 }], 5, 'mine', true, 0.45),
  K('ore_iron', 'Filon de fer', 'pickaxe', 4, 1, DAY * 2, [{ id: 'iron_ore', min: 2, max: 3 }], 9, 'mine', true, 0.45),
  K('ore_gold', 'Filon d\'or', 'pickaxe', 5, 2, DAY * 3, [{ id: 'gold_ore', min: 1, max: 3 }], 14, 'mine', true, 0.45),
  K('ore_crystal', 'Amas de cristaux', 'pickaxe', 4, 2, DAY * 3, [{ id: 'crystal_shard', min: 1, max: 3 }, { id: 'amethyst', min: 1, max: 1, chance: 0.15 }, { id: 'aquamarine', min: 1, max: 1, chance: 0.08 }], 16, 'mine', true, 0.45),
  K('ore_frost', 'Cristal de givre', 'pickaxe', 4, 2, DAY * 3, [{ id: 'frost_crystal', min: 1, max: 2 }, { id: 'moonstone', min: 1, max: 1, chance: 0.04 }], 18, 'mine', true, 0.45),
  K('ore_ember', 'Filon de braisite', 'pickaxe', 5, 3, DAY * 3, [{ id: 'emberite', min: 1, max: 2 }, { id: 'ember_core', min: 1, max: 1, chance: 0.06 }, { id: 'coal', min: 1, max: 2 }], 22, 'mine', true, 0.45),
  K('geode_node', 'Géode', 'pickaxe', 3, 1, DAY * 3, [{ id: 'geode', min: 1, max: 2 }, { id: 'amethyst', min: 1, max: 1, chance: 0.3 }, { id: 'fossil', min: 1, max: 1, chance: 0.06 }], 12, 'mine', true, 0.45),
  K('boulder', 'Rocher du col', 'pickaxe', 8, 1, 1e12, [{ id: 'stone', min: 15, max: 20 }], 50, 'mine', true, 1.1),
  K('clay_spot', 'Terre argileuse', 'hand', 1, 0, DAY, [{ id: 'clay', min: 1, max: 2 }], 2, 'forage', false, 0.4),
  K('weeds', 'Herbes folles', 'sickle', 1, 0, DAY, [{ id: 'fiber', min: 1, max: 2 }, { id: 'hay', min: 1, max: 1, chance: 0.5 }], 1, 'cut', false, 0.35),
  K('forage', 'Cueillette', 'hand', 1, 0, DAY, [], 3, 'forage', false, 0.35),
  K('driftwood', 'Bois flotté', 'hand', 1, 0, DAY, [{ id: 'wood', min: 2, max: 4 }], 2, 'forage', false, 0.4),
  K('chest', 'Coffre', 'hand', 1, 0, 1e12, [], 20, 'forage', true, 0.45),
].map((k) => [k.id, k]));

/** Forage tables: region -> season -> possible items (weighted by repetition). */
export const FORAGE: Record<string, Partial<Record<Season | 'all', string[]>>> = {
  farm: { spring: ['daisy', 'daisy', 'herb', 'mint', 'button_mushroom'], summer: ['daisy', 'poppy', 'wild_berry', 'herb'], autumn: ['button_mushroom', 'acorn', 'wild_berry', 'chanterelle'], winter: ['pinecone', 'ice_lichen', 'acorn'] },
  village: { all: ['daisy', 'poppy', 'herb', 'wild_berry'] },
  woods: { spring: ['bluebell', 'button_mushroom', 'mint', 'herb'], summer: ['chanterelle', 'wild_berry', 'red_cap', 'herb'], autumn: ['chanterelle', 'chanterelle', 'red_cap', 'acorn', 'pinecone', 'glowcap'], winter: ['pinecone', 'red_cap', 'glowcap'] },
  mountains: { all: ['edelweiss', 'herb', 'mint', 'pinecone'] },
  coast: { all: ['seashell', 'seashell', 'seaweed', 'coral', 'hibiscus'], summer: ['seashell', 'coral', 'hibiscus', 'seaweed'] },
  frosty: { all: ['snowberry', 'ice_lichen', 'edelweiss', 'frost_crystal'] },
  ember: { all: ['fire_pepper', 'ash_bloom', 'coal'] },
  mine: { all: ['glowcap', 'coal'] },
};
