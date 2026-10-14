import type { Ctx } from './Context';
import type { Appearance, PlacedObject, VillagerState } from '../state/types';
import { HAMLET_BY_ID, HAMLET_LEVELS, HAMLET_GOALS, VILLAGER_TRAITS, TRAIT_IDS, VILLAGER_NAMES, VILLAGER_LINES, TRAIT_LINES, type TraitId, type HamletGoal } from '../data/hamlet';
import { DECOR_BY_ID } from '../data/decor';
import { item, ITEMS } from '../data/items';
import { CLOTH_COLORS } from '../data/wardrobe';
import { seasonOfDay } from '../data/constants';
import { newUid } from './Building';

const TOPS = ['tee', 'overalls', 'hoodie', 'vest', 'dress', 'apron', 'sweater', 'explorer'];
const BOTTOMS = ['pants', 'shorts', 'skirt', 'cargo'];
const SHOES = ['boots', 'sneakers', 'flats', 'rainboots'];
const HATS = ['none', 'none', 'none', 'straw', 'cap', 'beanie', 'flower', 'bandana', 'chef'];
const ACCS = ['none', 'none', 'none', 'glasses', 'scarf', 'flower_pin', 'backpack'];

/**
 * Hamlet logic: homes, jobs, happiness, daily production, villager arrivals,
 * wishes and the guided goals. Pure logic (runs headless in tests).
 */
export class HamletSystem {
  constructor(private ctx: Ctx) {}

  get st() {
    return this.ctx.state.hamlet;
  }

  // ---------------------------------------------------------------- queries
  buildings(kind?: 'home' | 'work' | 'service'): PlacedObject[] {
    return this.st.placed.filter((p) => HAMLET_BY_ID[p.kind] && (!kind || HAMLET_BY_ID[p.kind].kind === kind));
  }

  decorations(): PlacedObject[] {
    return this.st.placed.filter((p) => DECOR_BY_ID[p.kind]);
  }

  count(kind: string): number {
    return this.st.placed.filter((p) => p.kind === kind).length;
  }

  population(): number {
    return this.st.villagers.length;
  }

  beds(): number {
    return this.buildings('home').reduce((a, p) => a + (HAMLET_BY_ID[p.kind].beds ?? 0), 0);
  }

  residents(homeUid: string): VillagerState[] {
    return this.st.villagers.filter((v) => v.homeUid === homeUid);
  }

  workers(workUid: string): VillagerState[] {
    return this.st.villagers.filter((v) => v.jobUid === workUid);
  }

  jobSlots(): number {
    return this.buildings('work').reduce((a, p) => a + (HAMLET_BY_ID[p.kind].jobs ?? 0), 0);
  }

  villager(uid: string): VillagerState | undefined {
    return this.st.villagers.find((v) => v.uid === uid);
  }

  /** Beauty of the hamlet: services, workplaces and decorations. */
  appeal(): number {
    let a = 0;
    for (const p of this.buildings()) a += HAMLET_BY_ID[p.kind].appeal;
    for (const p of this.decorations()) {
      const d = DECOR_BY_ID[p.kind];
      a += d.path ? 0.15 : d.light ? 1.5 : d.cat === 'buildings' ? 3 : 1;
    }
    return Math.round(a * 10) / 10;
  }

  avgHappiness(): number {
    const v = this.st.villagers;
    return v.length ? Math.round(v.reduce((a, x) => a + x.happiness, 0) / v.length) : 0;
  }

  levelFor(pop: number): number {
    let lv = 1;
    for (const l of HAMLET_LEVELS) if (pop >= l.pop) lv = l.level;
    return lv;
  }

  levelName(level = this.st.level): string {
    return HAMLET_LEVELS.find((l) => l.level === level)?.name ?? '';
  }

  nextLevel() {
    return HAMLET_LEVELS.find((l) => l.level === this.st.level + 1) ?? null;
  }

  /** Target happiness for one villager given the hamlet's current state. */
  targetHappiness(v: VillagerState): number {
    const pop = Math.max(3, this.population());
    let t = 45;
    t += v.homeUid ? 15 : -25;
    t += v.jobUid ? 10 : -5;
    if (this.count('h_well')) t += 6;
    const tavern = this.buildings('work').find((p) => p.kind === 'h_tavern');
    if (tavern) t += this.workers(tavern.uid).length ? 10 : 5;
    if (this.count('h_bakery')) t += 3;
    t += Math.max(-5, Math.min(20, (this.appeal() / pop) * 4));
    t += Math.min(10, v.friendship / 10);
    const w = this.ctx.state.weather.today;
    if (w === 'rain' || w === 'storm') t -= 3;
    return Math.max(5, Math.min(100, Math.round(t)));
  }

