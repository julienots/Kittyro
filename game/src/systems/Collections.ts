import type { Ctx } from './Context';
import { FISH } from '../data/fish';
import { INSECTS } from '../data/insects';
import { CREATURES } from '../data/creatures';
import { ANIMALS } from '../data/animals';
import { CROPS } from '../data/crops';
import { MATERIALS } from '../data/resources';
import { DISHES } from '../data/recipes';
import { DECOR } from '../data/decor';

export interface CollectionInfo {
  id: string;
  name: string;
  icon: string;
  entries: { id: string; name: string; icon: string; rarity?: string; hint?: string }[];
}

const flowers = [
  ...CROPS.filter((c) => c.flower).map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
  ...MATERIALS.filter((m) => m.cat === 'flower').map((m) => ({ id: m.id, name: m.name, icon: m.icon })),
];

export const COLLECTIONS: CollectionInfo[] = [
  { id: 'fish', name: 'Poissons', icon: '🐟', entries: FISH.map((f) => ({ id: f.id, name: f.name, icon: f.icon, rarity: f.rarity })) },
  { id: 'insects', name: 'Insectes', icon: '🐞', entries: INSECTS.map((i) => ({ id: i.id, name: i.name, icon: i.icon, rarity: i.rarity })) },
  { id: 'creatures', name: 'Bestiaire', icon: '📖', entries: CREATURES.map((c) => ({ id: c.id, name: c.name, icon: '🐾', rarity: c.rarity })) },
  { id: 'animals', name: 'Animaux', icon: '🐾', entries: ANIMALS.map((a) => ({ id: a.id, name: a.name, icon: a.icon })) },
  { id: 'plants', name: 'Plantes', icon: '🌱', entries: CROPS.filter((c) => !c.flower).map((c) => ({ id: c.id, name: c.name, icon: c.icon })) },
  { id: 'flowers', name: 'Fleurs', icon: '🌸', entries: flowers },
  { id: 'minerals', name: 'Minerais', icon: '💎', entries: MATERIALS.filter((m) => m.cat === 'mineral').map((m) => ({ id: m.id, name: m.name, icon: m.icon })) },
  { id: 'recipes', name: 'Recettes', icon: '🍳', entries: DISHES.map((d) => ({ id: d.id, name: d.name, icon: d.icon })) },
  { id: 'furniture', name: 'Meubles', icon: '🪑', entries: DECOR.map((d) => ({ id: d.id, name: d.name, icon: d.icon })) },
];
export const COLLECTION_BY_ID: Record<string, CollectionInfo> = Object.fromEntries(COLLECTIONS.map((c) => [c.id, c]));
const MILESTONES = [0.25, 0.5, 0.75, 1];

export class CollectionSystem {
  constructor(private ctx: Ctx) {}

  /** Record an entry. Returns true if it is a new discovery. */
  record(cat: string, id: string, best?: number): boolean {
    const col = (this.ctx.state.collections[cat] ??= {});
    const info = COLLECTION_BY_ID[cat];
    if (info && !info.entries.some((e) => e.id === id)) return false;
    const e = col[id];
    if (!e) {
      col[id] = { count: 1, best, firstDay: this.ctx.state.time.day };
      this.ctx.bus.emit('collection:new', { cat, id });
      this.checkMilestones(cat);
      return true;
    }
    e.count++;
    if (best !== undefined && (e.best === undefined || best > e.best)) {
      e.best = best;
      this.ctx.bus.emit('collection:record', { cat, id, best });
    }
    return false;
  }

  has(cat: string, id: string): boolean {
    return !!this.ctx.state.collections[cat]?.[id];
  }

  progress(cat: string): { found: number; total: number } {
    const info = COLLECTION_BY_ID[cat];
    const col = this.ctx.state.collections[cat] ?? {};
    const total = info?.entries.length ?? 0;
    const found = info ? info.entries.filter((e) => col[e.id]).length : 0;
    return { found, total };
  }

  private checkMilestones(cat: string): void {
    const { found, total } = this.progress(cat);
    for (const m of MILESTONES) {
      const key = `${cat}:${m}`;
      if (found / total >= m && !this.ctx.state.milestones.includes(key)) {
        this.ctx.state.milestones.push(key);
        const gems = Math.round(10 + m * 40);
        this.ctx.economy.addGems(gems);
        this.ctx.economy.addCoins(Math.round(500 * m * 4), true);
        this.ctx.bus.emit('milestone', { cat, pct: m, gems });
      }
    }
  }
}
