import type { Appearance } from '../state/types';
import { DEFAULT_LOOK } from '../state/newGame';

/**
 * Local multiplayer without a server.
 *  - Android app: one phone hosts over Wi-Fi (native window.KittyNet: TCP relay +
 *    UDP discovery), the others find it and join. Everything stays on the LAN.
 *  - Browser: tabs of the same browser meet through a BroadcastChannel (handy to
 *    try it on one computer).
 * Every player keeps their own farm and save; players see each other when they
 * are in the same region, chat and play emotes.
 */

interface NativeNet {
  isAvailable(): boolean;
  localIp(): string;
  host(name: string): boolean;
  scan(on: boolean): void;
  join(ip: string): void;
  send(to: number, line: string): void;
  stop(): void;
}

export interface Peer {
  id: string;
  name: string;
  farm: string;
  look: Appearance;
  region: string;
  x: number;
  z: number;
  facing: number;
  moving: number; // 0 idle, >0 walking speed
  riding: boolean;
  last: number; // performance.now() of the last message
}

export interface ChatLine {
  from: string;
  name: string;
  text: string;
  mine: boolean;
  at: number;
}

export type NetMode = 'off' | 'hosting' | 'joining' | 'connected';

export interface Me {
  name: string;
  farm: string;
  look: Appearance;
  region: string;
  x: number;
  z: number;
  facing: number;
  moving: number;
  riding: boolean;
}

type Msg =
  | { t: 'h'; f: string; n: string; fa: string; l: Appearance }
  | { t: 's'; f: string; r: string; x: number; z: number; y: number; m: number; rd: number }
  | { t: 'e'; f: string; id: string }
  | { t: 'c'; f: string; x: string }
  | { t: 'w' }
  | { t: 'b'; f: string };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, lo: number, hi: number, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

/** Never trust a look coming from the network: copy known fields with safe types only. */
export function cleanLook(raw: unknown): Appearance {
  const out: Appearance = { ...DEFAULT_LOOK };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_LOOK) as (keyof Appearance)[]) {
    const v = r[k], d = DEFAULT_LOOK[k];
    if (typeof d === 'number' && typeof v === 'number' && Number.isFinite(v)) (out as any)[k] = Math.max(0, Math.min(0xffffff, Math.floor(v)));
    else if (typeof d === 'string' && typeof v === 'string') (out as any)[k] = v.slice(0, 24);
    else if (typeof d === 'boolean' && typeof v === 'boolean') (out as any)[k] = v;
  }
  for (const k of ['brow', 'mouth', 'facialHair'] as const) if (typeof r[k] === 'number') out[k] = num(r[k], 0, 40);
  for (const k of ['freckles', 'lashes'] as const) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  if (typeof r.height === 'number') out.height = num(r.height, 0.92, 1.08, 1);
  return out;
}

export class LocalNet {
  mode: NetMode = 'off';
  transport: 'lan' | 'tab' | null = null;
  readonly myId = Math.random().toString(36).slice(2, 10);
  readonly peers = new Map<string, Peer>();
  readonly found = new Map<string, { name: string; seen: number }>();
  readonly chat: ChatLine[] = [];
  hostIp = '';
  /** UI hooks */
  onChange: () => void = () => {};
  onChat: (line: ChatLine) => void = () => {};
  onEmote: (peer: Peer, id: string) => void = () => {};
  onToast: (text: string, icon: string) => void = () => {};

  private native: NativeNet | null = (window as any).KittyNet ?? null;
  private bc: BroadcastChannel | null = null;
  private nativeToPeer = new Map<number, string>();
  private sendT = 0;
  private helloT = 0;
  private lastSent = '';

  constructor(private me: () => Me) {
    (window as any).__kittyNet = (json: string) => {
      try {
        this.onNative(JSON.parse(json));
      } catch {
        /* ignore malformed events */
      }
    };
  }

  /** Wi-Fi play needs the Android app. */
  get lanAvailable(): boolean {
    try {
      return !!this.native?.isAvailable();
    } catch {
      return false;
    }
  }

  get active(): boolean {
    return this.mode !== 'off';
  }

  localIp(): string {
    try {
      return this.native?.localIp() ?? '';
    } catch {
      return '';
    }
  }

