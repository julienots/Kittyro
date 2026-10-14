/**
 * Ads bridge. On Android the AdMob build exposes `window.MossyAds` (see
 * android/admob/AdMobBackend.java); the plain build exposes a stub that reports
 * "unavailable", so every ad button simply stays hidden. In the browser, a
 * clearly-labelled *test* ad can be enabled for development with `?ads=test`.
 *
 * Rules (cozy & fair): rewarded ads are always optional; interstitials are rare,
 * only at natural breaks (new day, travel), never in the first minutes of a
 * session, never twice within 8 minutes, and skipped right after a rewarded ad.
 */
export type AdKind = 'rewarded' | 'interstitial';

interface NativeAds {
  isAvailable(): boolean;
  isReady(kind: string): boolean;
  show(kind: string, requestId: string): void;
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): void;
}

declare global {
  interface Window {
    MossyAds?: NativeAds;
    __mossyAdDone?: (id: string, rewarded: boolean) => void;
  }
}

export class AdService {
  private pending = new Map<string, (ok: boolean) => void>();
  private seq = 0;
  private sessionStart = performance.now();
  private lastInterstitial = 0;
  private lastRewarded = -1e9;
  private hourly: number[] = [];
  showing = false;
  /** called around full-screen ads so the game can pause & mute */
  onShow: ((showing: boolean) => void) | null = null;
  readonly testMode: boolean;

  constructor() {
    let test = false;
    try {
      test = new URLSearchParams(location.search).get('ads') === 'test' || localStorage.getItem('mm_test_ads') === '1';
    } catch { /* ignore */ }
    this.testMode = test && !window.MossyAds;
    window.__mossyAdDone = (id, rewarded) => this.done(id, rewarded);
  }

  private get native(): NativeAds | null {
    return window.MossyAds ?? null;
  }

  available(): boolean {
    try {
      return this.testMode || !!this.native?.isAvailable();
    } catch {
      return false;
    }
  }

  ready(kind: AdKind): boolean {
    if (this.testMode) return true;
    try {
      return !!this.native?.isReady(kind);
    } catch {
      return false;
    }
  }

  private done(id: string, rewarded: boolean): void {
    const cb = this.pending.get(id);
    this.pending.delete(id);
    this.showing = false;
    this.onShow?.(false);
    cb?.(rewarded);
  }

  private show(kind: AdKind): Promise<boolean> {
    if (this.showing || !this.available()) return Promise.resolve(false);
    const id = `ad${++this.seq}`;
    this.showing = true;
    this.onShow?.(true);
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      if (this.testMode) this.testAd(kind, id);
      else {
        try {
          this.native!.show(kind, id);
        } catch {
          this.done(id, false);
        }
      }
    });
  }

  /** Optional rewarded ad. Resolves true only if the reward was earned. */
  async rewarded(): Promise<boolean> {
    const ok = await this.show('rewarded');
    if (ok) this.lastRewarded = performance.now();
    return ok;
  }

  /** Rare interstitial at a natural break; silently does nothing when not allowed. */
  async breakpoint(): Promise<void> {
    const now = performance.now();
    const min = 60_000;
    this.hourly = this.hourly.filter((t) => now - t < 60 * min);
    if (now - this.sessionStart < 6 * min) return;
    if (now - this.lastInterstitial < 8 * min) return;
    if (now - this.lastRewarded < 10 * min) return;
    if (this.hourly.length >= 4) return;
    if (!this.ready('interstitial')) return;
    this.lastInterstitial = now;
    this.hourly.push(now);
    await this.show('interstitial');
  }

  privacyOptionsRequired(): boolean {
    try {
      return !!this.native?.privacyOptionsRequired();
    } catch {
      return false;
    }
  }

  showPrivacyOptions(): void {
    try {
      this.native?.showPrivacyOptions();
    } catch { /* ignore */ }
  }

  /** Development stand-in, clearly marked as a test (browser only, opt-in). */
  private testAd(kind: AdKind, id: string): void {
    const el = document.createElement('div');
    el.className = 'test-ad';
    let left = kind === 'rewarded' ? 5 : 3;
    el.innerHTML = `<div class="test-ad-card"><b>Publicité de test</b><p>${kind === 'rewarded' ? 'Vidéo récompensée' : 'Interstitiel'} — aucune vraie pub en mode développement.</p><div class="test-ad-count">${left}</div><button class="btn small ghost" disabled>Fermer</button></div>`;
    document.getElementById('ui')?.appendChild(el);
    const btn = el.querySelector('button')!;
    const count = el.querySelector('.test-ad-count')!;
    let complete = false;
    const tick = setInterval(() => {
      left--;
      count.textContent = left > 0 ? String(left) : '✓';
      if (left <= 0) {
        clearInterval(tick);
        complete = true;
        btn.disabled = false;
      }
    }, 1000);
    btn.addEventListener('click', () => {
      el.remove();
      this.done(id, complete && kind === 'rewarded');
    });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
}

export const ads = new AdService();
