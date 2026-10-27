import type { Ctx } from './Context';
import { CROPS, seedId } from '../data/crops';
import { seasonOfDay } from '../data/constants';
import { item } from '../data/items';
import { DECOR, DECOR_BY_ID } from '../data/decor';
import { WEAR, wearKey } from '../data/wardrobe';
import { ANIMALS } from '../data/animals';
import { FRUIT_TREES } from '../data/resources';
import { FARM_THEMES, TRAILS, BACKPACK_UPGRADES, PASS_PREMIUM_GEMS, passReward, PASS_POINTS_PER_TIER } from '../data/shop';
import { FESTIVALS } from '../data/festivals';

export interface Offer {
  key: string;
  kind: 'item' | 'decor' | 'wear' | 'animal' | 'theme' | 'trail' | 'backpack';
  id: string;
  name: string;
  icon: string;
  price: number;
  currency: 'coins' | 'gems' | 'tokens';
  owned?: boolean;
  locked?: string;
  desc?: string;
}

export const SHOP_NAMES: Record<string, string> = {
  general: 'Boutique de Mallow', florist: 'Fleuriste de Pippa', fishing: 'Boutique de pêche', workshop: 'Atelier de Toma',
  bakery: 'Boulangerie de Brie', animals: 'Écurie de Hazel', boutique: 'Boutique Cozy ✨', festival: 'Stand du festival',
};

export class ShopSystem {
  constructor(private ctx: Ctx) {}