  // ------------------------------------------------------------ sessions
  host(): boolean {
    this.leave(false);
    if (!this.native) return false;
    if (!this.native.host(this.me().name)) {
      this.onToast('Impossible d\'héberger (réseau Wi-Fi ?)', '⚠️');
      return false;
    }
    this.transport = 'lan';
    this.mode = 'hosting';
    this.hostIp = this.localIp();
    this.onChange();
    return true;
  }

  scan(on: boolean): void {
    this.native?.scan(on);
  }

  join(ip: string): void {
    this.leave(false);
    if (!this.native) return;
    this.transport = 'lan';
    this.mode = 'joining';
    this.hostIp = ip;
    this.native.join(ip.trim());
    this.onChange();
  }

  /** Same-browser play (tabs), mostly to try it on a computer. */
  joinTabs(): void {
    this.leave(false);
    if (typeof BroadcastChannel === 'undefined') return;
    this.bc = new BroadcastChannel('kittyro-local');
    this.bc.onmessage = (e) => this.receive(String(e.data));
    this.transport = 'tab';
    this.mode = 'connected';
    this.broadcast({ t: 'w' });
    this.sendHello();
    this.onChange();
  }

  leave(notify = true): void {
    if (this.mode !== 'off') this.broadcast({ t: 'b', f: this.myId });
    try {
      this.native?.stop();
    } catch {
      /* already stopped */
    }
    this.bc?.close();
    this.bc = null;
    const was = this.mode;
    this.mode = 'off';
    this.transport = null;
    this.peers.clear();
    this.nativeToPeer.clear();
    if (notify && was !== 'off') this.onToast('Partie locale terminée', '👋');
    this.onChange();
  }

  // ------------------------------------------------------------ outgoing
  private broadcast(m: Msg): void {
    const line = JSON.stringify(m);
    if (this.bc) this.bc.postMessage(line);
    else if (this.native && this.mode !== 'off' && this.mode !== 'joining') this.native.send(-1, line);
  }

  private sendHello(): void {
    const me = this.me();
    this.broadcast({ t: 'h', f: this.myId, n: me.name.slice(0, 24), fa: me.farm.slice(0, 32), l: me.look });
  }

  sendEmote(id: string): void {
    if (this.mode === 'off') return;
    this.broadcast({ t: 'e', f: this.myId, id });
  }

  say(text: string): void {
    const t = text.trim().slice(0, 120);
    if (!t) return;
    const line: ChatLine = { from: this.myId, name: this.me().name, text: t, mine: true, at: Date.now() };
    this.pushChat(line);
    if (this.mode !== 'off') this.broadcast({ t: 'c', f: this.myId, x: t });
  }

  /** Called every frame: position updates ~8 times per second, hello every 4 s. */
  update(dt: number): void {
    if (this.mode === 'off' || this.mode === 'joining') return;
    this.sendT -= dt;
    this.helloT -= dt;
    if (this.helloT <= 0) {
      this.helloT = 4;
      this.sendHello();
    }
    if (this.sendT <= 0) {
      this.sendT = 0.125;
      const me = this.me();
      const m: Msg = { t: 's', f: this.myId, r: me.region, x: +me.x.toFixed(2), z: +me.z.toFixed(2), y: +me.facing.toFixed(2), m: +me.moving.toFixed(1), rd: me.riding ? 1 : 0 };
      const key = `${m.r}|${m.x}|${m.z}|${m.y}|${m.m}|${m.rd}`;
      // idle players only repeat themselves once a second
      if (key !== this.lastSent || this.helloT % 1 < 0.13) {
        this.lastSent = key;
        this.broadcast(m);
      }
    }
    const now = performance.now();
    for (const [id, p] of this.peers) {
      if (now - p.last > 9000) {
        this.peers.delete(id);
        this.onToast(`${p.name} est parti(e)`, '👋');
        this.onChange();
      }
    }
    for (const [ip, f] of this.found) if (now - f.seen > 5000) { this.found.delete(ip); this.onChange(); }
  }

