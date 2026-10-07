import { h, fmt } from './dom';
import type { UI } from './UI';
import { item, CAT_NAMES, isEdible, ITEMS } from '../data/items';
import { COLLECTIONS, COLLECTION_BY_ID } from '../systems/Collections';
import { FISH_BY_ID, RARITY_COLOR, RARITY_NAME } from '../data/fish';
import { CREATURE_BY_ID } from '../data/creatures';
import { INSECT_BY_ID } from '../data/insects';
import { REGIONS, REGION_BY_ID } from '../data/regions';
import { objectiveText } from '../systems/Quests';
import { SHOP_NAMES, type Offer } from '../systems/Shop';
import { RECIPES, STATION_NAMES, DISH_BY_ID, BUFF_NAMES, type RecipeCat, type Station } from '../data/recipes';
import { DECOR, DECOR_BY_ID, WALLPAPERS, FLOORS, WALL_PRICE, FLOOR_PRICE } from '../data/decor';
import { BUILDINGS, BUILDING_BY_ID } from '../data/buildings';
import { VILLAGE_BY_ID } from '../data/village';
import { TOOLS, TOOL_BY_ID } from '../data/tools';
import { TOOL_TIERS } from '../data/constants';
import { ANIMAL_BY_ID } from '../data/animals';
import { NPC_BY_ID, FRIEND_REWARDS } from '../data/npcs';
import { HOUSE_UPGRADES, ROOM_NAMES, PASS_TIERS, PASS_POINTS_PER_TIER, PASS_PREMIUM_GEMS, passReward, FARM_THEMES, TRAILS } from '../data/shop';
import { WEAR, wearKey, SKIN_TONES, HAIR_COLORS, EYE_COLORS, CLOTH_COLORS, HAIR_STYLES, EYE_STYLES } from '../data/wardrobe';
import { FESTIVALS } from '../data/festivals';
import { HOUSE_ROOMS } from '../world/houseLayout';
import type { Appearance, ToolId } from '../state/types';
import type { Quality, ControlMode } from '../save/Settings';
import { CROP_BY_ID } from '../data/crops';

type Tab = { id: string; label: string };
function tabs(list: Tab[], cur: string, on: (id: string) => void): HTMLElement {
  return h('div.tabs', null, ...list.map((t) => h(`button.tab${t.id === cur ? '.on' : ''}`, { onclick: () => on(t.id) }, t.label)));
}

function costList(ui: UI, items: [string, number][], coins = 0): HTMLElement {
  const inv = ui.g.ctx.inventory;
  return h('div.cost-list', null,
    coins ? h(`span.cost.${ui.g.ctx.state.player.coins >= coins ? 'ok' : 'no'}`, null, `🪙 ${fmt(coins)}`) : null,
    ...items.map(([id, q]) => h(`span.cost.${inv.count(id) >= q ? 'ok' : 'no'}`, null, `${item(id).icon} ${inv.count(id)}/${q}`)),
  );
}

const currencyIcon = (c: string) => (c === 'coins' ? '🪙' : c === 'gems' ? '💎' : '🎟️');

export function openPanel(ui: UI, name: string, ...args: any[]): void {
  const fn = (PANELS as any)[name];
  if (fn) fn(ui, ...args);
  else console.warn('unknown panel', name);
}

// ====================================================================== inventory
function inventory(ui: UI, tab = 'bag'): void {
  const g = ui.g;
  const st = g.ctx.state;
  let sel = -1;
  const render = (): any[] => {
    if (tab === 'bag') {
      const grid = h('div.grid', null, ...st.inventory.map((s, i) => s
        ? h(`button.slot${i === sel ? '.sel' : ''}`, { onclick: () => { sel = i; ui.setPanelBody(...render()); } }, item(s.id).icon, s.id.startsWith('seed_') ? h('span.seedtag', null, '🌱') : null, h('span.q', null, s.qty))
        : h('div.slot.empty')));
      const s = sel >= 0 ? st.inventory[sel] : null;
      const def = s ? item(s.id) : null;
      const detail = s && def ? h('div.detail', null, h('span.em', null, def.icon), h('div.grow', null,
        h('b', null, `${def.name} ×${s.qty}`), h('div.muted', null, `${CAT_NAMES[def.cat]} · vaut ${g.ctx.economy.priceOf(s.id)} 🪙${DISH_BY_ID[s.id]?.buff ? ` · ${BUFF_NAMES[DISH_BY_ID[s.id].buff!.id]}` : ''}`),
        def.desc ? h('div.muted', null, def.desc) : null,
        h('div.row', { style: { marginTop: '8px', flexWrap: 'wrap' } },
          isEdible(s.id) ? h('button.btn.small.peach', { onclick: () => { g.eat(s.id); ui.closePanel(); } }, '😋 Manger') : null,
          s.id.startsWith('seed_') ? h('button.btn.small', { onclick: () => { g.selectSeed(s.id); ui.closePanel(); } }, '🌱 Équiper') : null,
          s.id.startsWith('sapling_') ? h('button.btn.small', { onclick: () => { ui.closePanel(); g.enterPlacement(s.id); } }, '🌳 Planter') : null,
          h('button.btn.small.ghost', { onclick: () => { g.ctx.inventory.storeSlot(sel); sel = -1; ui.setPanelBody(...render()); } }, '📦 Ranger'),
        ))) : h('div.muted', { style: { marginTop: '10px' } }, 'Touchez un objet pour voir les détails.');
      return [grid, detail, h('div.row', { style: { marginTop: '10px' } }, h('span.muted.grow', null, `${st.inventory.filter(Boolean).length}/${st.inventorySize} emplacements`), h('button.btn.small.ghost', { onclick: () => { g.ctx.inventory.sort(); sel = -1; ui.setPanelBody(...render()); } }, '↕ Trier'))];
    }
    if (tab === 'storage') {
      if (!st.storage.length) return [h('p.muted.center', null, 'La remise est vide. Les objets en trop y arrivent automatiquement.')];
      return [h('div.list', null, ...st.storage.map((s) => h('div.item-row', null, h('span.em', null, item(s.id).icon), h('div.info', null, h('b', null, item(s.id).name), h('span', null, `×${s.qty}`)),
        h('button.btn.small', { onclick: () => { g.ctx.inventory.takeFromStorage(s.id, s.qty); ui.setPanelBody(...render()); } }, 'Prendre'))))];
    }
    // decor bag
    const owned = Object.entries(st.decorOwned).filter(([, n]) => n > 0);
    if (!owned.length) return [h('p.muted.center', null, 'Aucune décoration. Achetez-en en boutique ou fabriquez-les à l\'atelier !')];
    return [h('div.list', null, ...owned.map(([id, n]) => {
      const d = DECOR_BY_ID[id];
      const can = (d.indoor ? g.regionId === 'house' : g.regionId === 'farm') || (!d.indoor && g.regionId === 'house' && ['flowers', 'lights', 'magic', 'colorful', 'winter', 'halloween'].includes(d.cat));
      return h('div.item-row', null, h('span.em', null, d.icon), h('div.info', null, h('b', null, d.name), h('span', null, `×${n} · ${d.indoor ? 'Intérieur' : 'Extérieur'}`)),
        h(`button.btn.small${can ? '' : '.disabled'}`, { onclick: () => { ui.closePanel(); g.enterPlacement(id); } }, 'Placer'));
    }))];
  };
  const t = tabs([{ id: 'bag', label: '🎒 Sac' }, { id: 'storage', label: '📦 Remise' }, { id: 'decor', label: '🪑 Décorations' }], tab, (id) => inventory(ui, id));
  ui.showPanel('inventory', 'Inventaire', render(), { tabs: t });
}