  // ---------------------------------------------------------------- villagers
  makeVillager(): VillagerState {
    const r = this.ctx.rng;
    const used = new Set(this.st.villagers.map((v) => v.name));
    const names = VILLAGER_NAMES.filter((n) => !used.has(n) && n !== this.ctx.state.player.name);
    const look: Appearance = {
      skin: r.int(0, 5), hairStyle: r.int(0, 9), hairColor: r.int(0, 9), eyeStyle: r.int(0, 4), eyeColor: r.int(0, 4),
      top: r.pick(TOPS), topColor: r.pick(CLOTH_COLORS), bottom: r.pick(BOTTOMS), bottomColor: r.pick(CLOTH_COLORS),
      shoes: r.pick(SHOES), shoesColor: r.pick(CLOTH_COLORS), hat: r.pick(HATS), hatColor: r.pick(CLOTH_COLORS), accessory: r.pick(ACCS), cheeks: r.chance(0.7),
    };
    return {
      uid: newUid('v'), name: names.length ? r.pick(names) : `Voyageur ${this.population() + 1}`, look, trait: r.pick(TRAIT_IDS),
      homeUid: null, jobUid: null, happiness: 60, friendship: 0, arrivedDay: this.ctx.state.time.day, wish: null, talkedDay: 0, giftedDay: 0,
    };
  }

  /** A new villager moves into a free bed. */
  arrive(): VillagerState | null {
    const home = this.buildings('home').find((p) => this.residents(p.uid).length < (HAMLET_BY_ID[p.kind].beds ?? 0));
    if (!home) return null;
    const v = this.makeVillager();
    v.homeUid = home.uid;
    this.st.villagers.push(v);
    this.assignJobs();
    this.ctx.log(`${v.name} s'installe au hameau`);
    this.ctx.progress('hamlet_villager');
    this.ctx.bus.emit('hamlet:arrival', { uid: v.uid, name: v.name });
    this.updateLevel();
    this.checkGoals();
    return v;
  }

  /** Homeless villagers move into free beds; idle ones take free jobs. */
  assignHomes(): void {
    for (const v of this.st.villagers) {
      if (v.homeUid && this.st.placed.some((p) => p.uid === v.homeUid)) continue;
      v.homeUid = null;
      const home = this.buildings('home').find((p) => this.residents(p.uid).length < (HAMLET_BY_ID[p.kind].beds ?? 0));
      if (home) v.homeUid = home.uid;
    }
  }

  assignJobs(): void {
    for (const v of this.st.villagers) {
      if (v.jobUid && this.st.placed.some((p) => p.uid === v.jobUid)) continue;
      v.jobUid = null;
      const work = this.buildings('work').find((p) => this.workers(p.uid).length < (HAMLET_BY_ID[p.kind].jobs ?? 0));
      if (work) v.jobUid = work.uid;
    }
  }

  setJob(villagerUid: string, workUid: string | null): boolean {
    const v = this.villager(villagerUid);
    if (!v) return false;
    if (workUid) {
      const p = this.st.placed.find((q) => q.uid === workUid);
      const def = p && HAMLET_BY_ID[p.kind];
      if (!def || def.kind !== 'work') return false;
      if (this.workers(workUid).filter((w) => w.uid !== v.uid).length >= (def.jobs ?? 0)) return false;
    }
    v.jobUid = workUid;
    this.ctx.bus.emit('hamlet:changed');
    return true;
  }

  /** Called when a building is placed in the hamlet. */
  onPlaced(obj: PlacedObject): void {
    const def = HAMLET_BY_ID[obj.kind];
    if (def?.kind === 'home') {
      this.assignHomes();
      // the very first home: a traveller who was camping nearby moves in right away
      if (this.population() === 0) this.arrive();
    }
    if (def?.kind === 'work') this.assignJobs();
    this.checkGoals();
  }

  /** Called when a building is stored/removed. */
  onRemoved(uid: string): void {
    for (const v of this.st.villagers) {
      if (v.homeUid === uid) v.homeUid = null;
      if (v.jobUid === uid) v.jobUid = null;
    }
    this.assignHomes();
    this.assignJobs();
  }