  // ------------------------------------------------------------ incoming
  private onNative(ev: Record<string, unknown>): void {
    switch (ev.e) {
      case 'hosting':
        this.hostIp = str(ev.ip, 40) || this.hostIp;
        this.onChange();
        break;
      case 'peer': // host: someone connected, ask everybody to introduce themselves
        this.native?.send(-1, JSON.stringify({ t: 'w' }));
        this.sendHello();
        break;
      case 'gone': {
        const pid = this.nativeToPeer.get(num(ev.id, -1, 1e9, -1));
        if (pid) {
          this.nativeToPeer.delete(num(ev.id, -1, 1e9, -1));
          this.dropPeer(pid);
          this.broadcast({ t: 'b', f: pid });
        }
        break;
      }
      case 'connected':
        this.mode = 'connected';
        this.onToast('Connecté à la partie !', '🤝');
        this.sendHello();
        this.onChange();
        break;
      case 'closed':
        if (this.mode !== 'off') {
          this.mode = 'off';
          this.transport = null;
          this.peers.clear();
          this.onToast('L\'hôte a quitté la partie', '📴');
          this.onChange();
        }
        break;
      case 'error':
        this.onToast(ev.msg === 'connect' ? 'Connexion impossible : même Wi-Fi ? Hôte toujours ouvert ?' : ev.msg === 'ip' ? 'Adresse IP invalide' : 'Erreur réseau', '⚠️');
        if (this.mode === 'joining') this.mode = 'off';
        this.onChange();
        break;
      case 'found': {
        const ip = str(ev.ip, 40);
        if (!ip) break;
        const isNew = !this.found.has(ip);
        this.found.set(ip, { name: str(ev.name, 40) || 'Partie', seen: performance.now() });
        if (isNew) this.onChange();
        break;
      }
      case 'msg': {
        const line = str(ev.d, 16384);
        const nid = num(ev.id, -1, 1e9, -1);
        // the host relays every message to the other players
        if (this.mode === 'hosting' && nid > 0) {
          this.native?.send(-(nid + 2), line);
          try {
            const f = JSON.parse(line)?.f;
            if (typeof f === 'string' && !this.nativeToPeer.has(nid)) this.nativeToPeer.set(nid, f.slice(0, 16));
          } catch {
            /* ignore */
          }
        }
        this.receive(line);
        break;
      }
    }
  }

  private receive(line: string): void {
    let m: any;
    try {
      m = JSON.parse(line);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'w') {
      this.sendHello();
      return;
    }
    const f = str(m.f, 16);
    if (!f || f === this.myId) return;
    const now = performance.now();
    let p = this.peers.get(f);
    switch (m.t) {
      case 'h': {
        const isNew = !p;
        if (!p) {
          p = { id: f, name: '', farm: '', look: cleanLook(null), region: '', x: 0, z: 0, facing: 0, moving: 0, riding: false, last: now };
          this.peers.set(f, p);
        }
        p.name = str(m.n, 24) || 'Ami·e';
        p.farm = str(m.fa, 32);
        p.look = cleanLook(m.l);
        p.last = now;
        if (isNew) {
          this.onToast(`${p.name} a rejoint la partie`, '🎉');
          this.onChange();
        }
        break;
      }
      case 's':
        if (!p) return; // wait for the hello
        p.region = str(m.r, 20);
        p.x = num(m.x, -50, 200);
        p.z = num(m.z, -50, 200);
        p.facing = num(m.y, -10, 10);
        p.moving = num(m.m, 0, 20);
        p.riding = m.rd === 1;
        p.last = now;
        break;
      case 'e':
        if (!p) return;
        p.last = now;
        this.onEmote(p, str(m.id, 16));
        break;
      case 'c': {
        if (!p) return;
        const text = str(m.x, 120).trim();
        if (!text) return;
        p.last = now;
        this.pushChat({ from: f, name: p.name, text, mine: false, at: Date.now() });
        break;
      }
      case 'b':
        this.dropPeer(f);
        break;
    }
  }

  private dropPeer(id: string): void {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    this.onToast(`${p.name} est parti(e)`, '👋');
    this.onChange();
  }

  private pushChat(line: ChatLine): void {
    this.chat.push(line);
    if (this.chat.length > 50) this.chat.shift();
    this.onChat(line);
  }
}