// ====================================================================== quests
function quests(ui: UI): void {
  const g = ui.g;
  const render = (): any[] => {
    const list = [...g.ctx.quests.active].sort((a, b) => (b.done ? 1 : 0) - (a.done ? 1 : 0) || (a.kind === 'story' ? -1 : 1));
    if (!list.length) return [h('p.muted.center', null, 'Aucune quête pour le moment. Profitez du calme !')];
    const kindName: Record<string, string> = { story: 'Histoire', daily: 'Quotidienne', weekly: 'Hebdo', village: 'Demande', farm: 'Quotidienne', fish: 'Quotidienne', animal: 'Quotidienne', explore: 'Quotidienne' };
    return [h('div.list', null, ...list.map((q) => h(`div.quest${q.kind === 'story' ? '.story' : ''}`, null,
      h('h3', null, q.title, h('span.kind-tag', null, kindName[q.kind] ?? q.kind)),
      h('div.muted', null, q.desc),
      ...q.objectives.map((o) => h(`div.obj${o.progress >= o.count ? '.done' : ''}`, null, h('span', null, `${o.progress >= o.count ? '✓' : '•'} ${objectiveText(o)}`), h('span', null, `${Math.min(o.progress, o.count)}/${o.count}`))),
      h('div.rewards', null, 'Récompense : ', [q.rewards.coins ? `🪙 ${q.rewards.coins}` : '', q.rewards.gems ? `💎 ${q.rewards.gems}` : '', q.rewards.xp ? `⭐ ${q.rewards.xp} XP` : '', ...(q.rewards.items ?? []).map((i) => `${item(i.id).icon}×${i.qty}`), q.rewards.friendship ? `🍃 ${NPC_BY_ID[q.rewards.friendship.npc]?.name}` : ''].filter(Boolean).join('  ')),
      h('div.row', { style: { marginTop: '8px' } },
        q.done && !q.claimed ? h('button.btn.small', { onclick: () => { g.ctx.quests.claim(q.id); g.audio.play('quest'); ui.setPanelBody(...render()); } }, '🎁 Réclamer') : null,
        g.ctx.quests.canDeliver(q) ? h('button.btn.small.peach', { onclick: () => { g.ctx.quests.deliver(q.id); g.audio.play('coin'); ui.setPanelBody(...render()); } }, '📦 Livrer') : null,
      ),
    )))];
  };
  ui.showPanel('quests', 'Quêtes', render());
}

// ====================================================================== collections & bestiary
function collections(ui: UI, cat = 'creatures'): void {
  const g = ui.g;
  const info = COLLECTION_BY_ID[cat];
  const col = g.ctx.state.collections[cat] ?? {};
  let sel: string | null = null;
  const render = (): any[] => {
    const prog = g.ctx.collections.progress(cat);
    const grid = h('div.grid', null, ...info.entries.map((e) => {
      const found = !!col[e.id];
      const icon = cat === 'creatures' ? (found ? creatureIcon(e.id) : '❔') : found ? e.icon : '❔';
      return h(`button.slot${found ? '' : '.locked'}${sel === e.id ? '.sel' : ''}`, { onclick: () => { sel = e.id; ui.setPanelBody(...render()); }, style: e.rarity && found ? { boxShadow: `0 3px 0 ${RARITY_COLOR[e.rarity as 'common']}` } : {} }, icon);
    }));
    let detail: HTMLElement = h('div.muted', { style: { marginTop: '10px' } }, 'Touchez une case pour en savoir plus.');
    if (sel) {
      const e = info.entries.find((x) => x.id === sel)!;
      const found = col[sel];
      const hint = collectionHint(cat, sel);
      detail = h('div.detail', null, h('span.em', null, found ? (cat === 'creatures' ? creatureIcon(sel) : e.icon) : '❔'), h('div.grow', null,
        h('b', null, found ? e.name : '???'),
        e.rarity ? h('span.rarity', { style: { background: RARITY_COLOR[e.rarity as 'common'], marginLeft: '8px' } }, RARITY_NAME[e.rarity as 'common']) : null,
        found && cat === 'creatures' ? h('div.muted', null, CREATURE_BY_ID[sel].desc) : null,
        found ? h('div.muted', null, `Observé ${found.count}× · depuis le jour ${found.firstDay}${found.best ? ` · record ${found.best} cm` : ''}`) : null,
        h('div.muted', null, hint),
      ));
    }
    return [h('div.row', null, h('div.progress.grow', null, h('i', { style: { width: `${(prog.found / prog.total) * 100}%` } })), h('b', null, `${prog.found}/${prog.total}`)), h('div', { style: { height: '10px' } }), grid, detail];
  };
  const t = tabs(COLLECTIONS.map((c) => ({ id: c.id, label: `${c.icon} ${c.name}` })), cat, (id) => collections(ui, id));
  ui.showPanel('collections', 'Collections', render(), { tabs: t, size: 'wide' });
}

const SHAPE_ICON: Record<string, string> = { blob: '🟢', bunny: '🐇', bird: '🐦', sprite: '✨', shroom: '🍄', fluff: '☁️', lizard: '🦎', jelly: '🪼', fox: '🦊' };
function creatureIcon(id: string): string {
  return SHAPE_ICON[CREATURE_BY_ID[id]?.shape] ?? '🐾';
}

