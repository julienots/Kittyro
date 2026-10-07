import type { Ctx } from './Context';
import type { AnimalState } from '../state/types';
import { ANIMAL_BY_ID, ANIMAL_NAMES } from '../data/animals';
import { BUILDING_BY_ID } from '../data/buildings';
import { item } from '../data/items';
import { seasonOfDay } from '../data/constants';
import { footprintOf, newUid } from './Building';
import { FARM } from '../state/newGame';

const PET_GIFTS: Record<string, string[]> = {
  cat: ['feather', 'minnow', 'daisy', 'wild_berry', 'poppy'],
  dog: ['acorn', 'geode', 'button_mushroom', 'copper_ore', 'fossil', 'treasure_map'],
  fox: ['wild_berry', 'chanterelle', 'acorn'],
  deer: ['herb', 'mint', 'bluebell'],
  raccoon: ['geode', 'copper_ore', 'pearl', 'treasure_map', 'coal'],
  otter: ['seashell', 'pearl', 'coral', 'sardine'],
  hedgehog: ['acorn', 'button_mushroom', 'wild_berry'],
  lumipanda: ['moonstone', 'frost_crystal', 'amethyst'],
};

export class AnimalSystem {
  constructor(private ctx: Ctx) {}

  get all(): AnimalState[] {
    return this.ctx.state.animals;
  }

  byUid(uid: string): AnimalState | undefined {
    return this.all.find((a) => a.uid === uid);
  }

  /** Find a home building with free space for this species. */
  findHome(species: string): string | null | undefined {
    const def = ANIMAL_BY_ID[species];
    if (!def) return undefined;
    if (def.home === 'pet') return null; // pets roam freely
    for (const p of this.ctx.state.farm.placed) {
      const b = BUILDING_BY_ID[p.kind];
      if (!b || b.houses !== def.home) continue;
      const n = this.all.filter((a) => a.homeUid === p.uid).length;
      if (n < (b.capacity ?? 0)) return p.uid;
    }
    return undefined;
  }

  price(species: string): number {
    const def = ANIMAL_BY_ID[species];
    const hazelLvl = Math.floor((this.ctx.state.npcs.hazel?.friendship ?? 0) / 100);
    return Math.round(def.price * (hazelLvl >= 5 ? 0.75 : 1));
  }

  canAdopt(species: string): { ok: boolean; reason?: string } {
    const def = ANIMAL_BY_ID[species];
    if (!def) return { ok: false, reason: '?' };
    const home = this.findHome(species);
    if (home === undefined) {
      const hName = { coop: 'un poulailler', barn: 'une étable', stable: 'une écurie', sanctuary: 'un refuge sauvage', pet: '' }[def.home];
      return { ok: false, reason: `Il faut ${hName} avec de la place.` };
    }
    if (def.home === 'pet' && this.all.filter((a) => a.species === species).length >= 2) return { ok: false, reason: 'Vous en avez déjà deux.' };
    return { ok: true };
  }

  /** Buy (or adopt for wild animals) an animal. */
  adopt(species: string, free = false, name?: string): AnimalState | null {
    const can = this.canAdopt(species);
    if (!can.ok) {
      this.ctx.toast(can.reason!, '🏠', 'warn');
      return null;
    }
    const def = ANIMAL_BY_ID[species];
    if (!free && !this.ctx.economy.spend(this.price(species))) {
      this.ctx.toast('Pas assez de pièces.', '🪙', 'warn');
      return null;
    }
    const homeUid = this.findHome(species) ?? null;
    const home = homeUid ? this.ctx.state.farm.placed.find((p) => p.uid === homeUid) : null;
    let x = FARM.spawn.x + 2, z = FARM.spawn.z + 2;
    if (home) {
      const fp = footprintOf(home.kind, home.x, home.z, home.rot);
      x = (fp.x0 + fp.x1) / 2;
      z = fp.z1 + 1.2;
    }
    const used = new Set(this.all.map((a) => a.name));
    const nm = name ?? ANIMAL_NAMES.find((n) => !used.has(n)) ?? `${def.name} ${this.all.length + 1}`;
    const a: AnimalState = {
      uid: newUid('a'), species, name: nm, x, z, hunger: 80, happiness: 70, friendship: 0,
      product: null, productQuality: 0, lastProducedDay: this.ctx.state.time.day, petToday: false, fedToday: false,
      homeUid, bornDay: this.ctx.state.time.day, color: this.ctx.rng.int(0, def.colors.length - 1),
    };
    this.all.push(a);
    this.ctx.collections.record('animals', species);
    this.ctx.progress('adopt', species);
    this.ctx.economy.addXp(30);
    this.ctx.bus.emit('animals:changed', { added: a.uid });
    this.ctx.log(`${a.name} le/la ${def.name.toLowerCase()} rejoint la ferme !`);
    return a;
  }

  pet(uid: string): boolean {
    const a = this.byUid(uid);
    if (!a) return false;
    if (a.petToday) {
      this.ctx.bus.emit('animal:react', { uid, kind: 'happy' });
      return false;
    }
    a.petToday = true;
    a.friendship = Math.min(1000, a.friendship + 15);
    a.happiness = Math.min(100, a.happiness + 12);
    this.ctx.progress('pet', a.species);
    this.ctx.economy.addXp(3);
    this.ctx.bus.emit('animal:react', { uid, kind: 'love' });
    return true;
  }

