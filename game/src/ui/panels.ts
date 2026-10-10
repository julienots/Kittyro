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
import { HAMLET_BUILDINGS, HAMLET_BY_ID, HAMLET_GOALS, VILLAGER_TRAITS, type TraitId } from '../data/hamlet';

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

const PANEL_TIPS: Record<string, [string, string, string]> = {
  build: ['🔨', 'Construire', 'Choisissez un bâtiment ou une décoration, faites-le glisser du doigt : vert = possible, rouge = impossible. ✓ pour valider.'],
  inventory: ['🎒', 'Votre sac', 'Touchez un objet pour le manger, l\'équiper ou le ranger. Si le sac est plein, rien n\'est perdu : tout part à la remise.'],
  collections: ['📖', 'Collections', 'Chaque nouvelle découverte remplit vos albums. Touchez une case grise pour savoir où la trouver.'],
};

export function openPanel(ui: UI, name: string, ...args: any[]): void {
  const fn = (PANELS as any)[name];
  const t = PANEL_TIPS[name];
  if (t) setTimeout(() => ui.tip(`panel_${name}`, t[0], t[1], t[2]), 300);
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
      const can = (d.indoor ? g.regionId === 'house' : g.regionId === 'farm' || g.regionId === 'hamlet') || (!d.indoor && g.regionId === 'house' && ['flowers', 'lights', 'magic', 'colorful', 'winter', 'halloween'].includes(d.cat));
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
      q.kind === 'story' || q.kind === 'village' ? h('div.muted', null, q.desc) : null,
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
/** Painted look per region: top colour, soil side, accent, island size. */
const MAP_STYLE: Record<string, { top: string; top2: string; side: string; size: number; deco: string }> = {
  farm: { top: '#9fd472', top2: '#c4e894', side: '#9a6a42', size: 1.0, deco: 'farm' },
  village: { top: '#b8e08a', top2: '#dcf2b4', side: '#9a6a42', size: 0.95, deco: 'village' },
  woods: { top: '#4f9e52', top2: '#79c06a', side: '#6a4a32', size: 1.05, deco: 'woods' },
  mountains: { top: '#a8b4a0', top2: '#cfd8c4', side: '#7a7a88', size: 1.0, deco: 'mountains' },
  mine: { top: '#8a7a78', top2: '#a8988e', side: '#4a3a38', size: 0.62, deco: 'mine' },
  coast: { top: '#f4e0a8', top2: '#fff2c8', side: '#c8a06a', size: 1.0, deco: 'coast' },
  frosty: { top: '#eef4ff', top2: '#ffffff', side: '#8a9ab8', size: 0.95, deco: 'frosty' },
  ember: { top: '#9a6a5a', top2: '#c08a6a', side: '#3a2a2a', size: 0.95, deco: 'ember' },
  hamlet: { top: '#c8e07a', top2: '#e4f2a8', side: '#9a6a42', size: 0.9, deco: 'hamlet' },
};
const MAP_W = 1000, MAP_H = 625;

function blobPath(cx: number, cy: number, r: number, seed: number, squash = 0.62): string {
  const pts: [number, number][] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + Math.sin(a * 3 + seed) * 0.08 + Math.sin(a * 5 + seed * 2.3) * 0.06;
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * squash]);
  }
  // smooth closed curve through the points (Catmull-Rom → cubic Bézier)
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