function collectionHint(cat: string, id: string): string {
  const region = (ids: string[]) => ids.map((r) => REGION_BY_ID[r as 'farm']?.name ?? r).join(', ');
  const time = (t: string) => ({ any: 'à toute heure', day: 'le jour', night: 'la nuit', dawn: 'à l\'aube', dusk: 'au crépuscule' }[t] ?? t);
  if (cat === 'fish') { const f = FISH_BY_ID[id]; return `🎣 ${region(f.regions)} · ${time(f.time)}${f.weather ? ` · ${f.weather.join('/')}` : ''}${f.seasons !== 'all' ? ` · ${f.seasons.join(', ')}` : ''}`; }
  if (cat === 'insects') { const i = INSECT_BY_ID[id]; return `🐞 ${region(i.regions)} · ${time(i.time)}`; }
  if (cat === 'creatures') { const c = CREATURE_BY_ID[id]; return `🔍 ${region(c.regions)} · ${time(c.time)}${c.weather ? ` · par temps ${c.weather.join('/')}` : ''}. Approchez lentement !`; }
  if (cat === 'animals') return ANIMAL_BY_ID[id]?.wild ? `🌿 Animal sauvage : ${REGION_BY_ID[ANIMAL_BY_ID[id].region as 'farm']?.name}. Offrez-lui à manger 3 jours de suite.` : '🏪 Écurie de Hazel';
  if (cat === 'plants' || cat === 'flowers') return CROP_BY_ID[id] ? `🌱 Cultivable : ${CROP_BY_ID[id].seasons.join(', ')}` : '🌼 Cueillette sauvage';
  if (cat === 'recipes') return '🍳 Cuisinez-le une fois';
  if (cat === 'minerals') return '⛏️ Mines, montagnes et régions lointaines';
  return '';
}

// ====================================================================== map
function map(ui: UI, unlockedNow?: string): void {
  const g = ui.g;
  const st = g.ctx.state;
  const regions = REGIONS.filter((r) => r.id !== 'house');
  const links: [string, string][] = [['farm', 'village'], ['farm', 'woods'], ['farm', 'mountains'], ['mountains', 'mine'], ['mountains', 'frosty'], ['village', 'coast'], ['village', 'ember']];
  const svg = `<svg viewBox="0 0 100 62.5" preserveAspectRatio="none">${links.map(([a, b]) => {
    const A = REGION_BY_ID[a as 'farm'].map, B = REGION_BY_ID[b as 'farm'].map;
    const on = st.regions[a as 'farm'].unlocked && st.regions[b as 'farm'].unlocked;
    return `<path d="M${A[0] * 100} ${A[1] * 62.5} Q ${(A[0] + B[0]) * 50 + 4} ${(A[1] + B[1]) * 31.25 - 4} ${B[0] * 100} ${B[1] * 62.5}" stroke="${on ? '#fff8ec' : 'rgba(255,255,255,.35)'}" stroke-width="0.9" stroke-dasharray="2 1.5" fill="none"/>`;
  }).join('')}</svg>`;
  const colors: Record<string, string> = { farm: '#9fd472', village: '#b8e08a', woods: '#5fae5a', mountains: '#a8b0c0', coast: '#f4e0a8', frosty: '#eef4ff', ember: '#c87a5a', mine: '#8a7a78' };
  const mapEl = h('div.map', { html: svg }, ...regions.map((r) => {
    const unlocked = st.regions[r.id].unlocked;
    const here = g.regionId === r.id || (g.regionId === 'house' && r.id === 'farm');
    return h(`div.isle${unlocked ? '' : '.locked'}${here ? '.here' : ''}${unlockedNow === r.id ? '.unlocking' : ''}`, {
      style: { left: `${r.map[0] * 100}%`, top: `${r.map[1] * 100}%` },
      onclick: () => {
        if (!unlocked) { ui.toast(r.unlockHint, '🔒', 'warn'); return; }
        if (here) { ui.toast('Vous êtes ici !', '📍'); return; }
        if (r.id === 'mine') { ui.toast('Entrez par la mine des Crystal Mountains.', '⛏️'); return; }
        ui.confirm(`Voyager vers ${r.name} ?`, () => g.travel(r.id));
      },
    }, h('div.blob', { style: { background: colors[r.id] } }, r.icon), h('b', null, unlocked ? r.name : '???'));
  }));
  const legend = h('div.muted', { style: { marginTop: '8px' } }, `Régions découvertes : ${regions.filter((r) => st.regions[r.id].unlocked).length}/${regions.length} · Touchez une île pour voyager.`);
  ui.showPanel('map', 'Carte de la vallée', [mapEl, legend], { size: 'wide' });
}

// ====================================================================== shop
function shop(ui: UI, shopId: string): void {
  const g = ui.g;
  const render = (): any[] => {
    const offers = g.ctx.shop.offers(shopId);
    const wallet = h('div.row', { style: { marginBottom: '10px' } }, h('span.pill', null, `🪙 ${fmt(g.ctx.state.player.coins)}`), h('span.pill', null, `💎 ${g.ctx.state.player.gems}`), h('span.pill', null, `🎟️ ${g.ctx.state.festivals.tokens}`));
    const row = (o: Offer) => h('div.item-row', null, h('span.em', null, o.icon), h('div.info', null, h('b', null, o.name), h('span', null, o.locked ?? o.desc ?? '')),
      h('span.price', null, `${currencyIcon(o.currency)} ${fmt(o.price)}`),
      o.owned ? h('span.muted', null, '✓') : h(`button.btn.small${o.locked ? '.disabled' : ''}`, { onclick: () => { if (g.ctx.shop.buy(o, 1)) { g.audio.play('coin'); ui.toast(`${o.name} acheté !`, o.icon, 'good'); ui.setPanelBody(...render()); } else g.audio.play('error'); } }, 'Acheter'),
      o.kind === 'item' && !o.locked ? h('button.btn.small.ghost', { onclick: () => { if (g.ctx.shop.buy(o, 5)) { g.audio.play('coin'); ui.setPanelBody(...render()); } } }, '×5') : null,
    );
    return [wallet, h('div.list', null, ...offers.map(row))];
  };
  const extra = shopId !== 'boutique' ? null : h('div.muted', { style: { marginRight: '8px' } }, 'Cosmétiques uniquement');
  ui.showPanel('shop', SHOP_NAMES[shopId] ?? 'Boutique', render(), { headExtra: extra ?? undefined });
}

