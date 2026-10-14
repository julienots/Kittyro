import type { Ctx } from './Context';
import type { Offer } from './Shop';
import { PASS_POINTS_PER_TIER, PASS_TIERS } from '../data/shop';

/**
 * Optional "watch an ad" rewards. Pure logic with daily limits so the game stays
 * fair and cozy: ads are always the player's choice, never needed to progress.
 */
export type AdPlacement = 'gems' | 'double_earnings' | 'hamlet_boost' | 'pass_points' | 'free_offer';

export const AD_LIMITS: Record<AdPlacement, number> = {
  gems: 5,
  double_earnings: 1,
  hamlet_boost: 1,
  pass_points: 2,
  free_offer: 3,
};

export const AD_INFO: Record<AdPlacement, { icon: string; name: string; desc: string }> = {
  gems: { icon: '💎', name: '+3 Moon Gems', desc: 'Des gemmes pour la boutique, le Cozy Pass+ et les décorations magiques.' },
  double_earnings: { icon: '🪙', name: 'Doubler les gains d\'hier', desc: 'Les ventes de la veille vous rapportent une seconde fois (max 2 000).' },
  hamlet_boost: { icon: '🏘️', name: 'Production express', desc: 'Vos villageois produisent une journée de plus, tout de suite.' },
  pass_points: { icon: '🎟️', name: '+30 points Cozy Pass', desc: 'Avancez plus vite vers les récompenses du pass.' },
  free_offer: { icon: '🛍️', name: 'Article offert', desc: 'Un article de boutique gratuit (bouton 📺 à côté du prix).' },
};

/** Offers cheap enough to be unlocked with a rewarded ad. */
export function freeEligible(o: Offer): boolean {
  if (o.locked || o.owned || o.kind === 'animal' || o.kind === 'backpack') return false;
  if (o.currency === 'coins') return o.price >= 100 && o.price <= 2500; // worth a video, not a game-changer
  if (o.currency === 'gems') return o.price <= 25;
  return o.price <= 10;
}

export class AdRewardSystem {
  constructor(private ctx: Ctx) {}

  private book(): { day: number; counts: Record<string, number>; earnedYesterday: number } {
    const st = this.ctx.state;
    const b = (st.flags.ads ??= { day: st.time.day, counts: {}, earnedYesterday: 0 });
    if (b.day !== st.time.day) {
      b.day = st.time.day;
      b.counts = {};
    }
    return b;
  }

  left(p: AdPlacement): number {
    return Math.max(0, AD_LIMITS[p] - (this.book().counts[p] ?? 0));
  }

  /** Remember yesterday's sales so they can be doubled. */
  setYesterdayEarnings(n: number): void {
    this.book().earnedYesterday = Math.max(0, Math.round(n));
  }

  doubleAmount(): number {
    return Math.min(2000, this.book().earnedYesterday ?? 0);
  }

  can(p: AdPlacement): boolean {
    if (this.left(p) <= 0) return false;
    if (p === 'double_earnings') return this.doubleAmount() > 0;
    if (p === 'hamlet_boost') return this.ctx.hamlet.buildings('work').some((b) => this.ctx.hamlet.workers(b.uid).length > 0);
    return true;
  }

  /** Give the reward after the ad was fully watched. Returns a short description. */
  grant(p: AdPlacement, offer?: Offer): string | null {
    if (!this.can(p)) return null;
    let text = '';
    switch (p) {
      case 'gems':
        this.ctx.economy.addGems(3);
        text = '+3 💎';
        break;
      case 'double_earnings': {
        const n = this.doubleAmount();
        this.ctx.economy.addCoins(n);
        this.book().earnedYesterday = 0;
        text = `+${n} 🪙`;
        break;
      }
      case 'hamlet_boost': {
        const r = this.ctx.hamlet.produce();
        const n = Object.values(r.items).reduce((a, b) => a + b, 0);
        text = `${n} objets${r.coins ? ` et ${r.coins} 🪙` : ''} au registre`;
        break;
      }
      case 'pass_points': {
        const pass = this.ctx.state.pass;
        const before = Math.floor(pass.points / PASS_POINTS_PER_TIER);
        pass.points = Math.min(PASS_TIERS * PASS_POINTS_PER_TIER, pass.points + 30);
        const after = Math.floor(pass.points / PASS_POINTS_PER_TIER);
        if (after > before) this.ctx.bus.emit('pass:tier', { tier: after });
        text = '+30 points de pass';
        break;
      }
      case 'free_offer':
        if (!offer || !freeEligible(offer) || !this.ctx.shop.grantFree(offer)) return null;
        text = `${offer.icon} ${offer.name}`;
        break;
    }
    const b = this.book();
    b.counts[p] = (b.counts[p] ?? 0) + 1;
    this.ctx.state.stats.adsWatched = (this.ctx.state.stats.adsWatched ?? 0) + 1;
    return text;
  }
}
