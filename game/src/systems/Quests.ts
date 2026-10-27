import type { Ctx } from './Context';
import type { QuestState } from '../state/types';
import { STORY, DAILY_GEN, WEEKLY_GEN, REQUEST_ITEMS, type QuestTemplate, type QuestGen } from '../data/quests';
import { NPC_BY_ID } from '../data/npcs';
import { item } from '../data/items';
import { weekOfDay } from '../data/constants';
import { Random } from '../core/Random';

const TARGET_LABEL: Record<string, string> = {
  harvest: 'Récolter', water: 'Arroser', pet: 'Caresser des animaux', catch: 'Pêcher des poissons', forage: 'Cueillir',
  collect: 'Ramasser', sell: 'Vendre', talk: 'Discuter avec des habitants', cook: 'Cuisiner', catch_bug: 'Attraper des insectes',
  collect_product: 'Récolter des produits animaux', discover_any: 'Observer des créatures', craft: 'Fabriquer', deliver: 'Livrer',
};

export function objectiveText(o: { type: string; target?: string; count: number }): string {
  const t = o.target && o.target !== '*' ? o.target : '';
  switch (o.type) {
    case 'talk': return t ? `Parler à ${NPC_BY_ID[t]?.name ?? t}` : `Discuter avec ${o.count} habitants`;
    case 'till': return `Préparer ${o.count} parcelles`;
    case 'plant': return `Planter ${o.count} graines`;
    case 'water': return `Arroser ${o.count} fois`;
    case 'visit': return `Visiter ${t}`;
    case 'restore': return `Restaurer : ${t}`;
    case 'build': return `Construire : ${t}`;
    case 'adopt': return `Adopter : ${t}`;
    case 'upgrade': return `Améliorer l'outil : ${t}`;
    case 'repair': return 'Réparer la maison (20 bois, 10 pierres)';
    case 'break_boulder': return 'Briser le rocher du col';
    case 'mine_depth': return `Atteindre le niveau ${o.count} de la mine`;
    case 'discover': return `Découvrir ${o.count} nouvelles créatures`;
    case 'deliver': return `Livrer ${o.count}× ${item(t).name}`;
    default: return `${TARGET_LABEL[o.type] ?? o.type}${t ? ` : ${item(t).name}` : ''} (${o.count})`;
  }
}

export class QuestSystem {
  constructor(private ctx: Ctx) {}

  get active(): QuestState[] {
    return this.ctx.state.quests.active;
  }

  init(): void {
    this.ensureStory();
  }

  private fromTemplate(t: QuestTemplate): QuestState {
    return {
      id: t.id, kind: t.kind, title: t.title, desc: t.desc, giver: t.giver,
      objectives: t.objectives.map((o) => ({ ...o, progress: 0 })),
      rewards: JSON.parse(JSON.stringify(t.rewards)), done: false, claimed: false,
    };
  }

  /** Make sure the current story quest is active. */
  ensureStory(): void {
    const q = this.ctx.state.quests;
    if (q.storyStep >= STORY.length) return;
    const t = STORY[q.storyStep];
    if (!q.active.some((a) => a.id === t.id) && !q.completedIds.includes(t.id)) {
      const qs = this.fromTemplate(t);
      q.active.unshift(qs);
      this.syncStateObjectives(qs);
      this.ctx.bus.emit('quest:new', { id: qs.id, title: qs.title, story: true });
    }
  }