/** Small painted props drawn on each island (trees, roofs, peaks...). */
function islandDeco(kind: string, cx: number, cy: number, r: number, hamletPop: number): string {
  const tree = (x: number, y: number, s = 1, c = '#3f8a4a') => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="-2" width="4" height="9" rx="1.5" fill="#7a5232"/><circle cy="-8" r="9" fill="${c}"/><circle cx="-3" cy="-11" r="4" fill="#ffffff" opacity=".18"/></g>`;
  const pine = (x: number, y: number, s = 1, c = '#2f7a4a') => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-1.6" y="0" width="3.2" height="6" fill="#6a4a32"/><path d="M0 -20 L10 2 L-10 2Z" fill="${c}"/><path d="M0 -20 L4 -11 L-2 -9Z" fill="#fff" opacity=".2"/></g>`;
  const house = (x: number, y: number, s = 1, roof = '#e8665a', wall = '#fff4e0') => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-8" y="-8" width="16" height="11" rx="1.5" fill="${wall}"/><path d="M-11 -7 L0 -17 L11 -7Z" fill="${roof}"/><rect x="-2.5" y="-3" width="5" height="6" fill="#8a5a3a"/></g>`;
  const peak = (x: number, y: number, s = 1, c = '#8a8a98', snow = '#ffffff') => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-18 6 L0 -24 L18 6Z" fill="${c}"/><path d="M0 -24 L7 -12 L2 -14 L-2 -10 L-7 -12Z" fill="${snow}"/><path d="M0 -24 L-18 6 L-6 6Z" fill="#000" opacity=".1"/></g>`;
  const o: string[] = [];
  switch (kind) {
    case 'farm':
      for (let i = 0; i < 4; i++) { const x = cx - 36 + i * 9, y = cy + 2; o.push(`<path d="M${x} ${y} h6 l-5 15 h-6Z" fill="${i % 2 ? '#a8784a' : '#8a5a3a'}"/>`); }
      o.push(house(cx + 18, cy - 2, 1.2, '#d8665a'), tree(cx - 30, cy - 6, 0.9), tree(cx + 40, cy + 8, 0.7, '#5aa84a'));
      break;
    case 'village':
      o.push(house(cx - 20, cy, 1, '#6a9ad8'), house(cx + 2, cy - 8, 1.15, '#e8a33a'), house(cx + 24, cy + 2, 1, '#6ab86a'), `<circle cx="${cx - 2}" cy="${cy + 14}" r="6" fill="#bfe8ff" stroke="#d8d0c0" stroke-width="2"/>`);
      break;
    case 'woods':
      for (let i = 0; i < 9; i++) o.push(pine(cx - 40 + (i % 5) * 20 + (i > 4 ? 10 : 0), cy - 4 + (i > 4 ? 14 : 0), 0.85 + (i % 3) * 0.12, i % 2 ? '#2f7a4a' : '#3f8a5a'));
      break;
    case 'mountains':
      o.push(peak(cx - 18, cy + 4, 1.1), peak(cx + 14, cy - 2, 1.4, '#9a9aa8'), pine(cx + 38, cy + 10, 0.7), `<path d="M${cx + 30} ${cy - 14} q4 10 0 22" stroke="#8fd3ff" stroke-width="3" fill="none"/>`);
      break;
    case 'mine':
      o.push(`<path d="M${cx - 14} ${cy + 8} Q${cx} ${cy - 18} ${cx + 14} ${cy + 8}Z" fill="#2a1e1e"/><rect x="${cx - 16}" y="${cy - 10}" width="4" height="18" fill="#8a5a3a"/><rect x="${cx + 12}" y="${cy - 10}" width="4" height="18" fill="#8a5a3a"/><rect x="${cx - 17}" y="${cy - 12}" width="34" height="4" fill="#8a5a3a"/><circle cx="${cx + 20}" cy="${cy + 6}" r="3" fill="#9ae8ff"/>`);
      break;
    case 'coast':
      o.push(`<path d="M${cx - 10} ${cy + 8} q2 -16 0 -24" stroke="#9a7a5a" stroke-width="3" fill="none"/><path d="M${cx - 10} ${cy - 16} q-14 -2 -18 6 M${cx - 10} ${cy - 16} q14 -4 18 4 M${cx - 10} ${cy - 16} q-4 -10 -12 -10" stroke="#4fb85a" stroke-width="4" fill="none" stroke-linecap="round"/>`,
        `<g transform="translate(${cx + 26} ${cy - 18})"><rect x="-4" y="0" width="8" height="26" fill="#fff"/><rect x="-4" y="6" width="8" height="5" fill="#e85a4a"/><rect x="-4" y="17" width="8" height="5" fill="#e85a4a"/><path d="M-6 0 L0 -8 L6 0Z" fill="#e85a4a"/></g>`, `<path d="M${cx + 2} ${cy + 16} l10 0 l-5 -14Z" fill="#fff"/>`);
      break;
    case 'frosty':
      o.push(peak(cx - 16, cy + 6, 1.2, '#c8d8f0', '#ffffff'), peak(cx + 18, cy, 1.0, '#b8c8e8', '#ffffff'), pine(cx + 36, cy + 12, 0.7, '#5a8a9a'), `<ellipse cx="${cx - 34}" cy="${cy + 12}" rx="9" ry="6" fill="#fff" stroke="#c8d8e8"/>`);
      break;
    case 'ember':
      o.push(`<path d="M${cx - 30} ${cy + 10} L${cx - 8} ${cy - 26} L${cx + 8} ${cy - 26} L${cx + 30} ${cy + 10}Z" fill="#4a3a3a"/><path d="M${cx - 8} ${cy - 26} L${cx + 8} ${cy - 26} L${cx + 4} ${cy - 18} L${cx - 4} ${cy - 18}Z" fill="#ff6a2a"/><path d="M${cx - 2} ${cy - 18} q6 14 -4 28" stroke="#ff8a3a" stroke-width="4" fill="none"/>`,
        `<circle class="map-smoke" cx="${cx}" cy="${cy - 34}" r="7" fill="#d8c8c0" opacity=".7"/><circle class="map-smoke" cx="${cx + 6}" cy="${cy - 44}" r="9" fill="#e8dcd4" opacity=".55" style="animation-delay:-1.5s"/>`);
      break;
    case 'hamlet': {
      // the hamlet grows on the map as villagers move in
      o.push(`<path d="M${cx - 30} ${cy + 10} L${cx - 20} ${cy - 6} L${cx - 10} ${cy + 10}Z" fill="#e8a33a"/>`, `<circle cx="${cx + 2}" cy="${cy + 12}" r="3" fill="#ff9a3a"/>`, tree(cx + 34, cy - 4, 0.8), tree(cx - 40, cy - 8, 0.7, '#5aa84a'));
      const houses = Math.min(5, Math.ceil(hamletPop / 2));
      for (let i = 0; i < houses; i++) o.push(house(cx - 4 + (i % 3) * 16, cy - 6 + Math.floor(i / 3) * 14, 0.8, ['#d8b060', '#5a7aa8', '#b84a3a'][i % 3]));
      break;
    }
  }
  void r;
  return o.join('');
}

