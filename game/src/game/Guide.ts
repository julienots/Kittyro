import * as THREE from 'three';
import type { Ctx } from '../systems/Context';
import type { World } from '../world/World';
import type { EntityManager } from '../entities/Agents';
import type { Player } from '../entities/Player';
import type { QuestObjective, QuestState, RegionId, ToolId } from '../state/types';
import { NODE_KINDS } from '../data/nodes';
import { NPC_BY_ID } from '../data/npcs';
import { REGION_BY_ID } from '../data/regions';
import { VILLAGE_BY_ID } from '../data/village';
import { item } from '../data/items';
import { FARM } from '../state/newGame';
import { objectiveText } from '../systems/Quests';

/**
 * Quest guidance: works out where the tracked objective is (even several regions
 * away), shows a bouncing arrow over it in the world and an arrow at the screen
 * edge, and gives a plain-language hint ("what do I do now?").
 */

export interface GuideInfo {
  quest: QuestState;
  objective: QuestObjective | null;
  /** short "what to do" line */
  hint: string;
  /** world target in the current region, if any */
  target: { x: number; z: number } | null;
  /** label for the target ("Moss", "Vers Willowbrook"...) */
  targetLabel: string;
  /** HUD element to highlight (CSS selector) */
  highlight: string | null;
  distance: number;
}

/** Which regions connect to which (doors, trails, mine entrance). */
const LINKS: Record<RegionId, RegionId[]> = {
  farm: ['village', 'woods', 'mountains', 'hamlet', 'house'],
  village: ['farm', 'coast', 'ember'],
  woods: ['farm'],
  mountains: ['farm', 'frosty', 'mine'],
  coast: ['village'],
  frosty: ['mountains'],
  ember: ['village'],
  hamlet: ['farm'],
  house: ['farm'],
  mine: ['mountains'],
};

function nextHop(from: RegionId, to: RegionId): RegionId | null {
  if (from === to) return null;
  const prev = new Map<RegionId, RegionId>();
  const q: RegionId[] = [from];
  const seen = new Set<RegionId>([from]);
  while (q.length) {
    const r = q.shift()!;
    for (const n of LINKS[r] ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      prev.set(n, r);
      if (n === to) {
        let cur: RegionId = n;
        while (prev.get(cur) !== from) cur = prev.get(cur)!;
        return cur;
      }
      q.push(n);
    }
  }
  return null;
}

const COLLECT_TOOL: Record<string, ToolId> = { wood: 'axe', hardwood: 'axe', sap: 'axe', stone: 'pickaxe', coal: 'pickaxe', copper_ore: 'pickaxe', iron_ore: 'pickaxe', crystal_shard: 'pickaxe', fiber: 'sickle', hay: 'sickle' };
const TOOL_WORD: Record<string, string> = { axe: 'la hache 🪓', pickaxe: 'la pioche ⛏️', sickle: 'la faucille', hoe: 'la houe', can: 'l\'arrosoir 💧', rod: 'la canne à pêche 🎣' };

interface Goal {
  region: RegionId | null;
  pos?: { x: number; z: number } | null;
  label?: string;
  hint: string;
  highlight?: string | null;
}

export class Guide {
  readonly group = new THREE.Group();
  private arrow: THREE.Group;
  private ring: THREE.Mesh;
  private t = 0;
  info: GuideInfo | null = null;
  private calcT = 0;