  /** Some objectives depend on state rather than events (mine depth, restored, already built...). */
  syncStateObjectives(q: QuestState): void {
    const st = this.ctx.state;
    for (const o of q.objectives) {
      if (o.type === 'mine_depth') o.progress = Math.min(o.count, st.mine.deepest);
      if (o.type === 'repair' && o.target === 'house' && !st.flags.houseRuined) o.progress = o.count;
      if (o.type === 'restore' && o.target && st.village[o.target]?.restored) o.progress = o.count;
      if (o.type === 'visit' && o.target && st.regions[o.target as keyof typeof st.regions]?.visited && o.target !== 'farm') o.progress = o.count;
      if (o.type === 'build' && o.target && st.farm.placed.some((p) => p.kind === o.target)) o.progress = o.count;
      if (o.type === 'adopt' && o.target && st.animals.some((a) => a.species === o.target)) o.progress = o.count;
      if (o.type === 'upgrade' && o.target && (st.player.tools as any)[o.target] >= 1) o.progress = o.count;
      if (o.type === 'craft' && o.target === 'warm_coat' && st.player.hasCoat) o.progress = o.count;
      if (o.type === 'deliver' && o.target) o.progress = Math.min(o.count, this.ctx.inventory?.count(o.target) ?? 0);
    }
    this.checkDone(q);
  }

  onProgress(type: string, target: string, amount: number): void {
    for (const q of this.active) {
      if (q.done) continue;
      let changed = false;
      for (const o of q.objectives) {
        if (o.progress >= o.count) continue;
        const matchType = o.type === type || (o.type === 'discover_any' && type === 'discover_any');
        if (!matchType) continue;
        if (o.target && o.target !== '*' && o.target !== target) continue;
        o.progress = Math.min(o.count, o.progress + amount);
        changed = true;
      }
      if (type === 'collect' || type === 'mine_floor' || type === 'restore' || type === 'build' || type === 'adopt' || type === 'upgrade' || type === 'visit') {
        this.syncStateObjectives(q);
        changed = true;
      }
      if (changed) {
        this.checkDone(q);
        this.ctx.bus.emit('quests:changed');
      }
    }
  }

  private checkDone(q: QuestState): void {
    if (q.done) return;
    if (q.objectives.every((o) => o.progress >= o.count && o.type !== 'deliver')) {
      q.done = true;
      this.ctx.bus.emit('quest:done', { id: q.id, title: q.title });
    }
  }

  /** Deliver items for 'deliver' objectives. */
  deliver(qid: string): boolean {
    const q = this.active.find((a) => a.id === qid);
    if (!q || q.done) return false;
    const dels = q.objectives.filter((o) => o.type === 'deliver');
    if (!dels.length) return false;
    if (!dels.every((o) => this.ctx.inventory.has(o.target!, o.count))) return false;
    for (const o of dels) {
      this.ctx.inventory.remove(o.target!, o.count);
      o.progress = o.count;
    }
    if (q.objectives.every((o) => o.progress >= o.count)) {
      q.done = true;
      this.ctx.bus.emit('quest:done', { id: q.id, title: q.title });
    }
    this.ctx.bus.emit('quests:changed');
    return true;
  }

  canDeliver(q: QuestState): boolean {
    const dels = q.objectives.filter((o) => o.type === 'deliver');
    return dels.length > 0 && !q.done && dels.every((o) => this.ctx.inventory.has(o.target!, o.count));
  }

  claim(qid: string): boolean {
    const st = this.ctx.state;
    const q = this.active.find((a) => a.id === qid);
    if (!q || !q.done || q.claimed) return false;
    q.claimed = true;
    const r = q.rewards;
    if (r.coins) this.ctx.economy.addCoins(r.coins);
    if (r.gems) this.ctx.economy.addGems(r.gems);
    if (r.xp) this.ctx.economy.addXp(r.xp);
    for (const it of r.items ?? []) this.ctx.inventory.add(it.id, it.qty, true);
    if (r.friendship) this.ctx.npcs.addFriendship(r.friendship.npc, r.friendship.amount);
    st.quests.active = this.active.filter((a) => a !== q);
    st.quests.completedIds.push(q.id);
    this.ctx.progress('quest', q.kind);
    if (q.kind === 'story') {
      const t = STORY.find((s) => s.id === q.id);
      if (t?.effect) this.applyEffect(t.effect);
      st.quests.storyStep++;
      this.ensureStory();
    }
    this.ctx.bus.emit('quest:claimed', { id: q.id, title: q.title });
    this.ctx.bus.emit('quests:changed');
    return true;
  }