function map(ui: UI, unlockedNow?: string, selected?: string): void {
  const g = ui.g;
  const st = g.ctx.state;
  const regions = REGIONS.filter((r) => r.id !== 'house');
  const here = g.regionId === 'house' ? 'farm' : g.regionId;
  const links: [string, string][] = [['farm', 'village'], ['farm', 'woods'], ['farm', 'mountains'], ['mountains', 'mine'], ['mountains', 'frosty'], ['village', 'coast'], ['village', 'ember'], ['farm', 'hamlet']];
  const P = (id: string) => { const m = REGION_BY_ID[id as 'farm'].map; return [m[0] * MAP_W, m[1] * MAP_H] as [number, number]; };
  const R = (id: string) => 62 * (MAP_STYLE[id]?.size ?? 1);
  const sel = selected ?? here;
  const parts: string[] = [];
  parts.push(`<svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="mapsvg" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff8c0" stop-opacity=".9"/><stop offset="1" stop-color="#fff8c0" stop-opacity="0"/></radialGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#2a5a7a" flood-opacity=".28"/></filter>
      <filter id="gray"><feColorMatrix type="saturate" values="0.15"/></filter>
    </defs>
`);
  // trails between islands
  for (const [a, b] of links) {
    const A = P(a), B = P(b);
    const on = st.regions[a as 'farm'].unlocked && st.regions[b as 'farm'].unlocked;
    const mx = (A[0] + B[0]) / 2 + (B[1] - A[1]) * 0.12, my = (A[1] + B[1]) / 2 - (B[0] - A[0]) * 0.12 - 10;
    const d = `M${A[0]} ${A[1]} Q${mx} ${my} ${B[0]} ${B[1]}`;
    parts.push(`<path d="${d}" stroke="${on ? '#8a6a4a' : '#ffffff'}" stroke-opacity="${on ? 0.35 : 0.25}" stroke-width="9" fill="none" stroke-linecap="round"/>`);
    parts.push(`<path d="${d}" stroke="${on ? '#fff8ec' : '#ffffff'}" stroke-opacity="${on ? 1 : 0.5}" stroke-width="4" stroke-dasharray="10 9" fill="none" stroke-linecap="round" class="${on ? 'map-trail' : ''}"/>`);
  }
  // islands
  regions.forEach((r, i) => {
    const [cx, cy] = P(r.id);
    const s = MAP_STYLE[r.id];
    const rad = R(r.id);
    const unlocked = st.regions[r.id].unlocked;
    const isSel = sel === r.id;
    const cls = `map-isle${unlocked ? '' : ' locked'}${unlockedNow === r.id ? ' unlocking' : ''}${isSel ? ' sel' : ''}`;
    parts.push(`<g class="${cls}" data-r="${r.id}" style="transform-origin:${cx}px ${cy}px" ${unlocked ? '' : 'filter="url(#gray)"'}>`);
    if (isSel) parts.push(`<ellipse cx="${cx}" cy="${cy + 6}" rx="${rad * 1.35}" ry="${rad * 0.95}" fill="url(#glow)"/>`);
    parts.push(`<g filter="url(#soft)"><path d="${blobPath(cx, cy + 16, rad, i * 1.7)}" fill="${s.side}"/>`);
    parts.push(`<path d="${blobPath(cx, cy + 9, rad * 0.98, i * 1.7)}" fill="${s.side}" style="filter:brightness(1.25)"/>`);
    parts.push(`<path d="${blobPath(cx, cy, rad, i * 1.7)}" fill="${s.top}"/></g>`);
    parts.push(`<path d="${blobPath(cx - rad * 0.15, cy - rad * 0.12, rad * 0.62, i * 2.1 + 1)}" fill="${s.top2}" opacity=".55"/>`);
    parts.push(islandDeco(s.deco, cx, cy, rad, st.hamlet.villagers.length));
    if (!unlocked) parts.push(`<g class="map-fog"><ellipse cx="${cx - 18}" cy="${cy - 4}" rx="34" ry="20" fill="#fff" opacity=".85"/><ellipse cx="${cx + 20}" cy="${cy + 2}" rx="30" ry="18" fill="#fff" opacity=".8"/><ellipse cx="${cx}" cy="${cy - 16}" rx="26" ry="16" fill="#fff" opacity=".9"/><text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="22">🔒</text></g>`);
    // ribbon label
    const label = unlocked ? r.name : '???';
    const w = Math.max(70, label.length * 9.5 + 24);
    const ly = cy + rad * 0.62 + 26;
    parts.push(`<g class="map-label"><path d="M${cx - w / 2 - 10} ${ly - 8} l10 8 l-10 8 h14 v-16Z" fill="#c8a06a"/><path d="M${cx + w / 2 + 10} ${ly - 8} l-10 8 l10 8 h-14 v-16Z" fill="#c8a06a"/>
      <rect x="${cx - w / 2}" y="${ly - 13}" width="${w}" height="24" rx="6" fill="${isSel ? '#ffd166' : '#fff8ec'}" stroke="#c8a06a" stroke-width="2"/>
      <text x="${cx}" y="${ly + 4}" text-anchor="middle" font-size="15" font-weight="600" fill="#5a4036">${label}</text></g>`);
    if (r.id === here) parts.push(`<g class="map-pin" style="transform-origin:${cx}px ${cy - rad * 0.6}px"><path d="M${cx} ${cy - rad * 0.3} c-14 -16 -16 -22 -16 -30 a16 16 0 0 1 32 0 c0 8 -2 14 -16 30Z" fill="#ff6f91" stroke="#fff" stroke-width="3"/><circle cx="${cx}" cy="${cy - rad * 0.3 - 30}" r="7" fill="#fff"/></g>`);
    parts.push('</g>');
  });
  // drifting clouds, compass & cartouche
  const cloud = (x: number, y: number, s: number, delay: number) => `<g class="map-cloud" style="animation-delay:${delay}s"><g transform="translate(${x} ${y}) scale(${s})" opacity=".85"><ellipse cx="0" cy="0" rx="42" ry="16" fill="#fff"/><ellipse cx="-18" cy="-10" rx="22" ry="16" fill="#fff"/><ellipse cx="14" cy="-14" rx="26" ry="20" fill="#fff"/></g></g>`;
  parts.push(cloud(120, 90, 0.9, 0), cloud(820, 520, 1.1, -14), cloud(560, 40, 0.7, -30), cloud(60, 560, 0.8, -8));
  parts.push(`<g transform="translate(925 72)" class="map-compass"><circle r="38" fill="#fff8ec" stroke="#c8a06a" stroke-width="3"/><path d="M0 -32 L7 0 L0 32 L-7 0Z" fill="#e8665a"/><path d="M0 32 L7 0 L-7 0Z" fill="#5a4036"/><path d="M-32 0 L0 -6 L32 0 L0 6Z" fill="#c8a06a" opacity=".7"/><circle r="4" fill="#fff"/><text y="-42" text-anchor="middle" font-size="14" font-weight="600" fill="#5a4036">N</text></g>`);
  parts.push(`<g transform="translate(24 24)"><rect width="250" height="54" rx="14" fill="#fff8ec" stroke="#c8a06a" stroke-width="3"/><text x="125" y="24" text-anchor="middle" font-size="18" font-weight="600" fill="#5a4036">Vallée de Mossy Meadows</text><text x="125" y="43" text-anchor="middle" font-size="12.5" fill="#8a6e60">${regions.filter((r) => st.regions[r.id].unlocked).length}/${regions.length} régions découvertes</text></g>`);
  parts.push('</svg>');
  const mapEl = h('div.map', { html: parts.join('') });
  // detail card for the selected island
  const r = REGION_BY_ID[sel as 'farm'];
  const unlocked = st.regions[r.id].unlocked;
  const isHere = r.id === here;
  const extra = r.id === 'hamlet' && unlocked ? ` · ${st.hamlet.villagers.length} villageois (${g.ctx.hamlet.levelName()})` : r.id === 'mine' ? ` · record : niveau ${st.mine.deepest}` : '';
  const action = !unlocked ? h('span.muted', null, `🔒 ${r.unlockHint}`)
    : isHere ? h('span.pill', null, '📍 Vous êtes ici')
      : r.id === 'mine' ? h('span.muted', null, '⛏️ Entrée dans les Crystal Mountains')
        : h('button.btn', { onclick: () => { ui.closePanel(); g.travel(r.id); } }, `🧭 Voyager`);
  const card = h('div.map-card', null, h('span.em', null, unlocked ? r.icon : '❔'), h('div.grow', null, h('b', null, unlocked ? r.name : 'Région inconnue'), h('div.muted', null, unlocked ? `${r.desc}${extra}` : 'Un endroit encore mystérieux…')), action);
  ui.showPanel('map', 'Carte de la vallée', [mapEl, card], { size: 'wide' });
  for (const el of mapEl.querySelectorAll('[data-r]')) el.addEventListener('click', () => { g.audio.play('click'); map(ui, undefined, (el as HTMLElement).dataset.r); });
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
function buildingRow(ui: UI, def: { id: string; name: string; icon: string; desc: string; items: [string, number][]; coins: number }, countText: string, aff: { ok: boolean; reason?: string }, extra?: string): HTMLElement {
  const g = ui.g;
  return h('div.item-row', null, h('span.em', null, def.icon), h('div.info', null, h('b', null, `${def.name} ${countText}`), h('span', null, def.desc), extra ? h('div', { style: { color: '#4fb886', fontWeight: '600', fontSize: '13px' } }, extra) : null, costList(ui, def.items, def.coins), !aff.ok && aff.reason && !aff.reason.startsWith('Pas assez') && !aff.reason.startsWith('Matériaux') ? h('span', { style: { color: '#e06a5a' } }, `🔒 ${aff.reason}`) : null),
    h(`button.btn.small${aff.ok ? '' : '.disabled'}`, { onclick: () => { ui.closePanel(); g.enterPlacement(def.id); } }, 'Placer'));
}

function build(ui: UI, tab = 'buildings'): void {
  const g = ui.g;
  const inFarm = g.regionId === 'farm', inHouse = g.regionId === 'house', inHamlet = g.regionId === 'hamlet';
  const render = (): any[] => {
    if (!inFarm && !inHouse && !inHamlet) return [h('p.center', null, '🏡 La construction se fait sur votre ferme, dans votre maison ou au hameau de Clairefontaine (sentier au sud de la ferme).')];
    const editBtn = h('div.row', { style: { marginBottom: '10px', flexWrap: 'wrap' } }, h('button.btn.small.sky', { onclick: () => { ui.closePanel(); g.enterEditMode(); } }, '✋ Déplacer / ranger des objets'),
      inHouse ? h('button.btn.small.lav', { onclick: () => houseDecor(ui) }, '🖌️ Murs & sols') : null,
      inHamlet ? h('button.btn.small.lav', { onclick: () => hamlet(ui) }, '📒 Registre') : null);
    const tip = (t: string) => h('div.tipbox', null, '💡 ', t);
    if (tab === 'buildings' && inHamlet) {
      const hs = g.ctx.hamlet;
      const kinds: [string, string][] = [['home', '🏠 Logements — attirent des villageois'], ['work', '⚒️ Lieux de travail — produisent chaque matin'], ['service', '✨ Services — rendent les villageois heureux']];
      return [editBtn, tip('Placez des logements pour accueillir des villageois, puis des lieux de travail : ils y travaillent seuls et remplissent le coffre du registre chaque matin.'),
        ...kinds.map(([k, title]) => h('div', null, h('h3', null, title), h('div.list', null, ...HAMLET_BUILDINGS.filter((b) => b.kind === k).map((b) => {
          const extra = b.beds ? `🛏️ ${b.beds} lit${b.beds > 1 ? 's' : ''}` : b.jobs ? `👷 ${b.jobs} poste${b.jobs > 1 ? 's' : ''}${b.output?.length ? ' · ' + b.output.map((o) => item(o.id).icon).join('') : ''}${b.coinsPerWorker ? ' · 🪙' : ''}` : `✨ Bonheur +${b.appeal}`;
          return buildingRow(ui, b, `(${hs.count(b.id)}/${b.max})`, g.ctx.building.affordable(b.id), extra);
        }))))];
    }
    if (tab === 'buildings' && inFarm) {
      return [editBtn, h('div.list', null, ...BUILDINGS.filter((b) => b.id !== 'house').map((b) => buildingRow(ui, b, `(${g.ctx.building.count(b.id)}/${b.max})`, g.ctx.building.affordable(b.id))))];
    }
    const owned = Object.entries(g.ctx.state.decorOwned).filter(([id, n]) => n > 0 && (inHouse ? DECOR_BY_ID[id].indoor || ['flowers', 'lights', 'magic', 'colorful', 'winter', 'halloween'].includes(DECOR_BY_ID[id].cat) : !DECOR_BY_ID[id].indoor));
    const saplings = inFarm ? g.ctx.inventory.slots.filter((s) => s && s.id.startsWith('sapling_')) : [];
    return [editBtn,
      inHamlet ? tip('Chaque décoration rend Clairefontaine plus beau : les villageois sont plus heureux et de nouveaux arrivent plus vite.') : null,
      owned.length || saplings.length ? h('div.list', null,
        ...saplings.map((s) => h('div.item-row', null, h('span.em', null, '🌳'), h('div.info', null, h('b', null, item(s!.id).name), h('span', null, `×${s!.qty}`)), h('button.btn.small', { onclick: () => { ui.closePanel(); g.enterPlacement(s!.id); } }, 'Planter'))),
        ...owned.map(([id, n]) => h('div.item-row', null, h('span.em', null, DECOR_BY_ID[id].icon), h('div.info', null, h('b', null, DECOR_BY_ID[id].name), h('span', null, `×${n}`)), h('button.btn.small', { onclick: () => { ui.closePanel(); g.enterPlacement(id); } }, 'Placer'))))
        : h('p.muted.center', null, 'Aucune décoration en stock. Achetez-en chez Mallow, Pippa ou Toma, ou fabriquez-en à l\'atelier.'),
    ];
  };
  const t = inFarm || inHamlet ? tabs([{ id: 'buildings', label: '🏠 Bâtiments' }, { id: 'decor', label: '🌸 Décorations' }], tab, (id) => build(ui, id)) : undefined;
  ui.showPanel('build', inHouse ? 'Décorer la maison' : inHamlet ? 'Construire à Clairefontaine' : 'Construire', render(), { tabs: t });
}

// ====================================================================== hamlet register
const moodOf = (h0: number) => (h0 >= 70 ? '😊' : h0 >= 40 ? '🙂' : '😟');

function hamlet(ui: UI, tab = 'overview'): void {
  const g = ui.g;
  const hs = g.ctx.hamlet;
  const st = g.ctx.state.hamlet;
  const inHamlet = g.regionId === 'hamlet';
  const nameOf = (uid: string | null) => {
    const p = uid ? st.placed.find((q) => q.uid === uid) : null;
    return p ? HAMLET_BY_ID[p.kind]?.name ?? '' : '';
  };
  const render = (): any[] => {
    if (tab === 'overview') {
      const next = hs.nextLevel();
      const pop = hs.population();
      const goal = hs.currentGoal();
      const stat = (icon: string, label: string, value: string) => h('div.stat', null, h('span', { style: { fontSize: '22px' } }, icon), h('div', null, h('b', null, value), h('div.muted', null, label)));
      return [
        h('div.row', { style: { alignItems: 'flex-end' } }, h('div.grow', null, h('h3', { style: { margin: '0' } }, `🏘️ ${st.name} — ${hs.levelName()}`), next ? h('div.muted', null, `Prochain niveau « ${next.name} » à ${next.pop} villageois`) : h('div.muted', null, 'Niveau maximum atteint !')), next ? h('b', null, `${pop}/${next.pop}`) : null),
        next ? h('div.progress', { style: { margin: '6px 0 12px' } }, h('i', { style: { width: `${Math.min(100, (pop / next.pop) * 100)}%` } })) : null,
        h('div.stats', null,
          stat('👥', 'Villageois', `${pop}`), stat('🛏️', 'Lits', `${pop}/${hs.beds()}`), stat('👷', 'Postes', `${st.villagers.filter((v) => v.jobUid).length}/${hs.jobSlots()}`),
          stat(moodOf(hs.avgHappiness()), 'Bonheur', pop ? `${hs.avgHappiness()} %` : '—'), stat('🌸', 'Beauté', `${hs.appeal()}`)),
        goal ? h('div.goalcard', null, h('b', null, `🎯 Objectif : ${goal.text}`), h('div.muted', null, goal.hint)) : h('div.goalcard', null, h('b', null, '🏆 Tous les objectifs sont accomplis !')),
        h('h3', null, '🧺 Coffre du hameau'),
        st.chest.length || st.coins ? h('div', null,
          h('div.grid', null, ...st.chest.map((c) => h('div.slot', null, item(c.id).icon, h('span.q', null, c.qty))), st.coins ? h('div.slot', null, '🪙', h('span.q', null, fmt(st.coins))) : null),
          h('div.center', { style: { marginTop: '10px' } }, h('button.btn.peach', { onclick: () => { const r = hs.collect(); g.audio.play('harvest'); ui.toast(`Récupéré : ${r.items.map((i) => `${item(i.id).icon}${i.qty}`).join(' ')}${r.coins ? ` 🪙${fmt(r.coins)}` : ''}`, '🧺', 'good'); ui.setPanelBody(...render()); } }, '🧺 Tout récupérer')))
          : h('p.muted', null, hs.buildings('work').length ? 'Vide pour le moment : la production arrive chaque matin.' : 'Construisez un lieu de travail : vos villageois y produiront du bois, de la pierre, des récoltes…'),
        h('details.howto', null, h('summary', null, '❓ Comment fonctionne le hameau ?'), h('ul', null,
          h('li', null, '🏠 Chaque logement libre attire un nouveau villageois au lever du jour (si le hameau est heureux).'),
          h('li', null, '⚒️ Les villageois prennent seuls les postes libres. Changez leur métier en leur parlant (💼 Travail).'),
          h('li', null, '🧺 Chaque matin, leur travail remplit ce coffre. Plus ils sont heureux, plus ils produisent.'),
          h('li', null, '😊 Le bonheur vient d\'un logement, d\'un travail, du puits, de la taverne, et de la beauté (décorations, fleurs, lanternes).'),
          h('li', null, '💭 Une bulle au-dessus d\'un villageois = un souhait. Exaucez-le pour des pièces, des gemmes et de l\'amitié.'),
          h('li', null, '🔑 Les matériaux du hameau (poutres, pierre taillée, chaume) se fabriquent à l\'atelier ou sortent de la scierie, de la carrière et des champs.'),
        )),
        inHamlet ? h('div.center', { style: { marginTop: '10px' } }, h('button.btn.small', { onclick: () => build(ui) }, '🔨 Construire')) : h('p.muted.center', null, 'Clairefontaine se trouve au sud de votre ferme.'),
      ];
    }
    if (tab === 'villagers') {
      if (!st.villagers.length) return [h('p.muted.center', null, 'Personne n\'habite encore ici. Construisez une cabane : un voyageur s\'y installera !')];
      return [h('div.list', null, ...st.villagers.map((v) => {
        const tr = VILLAGER_TRAITS[v.trait as TraitId];
        return h('div.item-row', null, h('span.em', null, moodOf(v.happiness)), h('div.info', null,
          h('b', null, `${v.name} ${tr ? tr.icon : ''}`),
          h('span', null, `${tr?.name ?? ''} · ${v.homeUid ? `🏠 ${nameOf(v.homeUid)}` : '🏕️ sans logis'} · ${v.jobUid ? `💼 ${nameOf(v.jobUid)}` : '💤 sans emploi'}`),
          h('span', null, `Bonheur ${v.happiness} % · Amitié ${'❤️'.repeat(Math.round(v.friendship / 20)) || '—'}${v.wish ? ` · 💭 ${item(v.wish.id).icon}×${v.wish.qty}` : ''}`)),
          h('button.btn.small.lav', { onclick: () => villager(ui, v.uid) }, '💼'));
      }))];
    }
    if (tab === 'goals') {
      return [h('div.list', null, ...HAMLET_GOALS.map((gl) => {
        const done = st.goals.includes(gl.id);
        const cur = hs.currentGoal()?.id === gl.id;
        const r = gl.reward;
        const rew = [r.coins ? `🪙 ${r.coins}` : '', r.gems ? `💎 ${r.gems}` : '', ...(r.items ?? []).map(([id, q]) => `${DECOR_BY_ID[id]?.icon ?? item(id).icon}×${q}`)].filter(Boolean).join('  ');
        return h(`div.quest${cur ? '.story' : ''}`, { style: done ? { opacity: '.6' } : {} }, h('h3', null, `${done ? '✓' : cur ? '🎯' : '•'} ${gl.text}`), cur ? h('div.muted', null, gl.hint) : null, h('div.rewards', null, `Récompense : ${rew}`));
      }))];
    }
    return [];
  };
  const t = tabs([{ id: 'overview', label: '📒 Aperçu' }, { id: 'villagers', label: `👥 Villageois (${st.villagers.length})` }, { id: 'goals', label: '🎯 Objectifs' }], tab, (id) => hamlet(ui, id));
  ui.showPanel('hamlet', `Registre de ${st.name}`, render(), { tabs: t });
}

function hamletBuilding(ui: UI, uid: string): void {
  const g = ui.g;
  const hs = g.ctx.hamlet;
  const p = g.ctx.state.hamlet.placed.find((q) => q.uid === uid);
  if (!p) return;
  const def = HAMLET_BY_ID[p.kind];
  const render = (): any[] => {
    const ws = hs.workers(uid);
    const others = g.ctx.state.hamlet.villagers.filter((v) => v.jobUid !== uid);
    const season = g.ctx.state.time.day;
    void season;
    return [
      h('p.muted', null, def.desc),
      def.output?.length ? h('div.detail', null, h('span.em', null, def.icon), h('div', null, h('b', null, 'Production par ouvrier heureux et par jour'), h('div.muted', null, def.output.map((o) => `${item(o.id).icon} ${o.qty}${o.season ? ` (${o.season.map((x) => ({ spring: 'printemps', summer: 'été', autumn: 'automne', winter: 'hiver' } as any)[x]).join('/')})` : ''}`).join(' · ') + (def.coinsPerWorker ? ` · 🪙 ${def.coinsPerWorker}` : '')))) : null,
      h('h3', null, `👷 ${def.job ?? 'Ouvriers'} (${ws.length}/${def.jobs})`),
      ws.length ? h('div.list', null, ...ws.map((v) => h('div.item-row', null, h('span.em', null, moodOf(v.happiness)), h('div.info', null, h('b', null, v.name), h('span', null, `Bonheur ${v.happiness} %`)), h('button.btn.small.ghost', { onclick: () => { hs.setJob(v.uid, null); ui.setPanelBody(...render()); } }, 'Retirer'))))
        : h('p.muted', null, 'Personne ne travaille ici.'),
      ws.length < (def.jobs ?? 0) && others.length ? h('div', null, h('h3', null, 'Embaucher'), h('div.row', { style: { flexWrap: 'wrap' } }, ...others.map((v) => h('button.chip', { onclick: () => { hs.setJob(v.uid, uid); g.audio.play('click'); ui.setPanelBody(...render()); } }, `${v.name}${v.jobUid ? ` (${HAMLET_BY_ID[g.ctx.state.hamlet.placed.find((q) => q.uid === v.jobUid)?.kind ?? '']?.name ?? ''})` : ' 💤'}`)))) : null,
    ];
  };
  ui.showPanel('hamletBuilding', `${def.icon} ${def.name}`, render(), { size: 'narrow' });
}

function villager(ui: UI, uid: string): void {
  const g = ui.g;
  const hs = g.ctx.hamlet;
  const v = hs.villager(uid);
  if (!v) return;
  const render = (): any[] => {
    const tr = VILLAGER_TRAITS[v.trait as TraitId];
    const works = hs.buildings('work');
    const bar = (label: string, val: number) => h('div', null, h('div.muted', null, label), h('div.progress', null, h('i', { style: { width: `${val}%` } })));
    return [
      h('p.muted', null, `${tr?.icon ?? ''} ${tr?.name ?? ''} · arrivé·e le jour ${v.arrivedDay}`),
      bar(`${moodOf(v.happiness)} Bonheur ${v.happiness} % (objectif ${hs.targetHappiness(v)} %)`, v.happiness), bar('❤️ Amitié', v.friendship),
      v.wish ? h('div.detail', null, h('span.em', null, item(v.wish.id).icon), h('div', null, h('b', null, `Souhait : ${v.wish.qty}× ${item(v.wish.id).name}`), h('div.muted', null, `Vous en avez ${g.ctx.inventory.count(v.wish.id)}. Parlez-lui pour lui donner.`))) : null,
      h('h3', null, '💼 Métier'),
      works.length ? h('div.list', null, ...works.map((p) => {
        const def = HAMLET_BY_ID[p.kind];
        const n = hs.workers(p.uid).length;
        const mine = v.jobUid === p.uid;
        return h('div.item-row', null, h('span.em', null, def.icon), h('div.info', null, h('b', null, def.name), h('span', null, `${def.job} · ${n}/${def.jobs}`)),
          mine ? h('button.btn.small.ghost', { onclick: () => { hs.setJob(v.uid, null); ui.setPanelBody(...render()); } }, 'Quitter') : h(`button.btn.small${n < (def.jobs ?? 0) ? '' : '.disabled'}`, { onclick: () => { if (hs.setJob(v.uid, p.uid)) { g.audio.play('click'); ui.toast(`${v.name} devient ${def.job?.toLowerCase()}`, def.icon, 'good'); ui.setPanelBody(...render()); } } }, 'Choisir'));
      })) : h('p.muted', null, 'Aucun lieu de travail. Construisez une scierie, une carrière, des champs…'),
    ];
  };
  ui.showPanel('villager', `${v.name}`, render(), { size: 'narrow' });
}

function villagerGift(ui: UI, uid: string): void {
  const g = ui.g;
  const v = g.ctx.hamlet.villager(uid);
  if (!v) return;
  const tr = VILLAGER_TRAITS[v.trait as TraitId];
  const stacks = g.ctx.inventory.slots.filter((s): s is { id: string; qty: number } => !!s);
  ui.showPanel('villagerGift', `Offrir à ${v.name}`, [
    h('p.muted', null, `${tr?.icon ?? ''} ${tr?.name ?? ''} — adore par exemple : ${tr ? tr.wishes.slice(0, 3).map((i) => item(i).icon).join(' ') : ''}`),
    h('div.grid', null, ...stacks.map((s) => h('button.slot', { onclick: () => {
      const r = g.ctx.hamlet.gift(uid, s.id);
      ui.closePanel();
      if (r.ok) { g.audio.play(r.loved ? 'levelup' : 'pop'); ui.toast(r.loved ? `${v.name} adore ce cadeau ! ❤️❤️` : `${v.name} vous remercie ❤️`, '🎁', 'good'); }
    } }, item(s.id).icon, h('span.q', null, s.qty)))),
  ], { size: 'narrow' });
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
const QUALITY_HELP: Record<Quality, string> = {
  low: 'Pour les petits téléphones : pas d\'ombres, moins d\'herbe et d\'effets. Le plus fluide et le plus économe en batterie.',
  medium: 'Équilibré : ombres douces, herbe et particules modérées. Recommandé pour la plupart des téléphones.',
  high: 'Ombres plus fines, plus d\'herbe, effet miniature (flou de profondeur). Pour les téléphones récents et les tablettes.',
  ultra: 'Tout au maximum : ombres très détaillées et pleine résolution. Pour PC ou téléphones très puissants.',
};
const CONTROL_HELP: Record<ControlMode, string> = {
  both: 'Glissez le pouce gauche pour marcher (joystick qui apparaît sous le doigt) ET touchez un endroit ou un objet pour y aller automatiquement.',
  joystick: 'Uniquement le joystick : toucher l\'écran ne déplace pas le personnage (évite les déplacements involontaires).',
  tap: 'Uniquement toucher-pour-aller : touchez le sol pour marcher, touchez un objet ou un habitant pour interagir. Idéal à une main.',
};

function settings(ui: UI): void {
  const g = ui.g;
  const s = g.settings;
  const st = g.ctx.state;
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => {
    s[k] = v;
    g.saveSettings();
    settings(ui);
  };
  const help = (t: string) => h('div.opt-help', null, t);
  const chips = <T extends string>(list: [T, string][], cur: T, on: (v: T) => void) => h('div.row', { style: { flexWrap: 'wrap' } }, ...list.map(([v, l]) => h(`button.chip${v === cur ? '.on' : ''}`, { onclick: () => on(v) }, l)));
  const toggle = (k: 'leftHanded' | 'haptics' | 'autoQuality' | 'showFps' | 'tips', label: string, text: string) => h('div', null,
    h('div.row', null, h(`button.chip${s[k] ? '.on' : ''}`, { onclick: () => set(k, !s[k]) }, `${s[k] ? '✓' : '○'} ${label}`), h('span.muted', null, s[k] ? 'Activé' : 'Désactivé')),
    help(text));
  const slider = (k: 'music' | 'sfx' | 'ambience', label: string, text: string) => {
    const val = h('span.val', null, `${Math.round(s[k] * 100)} %`);
    return h('div', null,
      h('div.muted', null, label),
      h('div.setting-row', null, h('input.slider', { type: 'range', min: 0, max: 1, step: 0.05, value: s[k], oninput: (e: Event) => { s[k] = +(e.target as HTMLInputElement).value; val.textContent = `${Math.round(s[k] * 100)} %`; g.saveSettings(); } }), val),
      help(text));
  };
  const ta = h('textarea.text', { placeholder: 'Collez un code de sauvegarde ici pour l\'importer…' }) as HTMLTextAreaElement;
  ui.showPanel('settings', 'Menu', [
    h('div.row', { style: { flexWrap: 'wrap', marginBottom: '8px' } },
      h('button.btn.small', { onclick: () => guide(ui) }, '📖 Guide du jeu'),
      h('button.btn.small.peach', { onclick: () => wardrobe(ui) }, '👗 Garde-robe'),
      h('button.btn.small.lav', { onclick: () => pass(ui) }, '🎟️ Cozy Pass'),
      h('button.btn.small.sky', { onclick: () => friends(ui) }, '🙂 Habitants'),
      h('button.btn.small', { onclick: () => shop(ui, 'boutique') }, '🛍️ Boutique'),
      h('button.btn.small.ghost', { onclick: () => festivalsInfo(ui) }, '🎉 Fêtes'),
      h('button.btn.small.ghost', { onclick: () => hamlet(ui) }, '🏘️ Hameau'),
    ),
    h('h3', null, '🎮 Contrôles'),
    chips<ControlMode>([['both', 'Joystick + toucher'], ['joystick', 'Joystick'], ['tap', 'Toucher pour aller']], s.controls, (v) => set('controls', v)),
    help(CONTROL_HELP[s.controls]),
    toggle('leftHanded', '🫲 Mode gaucher', 'Place le bouton d\'action et les outils à gauche de l\'écran (le joystick passe à droite).'),
    toggle('haptics', '📳 Vibrations', 'Petite vibration quand vous coupez, minez ou récoltez (si votre téléphone le permet).'),
    toggle('tips', '💡 Astuces', 'Affiche des conseils la première fois que vous découvrez une fonctionnalité (hameau, construction, nuit…).'),
    s.tips ? null : h('button.btn.small.ghost', { onclick: () => { st.flags.tips = []; ui.toast('Les astuces réapparaîtront', '💡'); } }, '↺ Revoir toutes les astuces'),
    h('h3', null, '📷 Caméra'),
    h('div.row', { style: { flexWrap: 'wrap' } },
      h(`button.chip${g.view === 'iso' ? '.on' : ''}`, { onclick: () => { if (g.view !== 'iso') g.toggleView(); settings(ui); } }, '🏡 Vue d\'ensemble'),
      h(`button.chip${g.view === 'fp' ? '.on' : ''}`, { onclick: () => { if (g.view !== 'fp') g.toggleView(); settings(ui); } }, '👁️ 1ʳᵉ personne'),
      h('button.chip', { onclick: () => g.rotateCamera(Math.PI / 4) }, '⟲ Tourner'),
      h('button.chip', { onclick: () => g.rotateCamera(-Math.PI / 4) }, '⟳ Tourner'),
    ),
    help(g.view === 'fp'
      ? 'Vous voyez par les yeux de votre personnage, mains comprises. Joystick à gauche pour avancer, doigt à droite pour regarder autour (haut/bas aussi) — les deux en même temps. 👁️ en haut à droite pour revenir. Le point au centre vise l\'objet avec lequel interagir.'
      : 'Vue « maquette » au-dessus du personnage. Glissez le doigt sur la droite de l\'écran pour faire tourner la caméra et changer l\'inclinaison, ou utilisez les boutons ci-dessus. Pincez pour zoomer.'),
    h('h3', null, '✨ Qualité graphique'),
    chips<Quality>([['low', 'Basse'], ['medium', 'Moyenne'], ['high', 'Haute'], ['ultra', 'Ultra']], s.quality, (v) => set('quality', v)),
    help(QUALITY_HELP[s.quality]),
    toggle('autoQuality', '⚡ Résolution adaptative', 'Baisse un peu la netteté automatiquement si le jeu ralentit, pour garder un mouvement fluide. Conseillé sur téléphone.'),
    toggle('showFps', '📈 Afficher les FPS', 'Affiche les images par seconde en bas de l\'écran (utile pour choisir la qualité : visez 30 ou plus).'),
    h('h3', null, '🎵 Son'),
    slider('music', '🎼 Musique', 'Les mélodies qui changent selon la région, la météo et l\'heure.'),
    slider('sfx', '🔔 Effets', 'Outils, récoltes, pièces, menus…'),
    slider('ambience', '🌿 Ambiance', 'Vent, rivière, pluie, oiseaux et grillons.'),
    h('h3', null, '💾 Sauvegarde'),
    h('p.muted', null, `${st.player.name} · ${st.player.farmName} · Jour ${st.time.day} · ${Math.floor(st.playSeconds / 60)} min de jeu.`),
    help('Le jeu se sauvegarde tout seul toutes les 40 secondes, chaque matin et quand vous quittez l\'application. « Exporter » crée un code texte à garder précieusement (pour changer de téléphone) ; « Importer » le recharge.'),
    h('div.row', { style: { flexWrap: 'wrap' } },
      h('button.btn.small', { onclick: async () => { const ok = await g.save(); ui.toast(ok ? 'Partie sauvegardée' : 'Échec de la sauvegarde', ok ? '💾' : '⚠️', ok ? 'good' : 'warn'); } }, '💾 Sauvegarder'),
      h('button.btn.small.ghost', { onclick: () => { const code = g.exportSave(); ta.value = code; ta.select(); try { navigator.clipboard?.writeText(code); ui.toast('Code copié', '📋'); } catch { /* ignore */ } } }, '📤 Exporter'),
      h('button.btn.small.ghost', { onclick: async () => { if (await g.importSave(ta.value)) { ui.closePanel(); ui.toast('Sauvegarde importée', '📥', 'good'); } else ui.toast('Code invalide', '⚠️', 'warn'); } }, '📥 Importer'),
    ),
    ta,
    h('div.row', { style: { marginTop: '10px' } }, h('button.btn.small.rose', { onclick: () => ui.confirm('Effacer cette partie et recommencer ? (irréversible)', () => g.resetGame(), 'Effacer') }, '🗑️ Nouvelle partie')),
    help('Efface définitivement la partie en cours. Pensez à exporter votre code avant !'),
    h('p.muted.center', { style: { marginTop: '14px' } }, 'Mossy Meadows v1.3.2 — un jeu cozy original. Aucune romance, juste des amis 🌿'),
  ]);
}

// ====================================================================== game guide
const GUIDE: { id: string; label: string; body: [string, string][] }[] = [
  { id: 'start', label: '🌱 Bien débuter', body: [
    ['🕹️ Se déplacer', 'Glissez le pouce sur la moitié gauche de l\'écran (ou touchez un endroit). Au clavier : ZQSD / WASD / flèches.'],
    ['✋ Le gros bouton', 'Il change selon ce qui est devant vous : parler, récolter, couper, miner, pêcher, entrer… Il choisit même le bon outil tout seul.'],
    ['🛠️ Le petit bouton', 'Utilise l\'outil équipé (houe, arrosoir…). Appui long = roue des outils.'],
    ['📷 La caméra', 'Glissez le doigt sur la droite de l\'écran pour tourner la vue — même en marchant avec le joystick. Le bouton 👁️ en haut à droite passe en vue à la première personne (avec vos mains !). Au clavier : V, [ et ].'],
    ['📜 La quête en haut à gauche', 'Elle vous guide pas à pas. Touchez-la pour voir toutes vos quêtes et réclamer vos récompenses.'],
    ['😴 Pas de stress', 'Rien ne meurt, rien ne se perd. Si vous veillez trop tard, vous vous réveillez simplement chez vous.'],
  ] },
  { id: 'farm', label: '🥕 Ferme', body: [
    ['1. Labourer', 'Équipez la houe et utilisez-la sur l\'herbe de la ferme.'],
    ['2. Planter', 'Le bouton 🌱 choisit la graine ; le gros bouton plante devant vous.'],
    ['3. Arroser', 'Chaque jour (sauf s\'il pleut). Remplissez l\'arrosoir à la rivière.'],
    ['4. Récolter & vendre', 'Récoltez avec le gros bouton, vendez dans la caisse d\'expédition 📦 près de la maison.'],
    ['🐔 Animaux', 'Construisez un poulailler ou une étable (🔨), puis adoptez chez Hazel au village. Nourrissez-les et câlinez-les.'],
  ] },
  { id: 'village', label: '🏘️ Willowbrook', body: [
    ['🏗️ Construire librement', 'Dans 🔨, choisissez un bâtiment puis glissez le doigt n\'importe où : il suit votre geste. Flèches = une case, ⟳ = tourner. Les herbes et cailloux dessous sont ramassés tout seuls. ✋ « Déplacer » pour bouger ce qui est déjà construit.'],
    ['🔨 Restaurer', 'Approchez-vous d\'une ruine et apportez les matériaux demandés : chaque bâtiment débloque une boutique ou une fonction.'],
    ['🍃 Amitié', 'Parlez aux habitants chaque jour et offrez-leur ce qu\'ils aiment. Les amitiés débloquent recettes et cadeaux.'],
    ['📋 Tableau', 'Le tableau des demandes propose des petites missions bien payées.'],
  ] },
  { id: 'hamlet', label: '🏕️ Hameau', body: [
    ['📍 Où ?', 'Prenez le sentier au sud de votre ferme : la clairière de Clairefontaine vous attend.'],
    ['🏠 Logements', 'Chaque cabane, chaumière ou maison attire un villageois au lever du jour (le tout premier arrive tout de suite !).'],
    ['⚒️ Travail', 'Scierie, carrière, champs, pêche, fournil… Vos villageois y travaillent seuls et remplissent le coffre du registre 📒 chaque matin.'],
    ['😊 Bonheur', 'Logement + travail + puits + taverne + décorations = villageois heureux, plus productifs, et de nouveaux arrivants.'],
    ['💭 Souhaits', 'Une bulle au-dessus d\'un villageois ? Apportez-lui ce qu\'il demande pour des pièces, des gemmes et son amitié.'],
    ['🎯 Objectifs', 'Le registre affiche toujours votre prochain objectif, avec une récompense à la clé.'],
  ] },
  { id: 'explore', label: '🧭 Exploration', body: [
    ['🗺️ Carte', 'Bouton 🗺️ : voyagez entre les régions débloquées. Les régions verrouillées indiquent comment les ouvrir.'],
    ['🔍 Créatures', 'Approchez-vous LENTEMENT des petites créatures (sans courir) puis observez-les pour remplir le bestiaire 📖.'],
    ['🎣 Pêche', 'Face à l\'eau, lancez ; quand ❗ apparaît, maintenez le bouton pour garder le poisson dans la zone verte.'],
    ['⛏️ Mines', 'Dans les Crystal Mountains. Cassez les rochers pour trouver l\'échelle vers l\'étage suivant.'],
  ] },
];

function guide(ui: UI, tab = 'start'): void {
  const sec = GUIDE.find((x) => x.id === tab) ?? GUIDE[0];
  const t = tabs(GUIDE.map((x) => ({ id: x.id, label: x.label })), sec.id, (id) => guide(ui, id));
  ui.showPanel('guide', 'Guide du jeu', [h('div.list', null, ...sec.body.map(([title, text]) => h('div.item-row', null, h('div.info', null, h('b', null, title), h('span', null, text)))))], { tabs: t });
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

function daySummary(ui: UI, data: { day: number; earned: number; weather: string; forecast: string; passedOut: boolean; fest?: string; hamlet?: string }): void {
  ui.showPanel('summary', `Jour ${data.day}`, h('div.center', null,
    h('div', { style: { fontSize: '60px' } }, data.passedOut ? '😴' : '🌅'),
    h('p', null, data.passedOut ? 'Vous vous êtes endormi(e) tard... Rien de grave, une bonne nuit et c\'est reparti !' : 'Une nouvelle journée commence à Green Valley.'),
    data.earned ? h('p', null, `Gains d'hier : 🪙 ${fmt(data.earned)}`) : null,
    h('p', null, `Météo du jour : ${data.weather} · Demain : ${data.forecast}`),
    data.fest ? h('p', { style: { fontWeight: '600', color: '#e06a8a' } }, data.fest) : null,
    data.hamlet ? h('div.detail', { style: { textAlign: 'left' } }, h('span.em', null, '🏘️'), h('div', null, h('b', null, 'Production de Clairefontaine'), h('div.muted', null, `${data.hamlet} — à récupérer au registre 📒`))) : null,
    h('button.btn', { style: { marginTop: '10px' }, onclick: () => ui.closePanel() }, 'C\'est parti !'),
  ), { size: 'narrow' });
}

export const PANELS = {
  inventory, quests, collections, map, shop, sell, craft, restore, build, houseDecor, guide, hamlet, hamletBuilding, villager, villagerGift, upgrades, seeds, gift, friends, animal, elevator, pass, wardrobe, settings, festivalsInfo, daySummary,
};
export { BUILDING_BY_ID, DECOR, TOOL_BY_ID };
export type { ToolId };