  constructor(private ctx: Ctx, private world: () => World, private entities: () => EntityManager, private player: () => Player) {
    // golden arrow pointing down + pulsing ground ring
    this.arrow = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc83a, depthTest: false, transparent: true, opacity: 0.95 });
    const edge = new THREE.MeshBasicMaterial({ color: 0x8a5a10, depthTest: false, transparent: true, opacity: 0.9, side: THREE.BackSide });
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 4).rotateX(Math.PI), mat);
    head.position.y = 0.25;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.2), mat);
    shaft.position.y = 0.7;
    const headO = new THREE.Mesh(head.geometry, edge);
    headO.position.copy(head.position);
    headO.scale.setScalar(1.18);
    const shaftO = new THREE.Mesh(shaft.geometry, edge);
    shaftO.position.copy(shaft.position);
    shaftO.scale.setScalar(1.22);
    for (const m of [headO, shaftO, head, shaft]) m.renderOrder = 30;
    this.arrow.add(headO, shaftO, head, shaft);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.7, depthWrite: false }));
    this.ring.renderOrder = 5;
    this.group.add(this.arrow, this.ring);
    this.group.visible = false;
  }

  /** The quest the player follows: chosen one, else the story, else the first unfinished. */
  tracked(): QuestState | null {
    const st = this.ctx.state;
    const act = this.ctx.quests.active;
    const id = st.flags.trackedQuest as string | undefined;
    return act.find((q) => q.id === id && !q.claimed) ?? act.find((q) => q.kind === 'story' && !q.claimed) ?? act.find((q) => !q.done) ?? null;
  }

  track(id: string | null): void {
    this.ctx.state.flags.trackedQuest = id;
    this.calcT = 0;
  }

  // ------------------------------------------------------------------ goals
  private npcGoal(npcId: string, verb = 'Parlez à'): Goal {
    const def = NPC_BY_ID[npcId];
    const ents = this.entities();
    const ag = ents.npc(npcId);
    if (ag) return { region: this.world().region, pos: { x: ag.pos.x, z: ag.pos.z }, label: def?.name ?? npcId, hint: `${verb} ${def?.name ?? npcId} (suivez la flèche jaune) puis touchez 💬.` };
    const loc = def ? ents.npcLocation(def) : null;
    if (!loc) return { region: null, hint: `${verb} ${def?.name ?? npcId}.` };
    const anchor = loc.region === this.world().region ? this.world().layout.anchors[loc.anchor] : null;
    return { region: loc.region as RegionId, pos: anchor ?? null, label: def.name, hint: `${verb} ${def.name}${loc.region !== this.world().region ? ` (à ${REGION_BY_ID[loc.region as RegionId]?.name ?? loc.region})` : ''}.` };
  }

  private nearestNode(tool: ToolId | 'hand'): { x: number; z: number } | null {
    const p = this.player().pos;
    let best: { x: number; z: number } | null = null;
    let bd = Infinity;
    for (const nv of this.world().nodes) {
      if (nv.growth < 1) continue;
      const k = NODE_KINDS[nv.node.kind];
      if (!k || k.tool !== tool || k.minTier > (this.ctx.state.player.tools[tool as ToolId] ?? 0) || nv.node.kind === 'boulder') continue;
      const d = (nv.node.x - p.x) ** 2 + (nv.node.z - p.z) ** 2;
      if (d < bd) { bd = d; best = { x: nv.node.x, z: nv.node.z }; }
    }
    return best;
  }

  private nearestPlot(pred: (p: { x: number; z: number; watered: boolean; crop: any }) => boolean): { x: number; z: number } | null {
    const p = this.player().pos;
    let best: { x: number; z: number } | null = null;
    let bd = Infinity;
    for (const pl of Object.values(this.ctx.state.farm.plots)) {
      if (!pred(pl)) continue;
      const d = (pl.x + 0.5 - p.x) ** 2 + (pl.z + 0.5 - p.z) ** 2;
      if (d < bd) { bd = d; best = { x: pl.x + 0.5, z: pl.z + 0.5 }; }
    }
    return best;
  }

  private toolHint(tool: ToolId, action: string): { hint: string; highlight: string | null } {
    const has = this.ctx.state.player.activeTool === tool;
    return has
      ? { hint: action, highlight: '.act-btn' }
      : { hint: `Prenez ${TOOL_WORD[tool]} : touchez le bouton outil (appui long = roue des outils). ${action}`, highlight: '.tool-btn' };
  }

  private goalFor(q: QuestState, o: QuestObjective): Goal {
    const st = this.ctx.state;
    const t = o.target && o.target !== '*' ? o.target : '';
    const here = this.world().region;
    switch (o.type) {
      case 'talk':
        if (t) return this.npcGoal(t);
        return { region: 'village', pos: here === 'village' ? this.world().layout.anchors.plaza : null, label: 'Habitants', hint: 'Allez discuter avec les habitants de Willowbrook (touchez 💬 près d\'eux).' };
      case 'repair': {
        const wood = this.ctx.inventory.count('wood'), stone = this.ctx.inventory.count('stone');
        if (wood < 20) return { region: here === 'farm' || this.nearestNode('axe') ? here : 'farm', pos: this.nearestNode('axe'), label: 'Arbre', hint: `Il vous faut 20 bois (vous en avez ${wood}). Approchez-vous d'un arbre et touchez le gros bouton 🪓 Couper.`, highlight: '.act-btn' };
        if (stone < 10) return { region: here === 'farm' || this.nearestNode('pickaxe') ? here : 'farm', pos: this.nearestNode('pickaxe'), label: 'Pierre', hint: `Il vous faut 10 pierres (vous en avez ${stone}). Approchez-vous d'une pierre grise et touchez ⛏️ Miner.`, highlight: '.act-btn' };
        return { region: 'farm', pos: here === 'farm' ? this.world().layout.anchors.house_entry : null, label: 'Votre maison', hint: 'Vous avez tout ! Allez devant la porte de la maison et touchez 🔨 Réparer.', highlight: '.act-btn' };
      }
      case 'till': {
        const th = this.toolHint('hoe', 'Placez-vous sur l\'herbe près de la maison et touchez le bouton outil pour labourer.');
        return { region: 'farm', pos: here === 'farm' ? { x: 21.5, z: 21.5 } : null, label: 'Champ', ...th };
      }
      case 'plant': {
        const plot = this.nearestPlot((p) => !p.crop);
        return { region: 'farm', pos: here === 'farm' ? plot : null, label: 'Terre labourée', hint: 'Mettez-vous face à une parcelle labourée et touchez 🌱 Planter. Le bouton graine choisit quoi semer.', highlight: '.act-btn' };
      }
      case 'water': {
        const plot = this.nearestPlot((p) => !!p.crop && !p.watered);
        const th = this.toolHint('can', 'Face à une plante, touchez 💧 pour l\'arroser. Arrosoir vide ? Remplissez-le face à l\'eau.');
        return { region: 'farm', pos: here === 'farm' ? plot : null, label: 'Semis', ...th };
      }
      case 'harvest': {
        const ready = this.nearestPlot((p) => !!p.crop?.ready);
        if (ready) return { region: 'farm', pos: here === 'farm' ? ready : null, label: 'Prêt !', hint: 'Une plante est prête : face à elle, touchez le gros bouton pour récolter.', highlight: '.act-btn' };
        const dry = this.nearestPlot((p) => !!p.crop && !p.watered);
        if (dry) return { region: 'farm', pos: here === 'farm' ? dry : null, label: 'À arroser', hint: 'Vos plantes poussent si elles sont arrosées chaque jour. Arrosez-les, puis dormez : demain elles auront grandi.' };
        const any = Object.values(st.farm.plots).some((p) => p.crop);
        if (any) return { region: 'house', pos: here === 'house' ? this.world().layout.anchors.bed : null, label: 'Lit', hint: 'Tout est arrosé ! Les plantes poussent pendant la nuit : allez dormir dans votre lit 🛏️.' };
        return { region: 'farm', pos: null, hint: 'Plantez des graines (bouton 🌱) sur la terre labourée, arrosez, puis récoltez.' };
      }
      case 'visit':
        return { region: (t || 'village') as RegionId, pos: null, label: REGION_BY_ID[t as RegionId]?.name ?? t, hint: `Rendez-vous à ${REGION_BY_ID[t as RegionId]?.name ?? t} : suivez la flèche jusqu'au bord de la carte.` };
      case 'sell':
        if (here === 'village') return this.npcGoal('mallow', 'Vendez vos récoltes à');
        return { region: 'farm', pos: here === 'farm' ? { x: FARM.shippingBin.x + 0.5, z: FARM.shippingBin.z + 0.5 } : null, label: 'Caisse d\'expédition', hint: 'Mettez vos récoltes dans la caisse d\'expédition 📦 : elles sont payées chaque matin.', highlight: '.act-btn' };
      case 'collect': {
        const tool = COLLECT_TOOL[t];
        if (tool) {
          const n = this.nearestNode(tool);
          return { region: n ? here : 'farm', pos: n, label: item(t).name, hint: `Ramassez ${item(t).name} : approchez-vous et touchez le gros bouton (l'outil se choisit tout seul).`, highlight: '.act-btn' };
        }
        return { region: null, hint: objectiveText(o) };
      }
      case 'restore': {
        const def = VILLAGE_BY_ID[t];
        const pos = here === 'village' ? this.world().layout.anchors[`${t}_front`] ?? null : null;
        return { region: 'village', pos, label: def?.name ?? t, hint: `Au village, approchez-vous de « ${def?.name ?? t} » et touchez 🔨 Restaurer. Les matériaux manquants sont indiqués.` };
      }
      case 'build':
        return { region: t.startsWith('h_') ? 'hamlet' : 'farm', pos: null, hint: 'Ouvrez 🔨 Construire, choisissez le bâtiment et faites-le glisser sur la ferme. ✓ pour valider.', highlight: '.hb-build' };
      case 'adopt':
        return this.npcGoal('hazel', 'Adoptez un animal auprès de');
      case 'upgrade':
        return this.npcGoal('toma', 'Faites améliorer votre outil par');
      case 'deliver': {
        if (q.kind === 'story' && t === 'plank') {
          const have = this.ctx.inventory.count('plank');
          if (have < o.count) return { region: 'farm', pos: null, hint: `Il faut ${o.count} planches (vous en avez ${have}). Fabriquez-les à l'établi (3 bois = 2 planches) : 🔨 Construire → Atelier, puis touchez l'établi.`, highlight: '.hb-build' };
          return { region: 'farm', pos: here === 'farm' ? { x: 10, z: 7.6 } : null, label: 'Vieux pont', hint: 'Apportez les planches au vieux pont cassé, au nord-ouest de la ferme.' };
        }
        if (q.giver) {
          const have = this.ctx.inventory.count(t);
          if (have < o.count) return { region: null, hint: `Trouvez ${o.count}× ${item(t).name} ${item(t).icon} (vous en avez ${have}).` };
          return this.npcGoal(q.giver, 'Livrez la commande à');
        }
        return { region: null, hint: objectiveText(o) };
      }
      case 'break_boulder':
        return { region: 'farm', pos: here === 'farm' ? { x: 30.5, z: 7.2 } : null, label: 'Rocher', hint: 'Avec une pioche en cuivre, brisez le gros rocher sur le chemin du nord.' };
      case 'mine_depth':
        return { region: 'mine', pos: null, label: 'Mine', hint: 'Dans la mine, cassez les rochers : l\'un d\'eux cache l\'échelle 🪜 vers l\'étage suivant.' };
      case 'discover':
      case 'discover_any':
        return { region: here === 'farm' || here === 'village' || here === 'house' ? (st.regions.woods.unlocked ? 'woods' : 'farm') : here, pos: null, hint: 'Les créatures se cachent dans la nature : approchez-vous lentement et touchez 🔍 Observer.' };
      case 'catch':
        return { region: null, hint: 'Face à l\'eau, touchez 🎣 Pêcher. Quand ça mord (❗), touchez le gros bouton !' };
      case 'catch_bug':
        return { region: null, hint: 'Les insectes volettent dans l\'herbe et les fleurs : approchez et touchez 🫙 Attraper.' };
      case 'pet': {
        const a = this.entities().animals[0];
        return { region: 'farm', pos: here === 'farm' && a ? { x: a.pos.x, z: a.pos.z } : null, label: a?.data.name ?? 'Animaux', hint: 'Câlinez vos animaux chaque jour : ils produisent mieux quand ils sont heureux.' };
      }
      case 'craft':
        return { region: null, hint: t === 'warm_coat' ? 'Fabriquez le manteau chaud à l\'établi (tissu, laine et corde).' : 'Fabriquez des objets à l\'établi ou dans le sac (🎒 → Fabriquer).' };
      case 'cook':
        return { region: 'house', pos: null, hint: 'Cuisinez à la cuisinière de votre maison 🍳.' };
      case 'forage':
        return { region: null, hint: 'Ramassez les plantes sauvages qui brillent au sol (touchez ✋).' };
      default:
        return { region: null, hint: objectiveText(o) };
    }
  }

  /** NPC the objective sends the player to (for the "!" marker). */
  npcFor(q: QuestState, o: QuestObjective): string | null {
    if (o.type === 'talk' && o.target && o.target !== '*') return o.target;
    if (o.type === 'adopt') return 'hazel';
    if (o.type === 'upgrade') return 'toma';
    if (o.type === 'deliver' && q.giver && q.kind !== 'story' && this.ctx.inventory.count(o.target ?? '') >= o.count) return q.giver;
    return null;
  }

  // ------------------------------------------------------------------ per frame
  compute(): GuideInfo | null {
    const q = this.tracked();
    if (!q) return null;
    const here = this.world().region;
    if (q.done) {
      return { quest: q, objective: null, hint: 'Quête terminée ! Touchez-la pour recevoir la récompense 🎁.', target: null, targetLabel: '', highlight: '.tracker', distance: 0 };
    }
    const o = q.objectives.find((x) => x.progress < x.count) ?? q.objectives[0];
    const g = this.goalFor(q, o);
    let target = g.pos ?? null;
    let label = g.label ?? '';
    let hint = g.hint;
    if (g.region && g.region !== here) {
      const hop = nextHop(here, g.region);
      const L = this.world().layout;
      target = null;
      if (hop) {
        if (here === 'farm' && hop === 'house') target = L.anchors.house_entry;
        else if (here === 'house') target = L.anchors.door;
        else if (here === 'mountains' && hop === 'mine') target = L.anchors.mine_door;
        else if (here === 'mine') target = L.anchors.ladder_up;
        else {
          const p = L.portals.find((pp) => pp.to === hop);
          if (p) target = { x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 };
        }
        label = hop === 'house' ? 'Maison' : `Vers ${REGION_BY_ID[hop]?.name ?? hop}`;
        if (g.region !== hop && hop !== 'house') hint = `${hint} — Chemin : passez par ${REGION_BY_ID[hop]?.name ?? hop}.`;
      }
    }
    const p = this.player().pos;
    const distance = target ? Math.hypot(target.x - p.x, target.z - p.z) : 0;
    let highlight = g.highlight ?? null;
    if (highlight === '.act-btn' && target && distance > 2.6) highlight = null;
    return { quest: q, objective: o, hint, target, targetLabel: label, highlight, distance };
  }

  update(dt: number, show: boolean): GuideInfo | null {
    this.t += dt;
    this.calcT -= dt;
    if (this.calcT <= 0) {
      this.calcT = 0.3;
      this.info = this.compute();
    }
    const info = this.info;
    const vis = show && !!info?.target && (info?.distance ?? 0) > 1.2 && this.ctx.state.flags.guideArrow !== false;
    this.group.visible = vis;
    if (vis && info?.target) {
      const w = this.world();
      const y = w.heightAt(info.target.x, info.target.z);
      this.arrow.position.set(info.target.x, y + 2.9 + Math.sin(this.t * 3.2) * 0.18, info.target.z);
      this.arrow.rotation.y = this.t * 1.6;
      this.ring.position.set(info.target.x, y + 0.06, info.target.z);
      const k = (this.t * 0.8) % 1;
      this.ring.scale.setScalar(0.7 + k * 0.6);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k);
    }
    return info;
  }
}