  applyEffect(effect: string): void {
    const st = this.ctx.state;
    const unlock = (r: keyof typeof st.regions) => {
      if (!st.regions[r].unlocked) {
        st.regions[r].unlocked = true;
        this.ctx.bus.emit('region:unlocked', { id: r });
      }
    };
    switch (effect) {
      case 'unlock_woods': unlock('woods'); break;
      case 'unlock_mountains': unlock('mountains'); unlock('mine'); break;
      case 'unlock_coast': unlock('coast'); break;
      case 'unlock_frosty': unlock('frosty'); break;
      case 'unlock_ember': unlock('ember'); break;
      case 'finale': this.ctx.bus.emit('finale'); break;
    }
  }

  // ------- generated quests -------
  private gen(g: QuestGen, id: string, r: Random): QuestState {
    const target = r.pick(g.targets);
    const count = r.int(g.count[0], g.count[1]);
    const coins = Math.round(g.coins * count / 5) * 5;
    return {
      id, kind: g.kind, title: g.title, desc: objectiveText({ type: g.type, target, count }),
      objectives: [{ type: g.type, target, count, progress: 0 }],
      rewards: { coins, xp: Math.round(coins / 4), gems: g.kind === 'weekly' ? 5 : 0 }, done: false, claimed: false,
    };
  }

  /** Called on each new day (and on load) to refresh dailies, weeklies and the request board. */
  refresh(): void {
    const st = this.ctx.state;
    const q = st.quests;
    const day = st.time.day;
    const r = new Random((st.seed ^ (day * 2654435761)) >>> 0);
    if (q.dailyDay !== day) {
      q.active = q.active.filter((a) => !(a.kind !== 'story' && a.kind !== 'weekly' && a.id.startsWith('d') && !a.done));
      const pool = DAILY_GEN.filter((g) => !g.minLevel || st.player.level >= g.minLevel);
      r.shuffle(pool);
      for (let i = 0; i < 3; i++) q.active.push(this.gen(pool[i], `d${day}_${i}`, r));
      q.dailyDay = day;
    }
    const week = weekOfDay(day);
    if (q.weeklyWeek !== week) {
      q.active = q.active.filter((a) => !(a.kind === 'weekly' && !a.done));
      const pool = [...WEEKLY_GEN];
      r.shuffle(pool);
      for (let i = 0; i < 2; i++) q.active.push(this.gen(pool[i], `w${week}_${i}`, r));
      q.weeklyWeek = week;
    }
    if (q.boardDay !== day) {
      q.active = q.active.filter((a) => !(a.kind === 'village' && a.id.startsWith('b') && !a.done));
      const npcs = Object.keys(REQUEST_ITEMS).filter((n) => st.npcs[n]?.met || n === 'moss' || n === 'mallow');
      r.shuffle(npcs);
      const n = st.village.houses?.restored ? 4 : st.village.shop?.restored ? 3 : 2;
      for (let i = 0; i < Math.min(n, npcs.length); i++) {
        const npc = npcs[i];
        const it = r.pick(REQUEST_ITEMS[npc]);
        const count = r.int(1, item(it).sell > 80 ? 2 : 5);
        const coins = Math.round((item(it).sell * count * 1.8 + 40) / 5) * 5;
        q.active.push({
          id: `b${day}_${i}`, kind: 'village', giver: npc,
          title: `Demande de ${NPC_BY_ID[npc].name}`,
          desc: `${NPC_BY_ID[npc].name} aimerait ${count}× ${item(it).name}.`,
          objectives: [{ type: 'deliver', target: it, count, progress: 0 }],
          rewards: { coins, xp: 20, friendship: { npc, amount: 40 } }, done: false, claimed: false,
        });
      }
      q.boardDay = day;
    }
    for (const a of q.active) this.syncStateObjectives(a);
    this.ensureStory();
    this.ctx.bus.emit('quests:changed');
  }

  get story(): QuestState | undefined {
    return this.active.find((a) => a.kind === 'story');
  }

  claimableCount(): number {
    return this.active.filter((a) => a.done && !a.claimed).length;
  }
}