// ====================================================================== sell (shipping bin / shops)
function sell(ui: UI, where: 'bin' | 'shop' | 'fishing' | 'bakery' | 'market' = 'bin'): void {
  const g = ui.g;
  const render = (): any[] => {
    const st = g.ctx.state;
    const stacks = new Map<string, number>();
    for (const s of st.inventory) if (s && item(s.id).sell > 0) stacks.set(s.id, (stacks.get(s.id) ?? 0) + s.qty);
    if (!stacks.size) return [h('p.muted.center', null, 'Rien à vendre pour le moment.')];
    return [h('div.list', null, ...[...stacks.entries()].map(([id, q]) => {
      const p = g.ctx.economy.priceOf(id, where);
      return h('div.item-row', null, h('span.em', null, item(id).icon), h('div.info', null, h('b', null, item(id).name), h('span', null, `×${q} · ${p} 🪙 pièce`)),
        h('button.btn.small.ghost', { onclick: () => { const t = g.ctx.economy.sell(id, 1, where); if (t) { g.audio.play('coin'); ui.setPanelBody(...render()); } } }, '1'),
        h('button.btn.small', { onclick: () => { const t = g.ctx.economy.sell(id, q, where); if (t) { g.audio.play('coin'); ui.toast(`+${fmt(t)} pièces`, '🪙', 'good'); ui.setPanelBody(...render()); } } }, `Tout (${fmt(p * q)})`));
    }))];
  };
  ui.showPanel('sell', where === 'bin' ? 'Caisse d\'expédition' : 'Vendre', render());
}

// ====================================================================== crafting
function craft(ui: UI, station: Station = 'hand', cat?: RecipeCat): void {
  const g = ui.g;
  const avail = g.ctx.building.stationsAvailable();
  const recipesAll = RECIPES.filter((r) => r.station === station || (station === 'workbench' && r.station === 'hand') || (station === 'kitchen' && r.station === 'kitchen'));
  const cats = [...new Set(recipesAll.map((r) => r.cat))];
  const curCat = cat ?? cats[0];
  const render = (): any[] => {
    const list = recipesAll.filter((r) => r.cat === curCat);
    const catName: Record<string, string> = { agri: '🌱 Agriculture', build: '🏠 Bâtiments', furniture: '🪑 Meubles', cooking: '🍳 Cuisine', tools: '🛠️ Outils', decor: '🎨 Décoration', material: '🧱 Matériaux' };
    return [
      h('div.muted', { style: { marginBottom: '8px' } }, `Poste : ${STATION_NAMES[station]}${avail.has(station) ? '' : ' (non disponible ici)'} · ${catName[curCat] ?? curCat}`),
      h('div.list', null, ...list.map((r) => {
        const known = g.ctx.crafting.isKnown(r);
        const out = DECOR_BY_ID[r.out] ?? item(r.out);
        const max = g.ctx.crafting.maxCraftable(r);
        const can = known && max > 0 && avail.has(r.station);
        return h('div.item-row', null, h('span.em', null, known ? out.icon : '🔒'), h('div.info', null, h('b', null, known ? `${out.name}${r.qty > 1 ? ` ×${r.qty}` : ''}` : '???'),
          known ? costList(ui, r.ing) : h('span', null, `À débloquer : ${g.ctx.crafting.unlockHint(r)}`),
          known && DISH_BY_ID[r.out]?.buff ? h('span', null, BUFF_NAMES[DISH_BY_ID[r.out].buff!.id]) : null),
          h(`button.btn.small${can ? '' : '.disabled'}`, { onclick: () => { if (g.ctx.crafting.craft(r.id)) { g.audio.play(DISH_BY_ID[r.out] ? 'eat' : 'build'); ui.toast(`${out.name} fabriqué !`, out.icon, 'good'); ui.setPanelBody(...render()); } } }, 'Créer'),
          max > 1 && can ? h('button.btn.small.ghost', { onclick: () => { g.ctx.crafting.craft(r.id, max); g.audio.play('build'); ui.setPanelBody(...render()); } }, `×${max}`) : null);
      })),
    ];
  };
  const t = cats.length > 1 ? tabs(cats.map((c) => ({ id: c, label: ({ agri: '🌱 Agri', build: '🏠 Bâtiments', furniture: '🪑 Meubles', cooking: '🍳 Cuisine', tools: '🛠️ Outils', decor: '🎨 Déco', material: '🧱 Matériaux' } as Record<string, string>)[c] ?? c })), curCat, (id) => craft(ui, station, id as RecipeCat)) : undefined;
  ui.showPanel('craft', STATION_NAMES[station] === 'À la main' ? 'Fabrication' : STATION_NAMES[station], render(), { tabs: t });
}

// ====================================================================== village restoration
function restore(ui: UI, id: string): void {
  const g = ui.g;
  const def = VILLAGE_BY_ID[id];
  const render = (): any[] => {
    const m = g.ctx.village.missing(id);
    const avail = g.ctx.village.available(id);
    const contributed = g.ctx.state.village[id].contributed;
    return [h('div.center', null, h('div', { style: { fontSize: '56px' } }, def.icon), h('p', null, def.desc)),
      h('div.detail', null, h('span.em', null, '✨'), h('div', null, h('b', null, 'Une fois restauré :'), h('div.muted', null, def.benefit))),
      h('h3', null, 'Il manque encore :'),
      avail ? h('div', null, m.items.length || m.coins ? costList(ui, m.items, m.coins) : h('span', null, 'Rien !'), contributed.__coins || Object.keys(contributed).length ? h('div.muted', { style: { marginTop: '6px' } }, 'Vos contributions précédentes sont conservées.') : null)
        : h('p.muted', null, `Restaurez d'abord : ${(def.requires ?? []).map((r) => VILLAGE_BY_ID[r].name).join(', ')}`),
      h('div.center', { style: { marginTop: '14px' } }, h(`button.btn.peach${avail ? '' : '.disabled'}`, {
        onclick: () => {
          const r = g.ctx.village.contribute(id);
          if (r.restored) {
            ui.closePanel();
            g.refreshWorld('all');
          } else if (r.gave) {
            g.audio.play('coin');
            ui.toast('Contribution enregistrée !', '🧺', 'good');
            ui.setPanelBody(...render());
          } else {
            g.audio.play('error');
            ui.toast('Il vous faut encore des matériaux.', '🪵', 'warn');
          }
        },
      }, '🔨 Contribuer'))];
  };
  ui.showPanel('restore', `Restaurer : ${def.name}`, render(), { size: 'narrow' });
}

