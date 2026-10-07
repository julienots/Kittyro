import type { ToolId } from '../state/types';

export interface ToolDef {
  id: ToolId;
  name: string;
  icon: string;
  desc: string;
  /** effect per tier (0..4) */
  tiers: string[];
}

export const TOOLS: ToolDef[] = [
  { id: 'hoe', name: 'Houe', icon: '⛏', desc: 'Prépare la terre pour planter.', tiers: ['1 case', '3 cases', '5 cases', '3×3', '3×3 + engrais doux'] },
  { id: 'can', name: 'Arrosoir', icon: '🚿', desc: 'Arrose les cultures. Remplissable à l\'eau.', tiers: ['1 case · 20 doses', '3 cases · 40', '5 cases · 60', '3×3 · 80', '3×3 · infini'] },
  { id: 'axe', name: 'Hache', icon: '🪓', desc: 'Coupe les arbres et les souches.', tiers: ['4 coups', '3 coups', '2 coups · grosses souches', '1 coup', '1 coup · bois bonus'] },
  { id: 'pickaxe', name: 'Pioche', icon: '⚒️', desc: 'Casse pierres, minerais et cristaux.', tiers: ['Pierre & cuivre', '+ Fer', '+ Or & cristaux', '+ Braisite', 'Tout · 1 coup'] },
  { id: 'rod', name: 'Canne à pêche', icon: '🎣', desc: 'Pêche dans les rivières, lacs et la mer.', tiers: ['Zone normale', 'Zone +15%', 'Zone +30%', 'Zone +45% · rares+', 'Zone +60% · légendaires'] },
  { id: 'sickle', name: 'Faucille', icon: '🌙', desc: 'Récolte en zone et coupe l\'herbe en foin.', tiers: ['1 case', '3 cases', '5 cases', '3×3', '3×3 · récolte double'] },
];

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;

/** Cost to upgrade TO tier n (1..4) */
export const TOOL_UPGRADE_COST: { coins: number; items: [string, number][] }[] = [
  { coins: 0, items: [] },
  { coins: 500, items: [['copper_bar', 5]] },
  { coins: 1500, items: [['iron_bar', 5]] },
  { coins: 4000, items: [['steel_bar', 5]] },
  { coins: 9000, items: [['crystal_shard', 5], ['ember_core', 1]] },
];

export function toolArea(tier: number): [number, number][] {
  // offsets in "forward/right" space; forward = +f
  switch (tier) {
    case 0: return [[0, 0]];
    case 1: return [[0, 0], [1, 0], [2, 0]];
    case 2: return [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
    default: {
      const out: [number, number][] = [];
      for (let f = 0; f < 3; f++) for (let r = -1; r <= 1; r++) out.push([f, r]);
      return out;
    }
  }
}
export const CAN_CAPACITY = [20, 40, 60, 80, 9999];
export const AXE_HITS = [4, 3, 2, 1, 1];
export const PICK_POWER = [1, 2, 3, 4, 6];
export const ROD_ZONE = [0.22, 0.25, 0.29, 0.32, 0.36];
