import type { GameState } from '../state/types';
import { createNewGame } from '../state/newGame';
import { SAVE_VERSION } from '../data/constants';

/** Storage backend. Local storage, Android native files, or (later) cloud. */
export interface StorageAdapter {
  readonly name: string;
  read(key: string): Promise<string | null>;
  write(key: string, data: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Future cloud provider: only needs push/pull of an envelope. Conflicts resolved by `savedAt`. */
export interface CloudSyncProvider {
  readonly name: string;
  pull(slot: string): Promise<string | null>;
  push(slot: string, envelope: string): Promise<void>;
}

export class MemoryAdapter implements StorageAdapter {
  name = 'memory';
  map = new Map<string, string>();
  async read(k: string) { return this.map.get(k) ?? null; }
  async write(k: string, d: string) { this.map.set(k, d); }
  async remove(k: string) { this.map.delete(k); }
}

export class LocalStorageAdapter implements StorageAdapter {
  name = 'localStorage';
  async read(k: string) {
    try { return localStorage.getItem(k); } catch { return null; }
  }
  async write(k: string, d: string) {
    localStorage.setItem(k, d);
  }
  async remove(k: string) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

interface NativeBridge {
  saveFile(name: string, data: string): boolean;
  loadFile(name: string): string | null;
  deleteFile(name: string): boolean;
}

/** Android WebView bridge (see android/MainActivity.java): atomic file writes in app storage. */
export class AndroidFileAdapter implements StorageAdapter {
  name = 'androidFile';
  constructor(private bridge: NativeBridge) {}
  static available(): boolean {
    return typeof window !== 'undefined' && !!(window as any).MossyNative?.saveFile;
  }
  async read(k: string) { return this.bridge.loadFile(k) || null; }
  async write(k: string, d: string) {
    if (!this.bridge.saveFile(k, d)) throw new Error('native save failed');
  }
  async remove(k: string) { this.bridge.deleteFile(k); }
}

/** CRC32 for integrity checks. */
export function crc32(str: string): number {
  let c: number, crc = 0xffffffff;
  for (let n = 0; n < str.length; n++) {
    c = (crc ^ str.charCodeAt(n)) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface Envelope {
  app: 'mossy-meadows';
  v: number;
  ts: number;
  crc: number;
  data: string;
}

/** Migrations from older save versions. Each receives the raw object and returns the upgraded one. */
const MIGRATIONS: Record<number, (s: any) => any> = {
  1: (s) => ({ ...s, decorOwned: s.decorOwned ?? {}, version: 2 }),
  2: (s) => {
    s.weather = { current: s.weather?.today ?? 'sun', clearAt: 0, ...s.weather };
    s.version = 3;
    return s;
  },
};

/** Fill in any missing fields from a fresh game (forward-compatible, repairs partial saves). */
export function repair(raw: any): GameState {
  const base = createNewGame(raw?.player?.name, raw?.player?.farmName, raw?.player?.look, raw?.seed);
  const merge = (def: any, val: any): any => {
    if (val === undefined || val === null) return def;
    if (Array.isArray(def)) return Array.isArray(val) ? val : def;
    if (typeof def === 'object' && def !== null) {
      if (typeof val !== 'object' || Array.isArray(val)) return def;
      const out: any = { ...val };
      for (const k of Object.keys(def)) out[k] = merge(def[k], val[k]);
      return out;
    }
    return typeof val === typeof def ? val : def;
  };
  const s = merge(base, raw) as GameState;
  // never trust dynamic maps blindly
  if (!Array.isArray(s.inventory)) s.inventory = base.inventory;
  while (s.inventory.length < s.inventorySize) s.inventory.push(null);
  s.inventory = s.inventory.map((it) => (it && typeof it.id === 'string' && it.qty > 0 ? it : null));
  if (!Number.isFinite(s.player.coins) || s.player.coins < 0) s.player.coins = 0;
  if (!s.farm.placed.some((p) => p.kind === 'house')) s.farm.placed.unshift(base.farm.placed[0]);
  return s;
}

export function migrate(raw: any): GameState {
  let s = raw;
  let v = typeof s.version === 'number' ? s.version : 1;
  while (v < SAVE_VERSION && MIGRATIONS[v]) {
    s = MIGRATIONS[v](s);
    v = s.version ?? v + 1;
  }
  s.version = SAVE_VERSION;
  return repair(s);
}

export class SaveManager {
  readonly slot: string;
  private writing = false;
  private pending: GameState | null = null;
  saves = 0;
  lastError: string | null = null;
  cloud: CloudSyncProvider | null = null;

  constructor(public adapter: StorageAdapter, slot = 'mm_save_0', public backups = 2) {
    this.slot = slot;
  }

  static auto(): SaveManager {
    const native = AndroidFileAdapter.available() ? new AndroidFileAdapter((window as any).MossyNative) : null;
    return new SaveManager(native ?? (typeof localStorage !== 'undefined' ? new LocalStorageAdapter() : new MemoryAdapter()));
  }

  encode(state: GameState): string {
    state.savedAt = Date.now();
    const data = JSON.stringify(state);
    const env: Envelope = { app: 'mossy-meadows', v: SAVE_VERSION, ts: state.savedAt, crc: crc32(data), data };
    return JSON.stringify(env);
  }

  decode(text: string | null): GameState | null {
    if (!text) return null;
    try {
      const env = JSON.parse(text) as Envelope;
      if (env.app !== 'mossy-meadows' || typeof env.data !== 'string') return null;
      if (crc32(env.data) !== env.crc) {
        console.warn('[save] checksum mismatch');
        return null;
      }
      return migrate(JSON.parse(env.data));
    } catch (e) {
      console.warn('[save] decode failed', e);
      return null;
    }
  }

  /** Save with rotating backups. Writes are serialized; the latest state wins. */
  async save(state: GameState): Promise<boolean> {
    if (this.writing) {
      this.pending = state;
      return true;
    }
    this.writing = true;
    try {
      const text = this.encode(state);
      // rotate backups every 5 saves to limit writes on mobile flash
      if (this.saves % 5 === 0 && this.backups > 0) {
        for (let i = this.backups; i > 1; i--) {
          const prev = await this.adapter.read(`${this.slot}_bak${i - 1}`);
          if (prev) await this.adapter.write(`${this.slot}_bak${i}`, prev);
        }
        const cur = await this.adapter.read(this.slot);
        if (cur) await this.adapter.write(`${this.slot}_bak1`, cur);
      }
      await this.adapter.write(this.slot, text);
      this.saves++;
      this.lastError = null;
      if (this.cloud) this.cloud.push(this.slot, text).catch(() => undefined);
      return true;
    } catch (e: any) {
      this.lastError = String(e?.message ?? e);
      console.error('[save] failed', e);
      return false;
    } finally {
      this.writing = false;
      if (this.pending) {
        const p = this.pending;
        this.pending = null;
        await this.save(p);
      }
    }
  }

  /** Load the main slot, falling back to backups when corrupted. */
  async load(): Promise<GameState | null> {
    const keys = [this.slot, ...Array.from({ length: this.backups }, (_, i) => `${this.slot}_bak${i + 1}`)];
    let local: GameState | null = null;
    for (const k of keys) {
      const s = this.decode(await this.adapter.read(k));
      if (s) {
        if (k !== this.slot) console.warn(`[save] restored from backup ${k}`);
        local = s;
        break;
      }
    }
    if (this.cloud) {
      try {
        const remote = this.decode(await this.cloud.pull(this.slot));
        if (remote && (!local || remote.savedAt > local.savedAt)) return remote;
      } catch { /* offline: local wins */ }
    }
    return local;
  }

  async exists(): Promise<boolean> {
    return !!(await this.load());
  }

  async wipe(): Promise<void> {
    await this.adapter.remove(this.slot);
    for (let i = 1; i <= this.backups; i++) await this.adapter.remove(`${this.slot}_bak${i}`);
  }

  exportString(state: GameState): string {
    const text = this.encode(state);
    return btoa(unescape(encodeURIComponent(text)));
  }

  importString(code: string): GameState | null {
    try {
      return this.decode(decodeURIComponent(escape(atob(code.trim()))));
    } catch {
      return null;
    }
  }
}