// ====================================================================== build menu
function build(ui: UI, tab = 'buildings'): void {
  const g = ui.g;
  const inFarm = g.regionId === 'farm', inHouse = g.regionId === 'house';
  const render = (): any[] => {
    if (!inFarm && !inHouse) return [h('p.center', null, '🏡 La construction se fait sur votre ferme ou dans votre maison.')];
    const editBtn = h('div.row', { style: { marginBottom: '10px' } }, h('button.btn.small.sky', { onclick: () => { ui.closePanel(); g.enterEditMode(); } }, '✋ Déplacer / ranger des objets'),
      inHouse ? h('button.btn.small.lav', { onclick: () => houseDecor(ui) }, '🖌️ Murs & sols') : null);
    if (tab === 'buildings' && inFarm) {
      return [editBtn, h('div.list', null, ...BUILDINGS.filter((b) => b.id !== 'house').map((b) => {
        const aff = g.ctx.building.affordable(b.id);
        const count = g.ctx.building.count(b.id);
        return h('div.item-row', null, h('span.em', null, b.icon), h('div.info', null, h('b', null, `${b.name} (${count}/${b.max})`), h('span', null, b.desc), costList(ui, b.items, b.coins)),
          h(`button.btn.small${aff.ok ? '' : '.disabled'}`, { onclick: () => { ui.closePanel(); g.enterPlacement(b.id); } }, 'Placer'));
      }))];
    }
    const owned = Object.entries(g.ctx.state.decorOwned).filter(([id, n]) => n > 0 && (inHouse ? DECOR_BY_ID[id].indoor || ['flowers', 'lights', 'magic', 'colorful', 'winter', 'halloween'].includes(DECOR_BY_ID[id].cat) : !DECOR_BY_ID[id].indoor));
    const saplings = inFarm ? g.ctx.inventory.slots.filter((s) => s && s.id.startsWith('sapling_')) : [];
    return [editBtn,
      owned.length || saplings.length ? h('div.list', null,
        ...saplings.map((s) => h('div.item-row', null, h('span.em', null, '🌳'), h('div.info', null, h('b', null, item(s!.id).name), h('span', null, `×${s!.qty}`)), h('button.btn.small', { onclick: () => { ui.closePanel(); g.enterPlacement(s!.id); } }, 'Planter'))),
        ...owned.map(([id, n]) => h('div.item-row', null, h('span.em', null, DECOR_BY_ID[id].icon), h('div.info', null, h('b', null, DECOR_BY_ID[id].name), h('span', null, `×${n}`)), h('button.btn.small', { onclick: () => { ui.closePanel(); g.enterPlacement(id); } }, 'Placer'))))
        : h('p.muted.center', null, 'Aucune décoration en stock. Achetez-en chez Mallow, Pippa ou Toma, ou fabriquez-en à l\'atelier.'),
    ];
  };
  const t = inFarm ? tabs([{ id: 'buildings', label: '🏠 Bâtiments' }, { id: 'decor', label: '🌸 Décorations' }], tab, (id) => build(ui, id)) : undefined;
  ui.showPanel('build', inHouse ? 'Décorer la maison' : 'Construire', render(), { tabs: t });
}

function houseDecor(ui: UI, room = 'bedroom'): void {
  const g = ui.g;
  const st = g.ctx.state;
  const render = (): any[] => {
    const rs = st.house.rooms[room];
    if (!rs.unlocked) return [h('p.center', null, '🔒 Pièce à débloquer en agrandissant la maison chez Toma.')];
    const pick = (list: typeof WALLPAPERS, cur: string, price: number, set: (id: string) => void) => h('div.row', { style: { flexWrap: 'wrap' } }, ...list.map((w) => h(`button.chip${w.id === cur ? '.on' : ''}`, {
      style: { background: `linear-gradient(135deg, #${w.c1.toString(16).padStart(6, '0')} 50%, #${w.c2.toString(16).padStart(6, '0')} 50%)` },
      onclick: () => {
        if (w.id === cur) return;
        if (!g.ctx.economy.spend(price)) { ui.toast('Pas assez de pièces', '🪙', 'warn'); return; }
        set(w.id);
        g.refreshWorld('house');
        g.audio.play('build');
        ui.setPanelBody(...render());
      },
    }, w.name)));
    return [h('h3', null, `Papier peint (${WALL_PRICE} 🪙)`), pick(WALLPAPERS, rs.wall, WALL_PRICE, (id) => (rs.wall = id)), h('h3', null, `Sol (${FLOOR_PRICE} 🪙)`), pick(FLOORS, rs.floor, FLOOR_PRICE, (id) => (rs.floor = id))];
  };
  const t = tabs(HOUSE_ROOMS.map((r) => ({ id: r.id, label: `${st.house.rooms[r.id].unlocked ? '' : '🔒 '}${ROOM_NAMES[r.id]}` })), room, (id) => houseDecor(ui, id));
  ui.showPanel('houseDecor', 'Murs & sols', render(), { tabs: t });
}

// ====================================================================== tools & house upgrades (Toma)
function upgrades(ui: UI): void {
  const g = ui.g;
  const render = (): any[] => {
    const st = g.ctx.state;
    const toolRows = TOOLS.map((t) => {
      const tier = st.player.tools[t.id];
      const cost = g.ctx.tools.upgradeCost(t.id);
      const can = g.ctx.tools.canUpgrade(t.id);
      return h('div.item-row', null, h('span.em', null, t.icon), h('div.info', null, h('b', null, `${t.name} — ${TOOL_TIERS[tier]}`), h('span', null, `Actuel : ${t.tiers[tier]}${cost ? ` → ${t.tiers[tier + 1]}` : ''}`), cost ? costList(ui, cost.items, cost.coins) : h('span', null, '✨ Niveau maximum')),
        cost ? h(`button.btn.small${can.ok ? '' : '.disabled'}`, { onclick: () => { if (g.ctx.tools.upgrade(t.id)) { g.audio.play('levelup'); ui.toast(`${t.name} amélioré(e) !`, t.icon, 'good'); ui.setPanelBody(...render()); } } }, 'Améliorer') : null);
    });
    const next = HOUSE_UPGRADES.find((u) => u.level === st.house.level + 1);
    const houseRow = next ? h('div.item-row', null, h('span.em', null, '🏡'), h('div.info', null, h('b', null, `Agrandir : ${next.name}`), h('span', null, `Nouvelle pièce : ${next.rooms.map((r) => ROOM_NAMES[r]).join(', ')}`), costList(ui, next.items, next.coins)),
      h(`button.btn.small${st.player.coins >= next.coins && g.ctx.inventory.hasAll(next.items) ? '' : '.disabled'}`, {
        onclick: () => {
          if (!g.ctx.economy.spend(next.coins)) return;
          g.ctx.inventory.removeAll(next.items);
          st.house.level = next.level;
          for (const r of next.rooms) st.house.rooms[r].unlocked = true;
          g.audio.play('build');
          ui.toast('Maison agrandie !', '🏡', 'good');
          ui.setPanelBody(...render());
        },
      }, 'Agrandir')) : h('p.muted', null, '🏡 Votre maison est à sa taille maximale.');
    return [h('h3', null, 'Outils'), h('div.list', null, ...toolRows), h('h3', null, 'Maison'), houseRow];
  };
  ui.showPanel('upgrades', 'Atelier de Toma', render());
}