  feed(uid: string, itemId: string): boolean {
    const a = this.byUid(uid);
    if (!a) return false;
    const cat = item(itemId).cat;
    const ok = itemId === 'hay' || itemId === 'animal_treat' || cat === 'crop' || cat === 'fruit' || cat === 'forage';
    if (!ok) return false;
    if (!this.ctx.inventory.remove(itemId, 1)) return false;
    a.hunger = Math.min(100, a.hunger + (itemId === 'hay' ? 50 : 35));
    a.happiness = Math.min(100, a.happiness + (itemId === 'animal_treat' ? 15 : 5));
    a.friendship = Math.min(1000, a.friendship + (itemId === 'animal_treat' ? 12 : 4));
    a.fedToday = true;
    this.ctx.bus.emit('animal:react', { uid, kind: 'eat' });
    return true;
  }

  collect(uid: string): string | null {
    const a = this.byUid(uid);
    if (!a || !a.product) return null;
    const id = a.product;
    const qty = a.productQuality >= 2 ? 2 : 1;
    this.ctx.inventory.add(id, qty, true);
    a.product = null;
    this.ctx.progress('collect_product', id, qty);
    this.ctx.economy.addXp(5);
    this.ctx.bus.emit('animal:react', { uid, kind: 'product' });
    this.ctx.bus.emit('harvested', { animal: uid, id, qty });
    return id;
  }

  /** Fill the silo from the inventory. */
  storeHay(qty: number): number {
    const cap = this.siloCapacity() - this.ctx.state.farm.silo;
    const n = Math.min(qty, cap, this.ctx.inventory.count('hay'));
    if (n <= 0) return 0;
    this.ctx.inventory.remove('hay', n);
    this.ctx.state.farm.silo += n;
    return n;
  }

  siloCapacity(): number {
    return this.ctx.state.farm.placed.filter((p) => p.kind === 'silo').length * 240;
  }

  /** Daily update at dawn: feeding, happiness, production. */
  newDay(): void {
    const st = this.ctx.state;
    const season = seasonOfDay(st.time.day);
    const grazing = season !== 'winter' && st.weather.today !== 'rain' && st.weather.today !== 'storm' && st.weather.today !== 'snow';
    for (const a of this.all) {
      const def = ANIMAL_BY_ID[a.species];
      if (!def) continue;
      const wasFed = a.fedToday || a.hunger > 30;
      // production for the day that just ended
      if (def.product && !a.product && wasFed && a.happiness > 25 && st.time.day - a.lastProducedDay >= def.productEvery) {
        a.product = def.product;
        a.productQuality = a.friendship > 600 && a.happiness > 80 ? 2 : a.friendship > 250 ? 1 : 0;
        a.lastProducedDay = st.time.day;
        // ducks sometimes also leave a feather
        if (a.species === 'duck' && this.ctx.rng.chance(0.25)) this.ctx.inventory.addToStorage('feather', 1);
      }
      // pets & wild friends bring little gifts
      const gifts = PET_GIFTS[a.species];
      if (gifts && st.time.day - a.lastProducedDay >= def.productEvery && this.ctx.rng.chance(0.6 + a.friendship / 3000)) {
        a.product = this.ctx.rng.pick(gifts);
        a.lastProducedDay = st.time.day;
      }
      // hunger & feeding
      a.hunger = Math.max(0, a.hunger - 45);
      if (def.home !== 'pet' && def.home !== 'sanctuary' && st.farm.silo > 0 && a.hunger < 70) {
        st.farm.silo--;
        a.hunger = 100;
      }
      if (grazing && def.home !== 'pet') a.hunger = Math.min(100, a.hunger + 40);
      if (def.home === 'pet' || def.home === 'sanctuary') a.hunger = Math.max(a.hunger, 60); // they fend for themselves
      a.happiness = Math.max(0, Math.min(100, a.happiness + (a.hunger > 50 ? 4 : -10) + (a.petToday ? 6 : -4) + (grazing ? 3 : 0)));
      a.friendship = Math.min(1000, a.friendship + (a.hunger > 50 ? 5 : 0));
      a.petToday = false;
      a.fedToday = false;
    }
    this.ctx.bus.emit('animals:changed');
  }

  // ---- wild animals ----
  wildFriendship(species: string): number {
    return this.ctx.state.flags[`wild_${species}`] ?? 0;
  }

  befriendWild(species: string): { level: number; adoptable: boolean; fedToday: boolean } {
    const key = `wild_${species}`;
    const dayKey = `wildday_${species}`;
    const st = this.ctx.state;
    if (st.flags[dayKey] === st.time.day) return { level: st.flags[key] ?? 0, adoptable: (st.flags[key] ?? 0) >= 3, fedToday: true };
    const food = ['animal_treat', 'wild_berry', 'apple', 'carrot', 'snowberry', 'minnow', 'acorn'].find((f) => this.ctx.inventory.has(f));
    if (!food) return { level: st.flags[key] ?? 0, adoptable: false, fedToday: false };
    this.ctx.inventory.remove(food, 1);
    st.flags[key] = (st.flags[key] ?? 0) + 1;
    st.flags[dayKey] = st.time.day;
    this.ctx.collections.record('animals', species);
    return { level: st.flags[key], adoptable: st.flags[key] >= 3, fedToday: false };
  }

  owns(species: string): boolean {
    return this.all.some((a) => a.species === species);
  }
}