  // ---------------------------------------------------------------- daily cycle
  newDay(): void {
    const st = this.st;
    const day = this.ctx.state.time.day;
    if (st.lastDay >= day) return;
    st.lastDay = day;
    this.assignHomes();
    this.assignJobs();
    // happiness drifts toward its target
    for (const v of st.villagers) {
      const t = this.targetHappiness(v);
      v.happiness = Math.round(v.happiness + (t - v.happiness) * 0.5);
      if (v.wish && v.wish.until < day) v.wish = null;
    }
    this.produce();
    // arrivals: word of mouth works only when people are happy here
    const free = this.beds() - this.population();
    if (free > 0 && (this.population() === 0 || this.avgHappiness() >= 40)) {
      let n = 1;
      if (free > 1 && this.appeal() >= 15 && this.avgHappiness() >= 70) n = 2;
      for (let i = 0; i < n; i++) this.arrive();
    }
    // new wishes
    for (const v of st.villagers) {
      if (v.wish || !this.ctx.rng.chance(0.4)) continue;
      const pool = VILLAGER_TRAITS[v.trait as TraitId]?.wishes.filter((id) => ITEMS[id]) ?? ['bread'];
      const id = this.ctx.rng.pick(pool);
      const pricey = item(id).sell >= 80;
      v.wish = { id, qty: pricey ? this.ctx.rng.int(1, 2) : this.ctx.rng.int(2, 5), until: day + 4 };
    }
    this.updateLevel();
    this.checkGoals();
  }

  /** Workplaces fill the register chest; tavern & market earn coins. */
  produce(): { items: Record<string, number>; coins: number } {
    const st = this.st;
    const season = seasonOfDay(this.ctx.state.time.day);
    const out: Record<string, number> = {};
    let coins = 0;
    for (const p of this.buildings('work')) {
      const def = HAMLET_BY_ID[p.kind];
      const ws = this.workers(p.uid);
      if (!ws.length) continue;
      const eff = ws.reduce((a, w) => a + 0.5 + w.happiness / 100, 0); // sum of worker efficiencies
      for (const o of def.output ?? []) {
        if (o.season && !o.season.includes(season)) continue;
        const key = `${p.uid}:${o.id}`;
        const v = (st.carry[key] ?? 0) + o.qty * eff;
        const whole = Math.floor(v);
        st.carry[key] = v - whole;
        if (whole > 0) out[o.id] = (out[o.id] ?? 0) + whole;
      }
      if (def.coinsPerWorker) coins += Math.round(def.coinsPerWorker * eff * (p.kind === 'h_market' ? 1 + this.population() / 10 : 1));
    }
    for (const [id, q] of Object.entries(out)) {
      const s = st.chest.find((x) => x.id === id);
      if (s) s.qty = Math.min(999, s.qty + q);
      else st.chest.push({ id, qty: Math.min(999, q) });
    }
    st.coins += coins;
    if (Object.keys(out).length || coins) this.ctx.bus.emit('hamlet:produced', { items: out, coins });
    return { items: out, coins };
  }

  chestCount(): number {
    return this.st.chest.reduce((a, s) => a + s.qty, 0) + (this.st.coins > 0 ? 1 : 0);
  }

  /** Take everything from the register chest. */
  collect(): { items: { id: string; qty: number }[]; coins: number } {
    const st = this.st;
    const items = st.chest.filter((s) => s.qty > 0);
    for (const s of items) this.ctx.inventory.add(s.id, s.qty, true);
    const coins = st.coins;
    if (coins > 0) this.ctx.economy.addCoins(coins);
    st.chest = [];
    st.coins = 0;
    if (items.length || coins) {
      this.ctx.progress('hamlet_collect');
      this.markGoal('g_collect');
      this.checkGoals();
    }
    return { items, coins };
  }

  updateLevel(): void {
    const lv = this.levelFor(this.population());
    while (this.st.level < lv) {
      this.st.level++;
      const def = HAMLET_LEVELS.find((l) => l.level === this.st.level)!;
      if (def.gems) this.ctx.economy.addGems(def.gems);
      this.ctx.economy.addXp(150 * this.st.level);
      this.ctx.log(`Clairefontaine devient : ${def.name}`);
      this.ctx.bus.emit('hamlet:level', { level: this.st.level, name: def.name, reward: def.reward });
    }
  }

  // ---------------------------------------------------------------- conversations
  mood(v: VillagerState): 'happy' | 'ok' | 'sad' {
    return v.happiness >= 70 ? 'happy' : v.happiness >= 40 ? 'ok' : 'sad';
  }