// ====================================================================== seeds
function seeds(ui: UI): void {
  const g = ui.g;
  const list = g.ctx.inventory.seeds();
  const sel = g.ctx.state.player.selectedSeed;
  ui.showPanel('seeds', 'Graines', list.length ? h('div.list', null, ...list.map((s) => {
    const crop = CROP_BY_ID[s.id.replace('seed_', '')];
    return h('div.item-row', null, h('span.em', null, crop ? crop.icon : '🌳'), h('div.info', null, h('b', null, item(s.id).name), h('span', null, crop ? `${crop.seasons.join(', ')} · ${Math.round(crop.grow / 60)} h${crop.regrow ? ' · repousse' : ''}` : 'Arbre fruitier')),
      h('span.price', null, `×${s.qty}`),
      h(`button.btn.small${sel === s.id ? '.peach' : ''}`, { onclick: () => { if (s.id.startsWith('sapling_')) { ui.closePanel(); g.enterPlacement(s.id); return; } g.selectSeed(s.id); ui.closePanel(); } }, sel === s.id ? 'Équipé' : 'Choisir'));
  })) : h('p.muted.center', null, 'Aucune graine. Mallow en vend au village !'), { size: 'narrow' });
}

// ====================================================================== gifts
function gift(ui: UI, npcId: string): void {
  const g = ui.g;
  const def = NPC_BY_ID[npcId];
  const stacks = g.ctx.inventory.slots.filter((s): s is { id: string; qty: number } => !!s);
  ui.showPanel('gift', `Offrir à ${def.name}`, [
    h('p.muted', null, `${def.name} adore : ${def.loves.slice(0, 2).map((i) => ITEMS[i] ? item(i).icon : '').join(' ')} … (découvrez le reste !)`),
    h('div.grid', null, ...stacks.map((s) => h('button.slot', { onclick: () => {
      const r = g.ctx.npcs.gift(npcId, s.id);
      ui.closePanel();
      if (r.text) {
        g.audio.play(r.reaction === 'love' ? 'levelup' : r.reaction === 'dislike' ? 'error' : 'pop');
        ui.dialogue(npcId, r.text, [{ label: 'Avec plaisir 😊', fn: () => ui.closeDialogue() }]);
      }
    } }, item(s.id).icon, h('span.q', null, s.qty)))),
  ]);
}

// ====================================================================== friends
function friends(ui: UI): void {
  const g = ui.g;
  const st = g.ctx.state;
  ui.showPanel('friends', 'Habitants', h('div.list', null, ...Object.values(NPC_BY_ID).map((n) => {
    const lv = g.ctx.npcs.level(n.id);
    const next = (FRIEND_REWARDS[n.id] ?? []).find((r) => r.level > lv);
    return h('div.item-row', null, h('span.em', null, st.npcs[n.id].met ? '🙂' : '❔'), h('div.info', null, h('b', null, `${n.name} — ${n.role}`), h('span', null, st.npcs[n.id].met ? n.desc : 'Pas encore rencontré(e).'), h('div', null, '🍃'.repeat(lv) + '·'.repeat(10 - lv)), next ? h('span', null, `Prochaine récompense (niv. ${next.level}) : ${next.reward}`) : null));
  })));
}

// ====================================================================== animal card
function animal(ui: UI, uid: string): void {
  const g = ui.g;
  const a = g.ctx.animals.byUid(uid);
  if (!a) return;
  const def = ANIMAL_BY_ID[a.species];
  const bar = (label: string, v: number, max = 100) => h('div', null, h('div.muted', null, label), h('div.progress', null, h('i', { style: { width: `${(v / max) * 100}%` } })));
  const feedables = ['hay', 'animal_treat', 'carrot', 'apple', 'wheat', 'lettuce', 'corn', 'wild_berry'].filter((i) => g.ctx.inventory.has(i));
  ui.showPanel('animal', `${def.icon} ${a.name}`, [
    h('p.muted', null, def.desc),
    bar('🍽️ Rassasié', a.hunger), bar('😊 Bonheur', a.happiness), bar('🍃 Amitié', a.friendship, 1000),
    h('p.muted', null, a.product ? `Produit prêt : ${item(a.product).icon} ${item(a.product).name}` : def.product ? `Produit : ${item(def.product).icon} tous les ${def.productEvery} jour(s) s'il est nourri et heureux.` : 'Un fidèle compagnon.'),
    h('h3', null, 'Nourrir'),
    feedables.length ? h('div.row', { style: { flexWrap: 'wrap' } }, ...feedables.map((f) => h('button.btn.small.ghost', { onclick: () => { if (g.ctx.animals.feed(uid, f)) { g.audio.play('eat'); ui.toast(`${a.name} se régale !`, '😋', 'good'); ui.closePanel(); } } }, `${item(f).icon} ${item(f).name}`)))
      : h('p.muted', null, 'Pas de nourriture dans le sac (foin, friandises, légumes...). Un silo nourrit vos animaux automatiquement.'),
  ], { size: 'narrow' });
}

// ====================================================================== elevator
function elevator(ui: UI): void {
  const g = ui.g;
  ui.showPanel('elevator', 'Ascenseur de la mine', h('div.row', { style: { flexWrap: 'wrap', justifyContent: 'center' } }, ...g.ctx.mining.elevatorFloors().map((f) => h('button.btn', { onclick: () => { ui.closePanel(); g.goMine(f); } }, `Niveau ${f}`))), { size: 'narrow' });
}