  offers(shop: string): Offer[] {
    const st = this.ctx.state;
    const season = seasonOfDay(st.time.day);
    const lv = st.player.level;
    const restored = (id: string) => !!st.village[id]?.restored;
    const disc = 1 - this.ctx.npcs.discount('mallow');
    const out: Offer[] = [];
    const itemOffer = (id: string, price: number, extra: Partial<Offer> = {}): Offer => ({ key: `item:${id}`, kind: 'item', id, name: item(id).name, icon: item(id).icon, price: Math.round(price), currency: 'coins', desc: item(id).desc, ...extra });
    const decorOffer = (id: string): Offer => {
      const d = DECOR_BY_ID[id];
      const currency = d.gems ? 'gems' : d.tokens ? 'tokens' : 'coins';
      return { key: `decor:${id}`, kind: 'decor', id, name: d.name, icon: d.icon, price: d.gems ?? d.tokens ?? d.price, currency };
    };
    switch (shop) {
      case 'general': {
        for (const c of CROPS) {
          if (c.flower && c.id !== 'tulip' && c.id !== 'sunflower') continue;
          if (!c.seasons.includes(season) && !restored('shop')) continue;
          const locked = lv < c.unlockLevel ? `Niveau ${c.unlockLevel}` : !c.seasons.includes(season) ? 'Hors saison (serre)' : undefined;
          if (!restored('shop') && c.unlockLevel > 1) continue;
          out.push(itemOffer(seedId(c.id), c.seedPrice * disc, { locked: lv < c.unlockLevel ? locked : undefined, desc: `${item(c.id).desc}${!c.seasons.includes(season) ? ' — hors saison' : ''}` }));
        }
        out.push(itemOffer('fertilizer', 20 * disc));
        if (restored('shop')) {
          out.push(itemOffer('sugar', 25 * disc), itemOffer('bait', 6 * disc), itemOffer('animal_treat', 30 * disc));
          for (const t of FRUIT_TREES) out.push(itemOffer(`sapling_${t.id}`, t.price * disc));
          const next = BACKPACK_UPGRADES.find((b) => b.size > st.inventorySize);
          if (next) out.push({ key: 'backpack', kind: 'backpack', id: 'backpack', name: `Sac agrandi (${next.size} places)`, icon: '🎒', price: next.coins, currency: 'coins' });
          for (const d of DECOR.filter((x) => !x.indoor && x.price > 0 && ['paths', 'rustic', 'furniture', 'nature'].includes(x.cat))) out.push(decorOffer(d.id));
        }
        break;
      }
      case 'florist':
        for (const c of CROPS.filter((x) => x.flower)) out.push(itemOffer(seedId(c.id), c.seedPrice, { locked: lv < c.unlockLevel ? `Niveau ${c.unlockLevel}` : undefined }));
        for (const d of DECOR.filter((x) => x.price > 0 && (x.cat === 'flowers' || x.cat === 'plant' || x.cat === 'colorful'))) out.push(decorOffer(d.id));
        break;
      case 'fishing':
        out.push(itemOffer('bait', 5), itemOffer('magic_bait', 120, { locked: lv < 5 ? 'Niveau 5' : undefined }));
        for (const d of DECOR.filter((x) => x.price > 0 && x.cat === 'beach')) out.push(decorOffer(d.id));
        break;
      case 'workshop':
        out.push(itemOffer('plank', 25), itemOffer('rope', 20), itemOffer('glass', 45), itemOffer('brick', 35), itemOffer('coal', 30), itemOffer('clay', 20));
        for (const d of DECOR.filter((x) => x.indoor && x.price > 0)) out.push(decorOffer(d.id));
        for (const d of DECOR.filter((x) => !x.indoor && x.price > 0 && (x.cat === 'buildings' || x.cat === 'lights'))) out.push(decorOffer(d.id));
        break;
      case 'bakery':
        out.push(itemOffer('flour', 40), itemOffer('sugar', 25), itemOffer('butter', 150), itemOffer('bread', 110), itemOffer('cookies', 150), itemOffer('egg', 60));
        break;
      case 'animals':
        for (const a of ANIMALS.filter((x) => !x.wild)) {
          out.push({ key: `animal:${a.id}`, kind: 'animal', id: a.id, name: a.name, icon: a.icon, price: this.ctx.animals.price(a.id), currency: 'coins', desc: a.desc, locked: lv < a.unlockLevel ? `Niveau ${a.unlockLevel}` : undefined });
        }
        out.push(itemOffer('hay', 12), itemOffer('animal_treat', 25));
        break;
      case 'boutique':
        for (const w of WEAR.filter((x) => x.gems)) out.push({ key: `wear:${wearKey(w)}`, kind: 'wear', id: wearKey(w), name: w.name, icon: w.icon, price: w.gems!, currency: 'gems', owned: st.wardrobe.includes(wearKey(w)) });
        for (const w of WEAR.filter((x) => x.price > 0)) out.push({ key: `wear:${wearKey(w)}`, kind: 'wear', id: wearKey(w), name: w.name, icon: w.icon, price: w.price, currency: 'coins', owned: st.wardrobe.includes(wearKey(w)) });
        for (const d of DECOR.filter((x) => x.gems)) out.push(decorOffer(d.id));
        for (const t of FARM_THEMES.filter((x) => x.gems)) out.push({ key: `theme:${t.id}`, kind: 'theme', id: t.id, name: `Thème : ${t.name}`, icon: '🎨', price: t.gems, currency: 'gems', owned: (st.flags.themesOwned ?? []).includes(t.id) });
        for (const t of TRAILS.filter((x) => x.gems)) out.push({ key: `trail:${t.id}`, kind: 'trail', id: t.id, name: `Traînée : ${t.name}`, icon: '✨', price: t.gems, currency: 'gems', owned: (st.flags.trailsOwned ?? []).includes(t.id) });
        break;
      case 'festival': {
        const ids = new Set(FESTIVALS.flatMap((f) => f.decor));
        for (const id of ids) {
          const d = DECOR_BY_ID[id];
          if (d?.tokens) out.push(decorOffer(id));
        }
        for (const w of WEAR.filter((x) => x.tokens)) out.push({ key: `wear:${wearKey(w)}`, kind: 'wear', id: wearKey(w), name: w.name, icon: w.icon, price: w.tokens!, currency: 'tokens', owned: st.wardrobe.includes(wearKey(w)) });
        break;
      }
    }
    return out;
  }