  talk(uid: string): string {
    const v = this.villager(uid);
    if (!v) return '';
    const day = this.ctx.state.time.day;
    if (v.talkedDay !== day) {
      v.talkedDay = day;
      v.friendship = Math.min(100, v.friendship + 3);
      v.happiness = Math.min(100, v.happiness + 2);
      this.ctx.progress('talk', 'villager');
    }
    const r = this.ctx.rng;
    const fill = (t: string) => t.replace('{name}', this.ctx.state.player.name || 'ami·e').replace('{hamlet}', this.st.name);
    if (v.wish) return fill(`J'aurais tellement besoin de ${v.wish.qty}× ${item(v.wish.id).name} ${item(v.wish.id).icon}… Tu pourrais m'en apporter ?`);
    if (!v.homeUid) return fill(r.pick(VILLAGER_LINES.sad.slice(0, 1)));
    if (!v.jobUid && this.jobSlots() <= this.population() - 1) return fill(VILLAGER_LINES.sad[1]);
    const mood = this.mood(v);
    const pool = [...VILLAGER_LINES[mood], ...(mood !== 'sad' ? TRAIT_LINES[v.trait as TraitId] ?? [] : [])];
    return fill(r.pick(pool));
  }

  canDeliverWish(uid: string): boolean {
    const v = this.villager(uid);
    return !!v?.wish && this.ctx.inventory.has(v.wish.id, v.wish.qty);
  }

  deliverWish(uid: string): { ok: boolean; coins?: number; gems?: number } {
    const v = this.villager(uid);
    if (!v?.wish || !this.ctx.inventory.has(v.wish.id, v.wish.qty)) return { ok: false };
    const w = v.wish;
    this.ctx.inventory.remove(w.id, w.qty);
    const coins = Math.round(item(w.id).sell * w.qty * 1.5 + 50);
    this.ctx.economy.addCoins(coins);
    const gems = this.ctx.rng.chance(0.34) ? 1 : 0;
    if (gems) this.ctx.economy.addGems(gems);
    this.ctx.economy.addXp(25);
    v.wish = null;
    v.happiness = Math.min(100, v.happiness + 20);
    v.friendship = Math.min(100, v.friendship + 10);
    this.ctx.progress('hamlet_wish');
    this.markGoal('g_wish');
    this.checkGoals();
    return { ok: true, coins, gems };
  }

  gift(uid: string, itemId: string): { ok: boolean; loved?: boolean } {
    const v = this.villager(uid);
    if (!v || v.giftedDay === this.ctx.state.time.day || !this.ctx.inventory.has(itemId)) return { ok: false };
    this.ctx.inventory.remove(itemId, 1);
    v.giftedDay = this.ctx.state.time.day;
    const loved = (VILLAGER_TRAITS[v.trait as TraitId]?.wishes as readonly string[]).includes(itemId);
    v.friendship = Math.min(100, v.friendship + (loved ? 12 : 5));
    v.happiness = Math.min(100, v.happiness + (loved ? 10 : 4));
    this.ctx.progress('gift', 'villager');
    return { ok: true, loved };
  }

  // ---------------------------------------------------------------- goals
  goalDone(g: HamletGoal): boolean {
    const st = this.st;
    switch (g.id) {
      case 'g_home': return this.buildings('home').length > 0;
      case 'g_villager': return this.population() >= 1;
      case 'g_work': return this.buildings('work').length > 0;
      case 'g_decor': return this.decorations().filter((d) => !DECOR_BY_ID[d.kind].path).length >= 3;
      case 'g_pop3': return this.population() >= 3;
      case 'g_tavern': return this.count('h_tavern') > 0;
      case 'g_happy': return this.population() >= 3 && this.avgHappiness() >= 80;
      case 'g_pop7': return this.population() >= 7;
      case 'g_pop12': return this.population() >= 12;
      default: return st.goals.includes(g.id) || !!this.ctx.state.flags[`hamlet_${g.id}`];
    }
  }

  private markGoal(id: string): void {
    this.ctx.state.flags[`hamlet_${id}`] = true;
  }

  /** Current goal (first not yet completed) — shown as guidance. */
  currentGoal(): HamletGoal | null {
    return HAMLET_GOALS.find((g) => !this.st.goals.includes(g.id)) ?? null;
  }

  checkGoals(): void {
    // goals are completed in order so the tutorial reads like a story
    for (const g of HAMLET_GOALS) {
      if (this.st.goals.includes(g.id)) continue;
      if (!this.goalDone(g)) break;
      this.st.goals.push(g.id);
      const r = g.reward;
      if (r.coins) this.ctx.economy.addCoins(r.coins, true);
      if (r.gems) this.ctx.economy.addGems(r.gems);
      for (const [id, q] of r.items ?? []) this.ctx.inventory.add(id, q, true);
      this.ctx.economy.addXp(40);
      this.ctx.bus.emit('hamlet:goal', { id: g.id, text: g.text, reward: r });
    }
  }
}