// ====================================================================== Cozy Pass
function pass(ui: UI): void {
  const g = ui.g;
  const render = (): any[] => {
    const p = g.ctx.state.pass;
    const tier = g.ctx.shop.passTier();
    const rows: HTMLElement[] = [];
    for (let t = 0; t < PASS_TIERS; t++) {
      const cell = (premium: boolean) => {
        const r = passReward(t, premium);
        const claimed = (premium ? p.claimedPremium : p.claimedFree).includes(t);
        const claimable = t < tier && !claimed && (!premium || p.premium);
        return h(`div.passcell${claimed ? '.claimed' : claimable ? '.claimable' : t >= tier || (premium && !p.premium) ? '.locked' : ''}`, { onclick: () => { if (claimable && g.ctx.shop.claimPass(t, premium)) { g.audio.play('gem'); ui.toast(r.label, r.icon, 'good'); ui.setPanelBody(...render()); } } }, h('span', { style: { fontSize: '22px' } }, r.icon), h('span', null, r.label), claimed ? ' ✓' : '');
      };
      rows.push(h('div.passrow', null, h('b.center', null, t + 1), cell(false), cell(true)));
    }
    return [
      h('p', null, 'Gagnez des points en jouant comme vous aimez : récolter, pêcher, explorer, cuisiner... Aucune obligation, aucun achat réel.'),
      h('div.row', null, h('div.progress.grow', null, h('i', { style: { width: `${(p.points % PASS_POINTS_PER_TIER)}%` } })), h('b', null, `Palier ${tier}/${PASS_TIERS}`)),
      h('div.passrow', { style: { margin: '10px 0 6px' } }, h('span'), h('b.center', null, '🌿 Gratuit'), h('b.center', null, '🌟 Cozy Pass+')),
      p.premium ? null : h('div.center', { style: { margin: '6px 0 12px' } }, h('button.btn.lav', { onclick: () => { if (g.ctx.shop.buyPremiumPass()) { g.audio.play('gem'); ui.confetti(); ui.setPanelBody(...render()); } } }, `Débloquer Cozy Pass+ (💎 ${PASS_PREMIUM_GEMS})`), h('div.muted', null, 'Les Moon Gems se gagnent en jeu (quêtes, collections, niveaux).')),
      h('div.col', null, ...rows),
    ];
  };
  ui.showPanel('pass', `Cozy Pass — Saison ${g.ctx.state.pass.season}`, render());
}

// ====================================================================== wardrobe & character editor
export function lookEditor(ui: UI, look: Appearance, onChange: (l: Appearance) => void, ownedOnly: boolean): HTMLElement {
  const st = ui.g.ctx?.state;
  const owned = (slot: string, id: string) => !ownedOnly || !st || st.wardrobe.includes(`${slot}:${id}`);
  const wrap = h('div.creator');
  const draw = () => {
    const opt = (label: string, ...els: HTMLElement[]) => h('div.opt', null, h('span', null, label), ...els);
    const sw = (list: number[], cur: number, set: (i: number) => void, asIndex = true) => list.map((c, i) => h(`button.swatch${(asIndex ? i : c) === cur ? '.on' : ''}`, { style: { background: `#${c.toString(16).padStart(6, '0')}` }, onclick: () => { set(asIndex ? i : c); onChange(look); draw(); } }));
    const chips = (list: string[], cur: number, set: (i: number) => void) => list.map((n, i) => h(`button.chip${i === cur ? '.on' : ''}`, { onclick: () => { set(i); onChange(look); draw(); } }, n));
    const wear = (slot: 'top' | 'bottom' | 'shoes' | 'hat' | 'accessory', cur: string, set: (id: string) => void) => WEAR.filter((w) => w.slot === slot).map((w) => {
      const ok = owned(slot, w.id);
      return h(`button.chip${w.id === cur ? '.on' : ''}`, { style: ok ? {} : { opacity: '.4' }, onclick: () => { if (!ok) { ui.toast('À acheter à la Boutique Cozy', '🛍️'); return; } set(w.id); onChange(look); draw(); } }, `${w.icon} ${w.name}`);
    });
    wrap.replaceChildren(
      opt('Peau', ...sw(SKIN_TONES, look.skin, (i) => (look.skin = i))),
      opt('Coiffure', ...chips(HAIR_STYLES, look.hairStyle, (i) => (look.hairStyle = i))),
      opt('Cheveux', ...sw(HAIR_COLORS, look.hairColor, (i) => (look.hairColor = i))),
      opt('Yeux', ...chips(EYE_STYLES, look.eyeStyle, (i) => (look.eyeStyle = i)), ...sw(EYE_COLORS, look.eyeColor, (i) => (look.eyeColor = i))),
      opt('Haut', ...wear('top', look.top, (id) => (look.top = id))),
      opt('', ...sw(CLOTH_COLORS, look.topColor, (c) => (look.topColor = c), false)),
      opt('Bas', ...wear('bottom', look.bottom, (id) => (look.bottom = id)), ...sw(CLOTH_COLORS, look.bottomColor, (c) => (look.bottomColor = c), false)),
      opt('Chaussures', ...wear('shoes', look.shoes, (id) => (look.shoes = id)), ...sw(CLOTH_COLORS, look.shoesColor, (c) => (look.shoesColor = c), false)),
      opt('Chapeau', ...wear('hat', look.hat, (id) => (look.hat = id)), ...sw(CLOTH_COLORS, look.hatColor, (c) => (look.hatColor = c), false)),
      opt('Accessoire', ...wear('accessory', look.accessory, (id) => (look.accessory = id))),
      opt('Joues', h(`button.chip${look.cheeks ? '.on' : ''}`, { onclick: () => { look.cheeks = !look.cheeks; onChange(look); draw(); } }, look.cheeks ? '😊 Rosées' : '🙂 Neutres')),
    );
  };
  draw();
  return wrap;
}

function wardrobe(ui: UI): void {
  const g = ui.g;
  const st = g.ctx.state;
  const look = JSON.parse(JSON.stringify(st.player.look)) as Appearance;
  g.previewLook(look);
  const themes = h('div.row', { style: { flexWrap: 'wrap' } }, ...FARM_THEMES.filter((t) => (st.flags.themesOwned ?? ['classic']).includes(t.id)).map((t) => h(`button.chip${st.flags.theme === t.id ? '.on' : ''}`, { onclick: () => { st.flags.theme = t.id; g.refreshWorld('all'); wardrobe(ui); } }, t.name)));
  const trails = h('div.row', { style: { flexWrap: 'wrap' } }, ...TRAILS.filter((t) => (st.flags.trailsOwned ?? ['none']).includes(t.id)).map((t) => h(`button.chip${st.flags.trail === t.id ? '.on' : ''}`, { onclick: () => { st.flags.trail = t.id; wardrobe(ui); } }, t.name)));
  ui.showPanel('wardrobe', 'Garde-robe', [
    lookEditor(ui, look, (l) => g.previewLook(l), true),
    h('h3', null, '🎨 Thème de la ferme'), themes,
    h('h3', null, '✨ Traînée de pas'), trails,
    h('div.center', { style: { marginTop: '14px' } }, h('button.btn', { onclick: () => { st.player.look = look; g.previewLook(null); g.refreshLook(); ui.closePanel(); ui.toast('Nouveau style !', '👗', 'good'); } }, '✓ Valider')),
  ], { size: 'wide', onClose: () => g.previewLook(null) });
}

