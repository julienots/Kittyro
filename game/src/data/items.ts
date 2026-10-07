import { CROPS, seedId } from './crops';
import { FISH } from './fish';
import { INSECTS } from './insects';
import { MATERIALS, FRUIT_TREES } from './resources';
import { DISHES, DISH_BY_ID } from './recipes';

export type ItemCat =
  | 'seed' | 'crop' | 'fish' | 'insect' | 'material' | 'mineral' | 'forage' | 'flower' | 'fruit'
  | 'animal' | 'artisan' | 'dish' | 'misc' | 'sapling';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  cat: ItemCat;
  sell: number;
  desc?: string;
  buy?: number;
}

export const CAT_NAMES: Record<ItemCat, string> = {
  seed: 'Graines', crop: 'Récoltes', fish: 'Poissons', insect: 'Insectes', material: 'Matériaux', mineral: 'Minerais',
  forage: 'Cueillette', flower: 'Fleurs', fruit: 'Fruits', animal: 'Produits animaux', artisan: 'Artisanat', dish: 'Plats', misc: 'Divers', sapling: 'Jeunes arbres',
};

const items: ItemDef[] = [];
for (const c of CROPS) {
  items.push({ id: c.id, name: c.name, icon: c.icon, cat: c.flower ? 'flower' : 'crop', sell: c.sell, desc: `Saison : ${c.seasons.length === 4 ? 'toutes' : c.seasons.map((s) => ({ spring: 'printemps', summer: 'été', autumn: 'automne', winter: 'hiver' })[s]).join(', ')}` });
  items.push({ id: seedId(c.id), name: c.seedName, icon: '🌱', cat: 'seed', sell: Math.floor(c.seedPrice / 2), buy: c.seedPrice, desc: `Pousse en ${Math.round(c.grow / 60)} h de jeu arrosées.${c.regrow ? ' Repousse après récolte.' : ''}` });
}
for (const f of FISH) items.push({ id: f.id, name: f.name, icon: f.icon, cat: 'fish', sell: f.sell });
for (const i of INSECTS) items.push({ id: i.id, name: i.name, icon: i.icon, cat: 'insect', sell: i.sell });
for (const m of MATERIALS) items.push({ id: m.id, name: m.name, icon: m.icon, cat: m.cat === 'forage' ? 'forage' : (m.cat as ItemCat), sell: m.sell, desc: m.desc });
for (const d of DISHES) items.push({ id: d.id, name: d.name, icon: d.icon, cat: 'dish', sell: d.sell, desc: d.desc });
for (const t of FRUIT_TREES) items.push({ id: `sapling_${t.id}`, name: `Jeune ${t.name.toLowerCase()}`, icon: '🌳', cat: 'sapling', sell: Math.floor(t.price / 4), buy: t.price, desc: 'Plantez-le sur la ferme. Donne des fruits en saison.' });

export const ITEMS: Record<string, ItemDef> = {};
for (const it of items) if (!ITEMS[it.id]) ITEMS[it.id] = it;

export function item(id: string): ItemDef {
  return ITEMS[id] ?? { id, name: id, icon: '❔', cat: 'misc', sell: 0 };
}
export function isEdible(id: string): boolean {
  return !!DISH_BY_ID[id] || ['apple', 'cherry', 'peach', 'orange', 'coconut', 'wild_berry', 'snowberry', 'strawberry', 'blueberry', 'button_mushroom', 'chanterelle'].includes(id);
}