  private pay(o: Offer, qty: number): boolean {
    const total = o.price * qty;
    if (o.currency === 'coins') return this.ctx.economy.spend(total);
    if (o.currency === 'gems') return this.ctx.economy.spendGems(total);
    return this.ctx.economy.spendTokens(total);
  }

  buy(o: Offer, qty = 1): boolean {
    const st = this.ctx.state;
    if (o.locked || o.owned) return false;
    if (o.kind === 'animal') {
      const can = this.ctx.animals.canAdopt(o.id);
      if (!can.ok) {
        this.ctx.toast(can.reason!, '🏠', 'warn');
        return false;
      }
      return !!this.ctx.animals.adopt(o.id);
    }
    if (!this.pay(o, qty)) {
      this.ctx.toast(o.currency === 'coins' ? 'Pas assez de pièces' : o.currency === 'gems' ? 'Pas assez de Moon Gems' : 'Pas assez de jetons', '💸', 'warn');
      return false;
    }
    this.deliver(o, qty);
    return true;
  }

  /** Hand over an offer without paying (rewarded ad unlock). */
  grantFree(o: Offer): boolean {
    if (o.locked || o.owned || o.kind === 'animal' || o.kind === 'backpack') return false;
    this.deliver(o, 1);
    return true;
  }

  private deliver(o: Offer, qty: number): void {
    const st = this.ctx.state;
    switch (o.kind) {
      case 'item': this.ctx.inventory.add(o.id, qty, true); break;
      case 'decor': this.ctx.inventory.add(o.id, qty, true); break;
      case 'wear': if (!st.wardrobe.includes(o.id)) st.wardrobe.push(o.id); break;
      case 'theme': (st.flags.themesOwned ??= ['classic']).push(o.id); break;
      case 'trail': (st.flags.trailsOwned ??= ['none']).push(o.id); break;
      case 'backpack': {
        const next = BACKPACK_UPGRADES.find((b) => b.size > st.inventorySize);
        if (next) this.ctx.inventory.resize(next.size);
        break;
      }
    }
    this.ctx.bus.emit('bought', { key: o.key, qty });
  }

  // ---- Cozy Pass ----
  passTier(): number {
    return Math.floor(this.ctx.state.pass.points / PASS_POINTS_PER_TIER);
  }

  buyPremiumPass(): boolean {
    if (this.ctx.state.pass.premium) return false;
    if (!this.ctx.economy.spendGems(PASS_PREMIUM_GEMS)) {
      this.ctx.toast(`Il faut ${PASS_PREMIUM_GEMS} Moon Gems (gagnés en jouant).`, '💎', 'warn');
      return false;
    }
    this.ctx.state.pass.premium = true;
    return true;
  }

  claimPass(tier: number, premium: boolean): boolean {
    const p = this.ctx.state.pass;
    if (tier >= this.passTier()) return false;
    const list = premium ? p.claimedPremium : p.claimedFree;
    if (list.includes(tier) || (premium && !p.premium)) return false;
    const r = passReward(tier, premium);
    switch (r.kind) {
      case 'coins': this.ctx.economy.addCoins(r.qty); break;
      case 'gems': this.ctx.economy.addGems(r.qty); break;
      case 'item':
      case 'decor': this.ctx.inventory.add(r.id!, r.qty, true); break;
      case 'wear': if (!this.ctx.state.wardrobe.includes(r.id!)) this.ctx.state.wardrobe.push(r.id!); break;
      case 'trail': (this.ctx.state.flags.trailsOwned ??= ['none']).push(r.id!); break;
    }
    list.push(tier);
    this.ctx.bus.emit('pass:claimed', { tier, premium, label: r.label });
    return true;
  }
}