// ====================================================================== settings
function settings(ui: UI): void {
  const g = ui.g;
  const s = g.settings;
  const st = g.ctx.state;
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => {
    s[k] = v;
    g.saveSettings();
    settings(ui);
  };
  const chips = <T extends string>(list: [T, string][], cur: T, on: (v: T) => void) => h('div.row', { style: { flexWrap: 'wrap' } }, ...list.map(([v, l]) => h(`button.chip${v === cur ? '.on' : ''}`, { onclick: () => on(v) }, l)));
  const slider = (k: 'music' | 'sfx' | 'ambience') => h('input.slider', { type: 'range', min: 0, max: 1, step: 0.05, value: s[k], oninput: (e: Event) => { s[k] = +(e.target as HTMLInputElement).value; g.saveSettings(); } });
  let code = '';
  const ta = h('textarea.text', { placeholder: 'Collez un code de sauvegarde ici pour l\'importer…' }) as HTMLTextAreaElement;
  ui.showPanel('settings', 'Menu', [
    h('div.row', { style: { flexWrap: 'wrap', marginBottom: '8px' } },
      h('button.btn.small.peach', { onclick: () => wardrobe(ui) }, '👗 Garde-robe'),
      h('button.btn.small.lav', { onclick: () => pass(ui) }, '🎟️ Cozy Pass'),
      h('button.btn.small.sky', { onclick: () => friends(ui) }, '🙂 Habitants'),
      h('button.btn.small', { onclick: () => shop(ui, 'boutique') }, '🛍️ Boutique'),
      h('button.btn.small.ghost', { onclick: () => festivalsInfo(ui) }, '🎉 Fêtes'),
    ),
    h('h3', null, '🎮 Contrôles'),
    chips<ControlMode>([['both', 'Joystick + toucher'], ['joystick', 'Joystick'], ['tap', 'Toucher pour aller']], s.controls, (v) => set('controls', v)),
    h('div.row', { style: { marginTop: '6px' } }, h(`button.chip${s.leftHanded ? '.on' : ''}`, { onclick: () => set('leftHanded', !s.leftHanded) }, '🫲 Mode gaucher'), h(`button.chip${s.haptics ? '.on' : ''}`, { onclick: () => set('haptics', !s.haptics) }, '📳 Vibrations')),
    h('h3', null, '✨ Qualité graphique'),
    chips<Quality>([['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH'], ['ultra', 'ULTRA']], s.quality, (v) => set('quality', v)),
    h('div.row', { style: { marginTop: '6px' } }, h(`button.chip${s.autoQuality ? '.on' : ''}`, { onclick: () => set('autoQuality', !s.autoQuality) }, '⚡ Résolution adaptative'), h(`button.chip${s.showFps ? '.on' : ''}`, { onclick: () => set('showFps', !s.showFps) }, '📈 Afficher FPS')),
    h('h3', null, '🎵 Son'),
    h('div.col', null, h('span.muted', null, 'Musique'), slider('music'), h('span.muted', null, 'Effets'), slider('sfx'), h('span.muted', null, 'Ambiance'), slider('ambience')),
    h('h3', null, '💾 Sauvegarde'),
    h('p.muted', null, `${st.player.name} · ${st.player.farmName} · Jour ${st.time.day} · ${Math.floor(st.playSeconds / 60)} min de jeu. Sauvegarde automatique activée.`),
    h('div.row', { style: { flexWrap: 'wrap' } },
      h('button.btn.small', { onclick: async () => { const ok = await g.save(); ui.toast(ok ? 'Partie sauvegardée' : 'Échec de la sauvegarde', ok ? '💾' : '⚠️', ok ? 'good' : 'warn'); } }, '💾 Sauvegarder'),
      h('button.btn.small.ghost', { onclick: () => { code = g.exportSave(); ta.value = code; ta.select(); try { navigator.clipboard?.writeText(code); ui.toast('Code copié', '📋'); } catch { /* ignore */ } } }, '📤 Exporter'),
      h('button.btn.small.ghost', { onclick: async () => { if (await g.importSave(ta.value)) { ui.closePanel(); ui.toast('Sauvegarde importée', '📥', 'good'); } else ui.toast('Code invalide', '⚠️', 'warn'); } }, '📥 Importer'),
    ),
    ta,
    h('div.row', { style: { marginTop: '10px' } }, h('button.btn.small.rose', { onclick: () => ui.confirm('Effacer cette partie et recommencer ? (irréversible)', () => g.resetGame(), 'Effacer') }, '🗑️ Nouvelle partie')),
    h('p.muted.center', { style: { marginTop: '14px' } }, 'Mossy Meadows v1.0 — un jeu cozy original. Aucune romance, juste des amis 🌿'),
  ]);
}

function festivalsInfo(ui: UI): void {
  const g = ui.g;
  const up = g.ctx.festivals.upcoming();
  ui.showPanel('festivals', 'Calendrier des fêtes', [
    up ? h('div.detail', null, h('span.em', null, up.fest.icon), h('div', null, h('b', null, up.fest.name), h('div.muted', null, up.inDays === 0 ? 'Aujourd\'hui !' : `Dans ${up.inDays} jour(s)`))) : null,
    h('div.list', { style: { marginTop: '10px' } }, ...FESTIVALS.map((f) => h('div.item-row', null, h('span.em', null, f.icon), h('div.info', null, h('b', null, f.name), h('span', null, `${f.season === 'any' ? 'Après une grosse pluie' : `${({ spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' } as any)[f.season]} jour ${f.day}`} · ${f.desc}`))))),
    h('div.center', { style: { marginTop: '10px' } }, h('button.btn.small', { onclick: () => shop(ui, 'festival') }, `🎟️ Stand des jetons (${g.ctx.state.festivals.tokens})`)),
  ]);
}

function daySummary(ui: UI, data: { day: number; earned: number; weather: string; forecast: string; passedOut: boolean; fest?: string }): void {
  ui.showPanel('summary', `Jour ${data.day}`, h('div.center', null,
    h('div', { style: { fontSize: '60px' } }, data.passedOut ? '😴' : '🌅'),
    h('p', null, data.passedOut ? 'Vous vous êtes endormi(e) tard... Rien de grave, une bonne nuit et c\'est reparti !' : 'Une nouvelle journée commence à Green Valley.'),
    data.earned ? h('p', null, `Gains d'hier : 🪙 ${fmt(data.earned)}`) : null,
    h('p', null, `Météo du jour : ${data.weather} · Demain : ${data.forecast}`),
    data.fest ? h('p', { style: { fontWeight: '600', color: '#e06a8a' } }, data.fest) : null,
    h('button.btn', { onclick: () => ui.closePanel() }, 'C\'est parti !'),
  ), { size: 'narrow' });
}

export const PANELS = {
  inventory, quests, collections, map, shop, sell, craft, restore, build, houseDecor, upgrades, seeds, gift, friends, animal, elevator, pass, wardrobe, settings, festivalsInfo, daySummary,
};
export { BUILDING_BY_ID, DECOR, TOOL_BY_ID };
export type { ToolId };
