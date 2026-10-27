import * as THREE from 'three';
import { buildCharacter, type CharacterRig } from '../models/Character';
import { applyEmote, EMOTE_BY_ID } from './Emotes';
import { emojiSprite } from '../render/EmojiSprite';
import type { LocalNet, Peer } from '../net/LocalNet';

/** Name tag / chat bubble drawn on a canvas sprite. */
function textSprite(text: string, opts: { bg: string; fg: string; size: number; maxW?: number }): THREE.Sprite {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = `600 ${opts.size}px "Fredoka", ui-rounded, sans-serif`;
  g.font = font;
  // wrap long chat lines
  const maxW = opts.maxW ?? 1e9;
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  const lh = opts.size * 1.25;
  const tw = Math.min(maxW, Math.max(...lines.map((l) => g.measureText(l).width)));
  c.width = Math.ceil(tw + opts.size * 1.4);
  c.height = Math.ceil(lines.length * lh + opts.size * 0.9);
  g.font = font;
  g.fillStyle = opts.bg;
  const r = Math.min(c.height / 2, opts.size * 0.9);
  g.beginPath();
  g.roundRect(0, 0, c.width, c.height, r);
  g.fill();
  g.fillStyle = opts.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, c.width / 2, opts.size * 0.45 + lh * (i + 0.5)));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const k = 0.0095;
  s.scale.set(c.width * k * (opts.size / 40), c.height * k * (opts.size / 40), 1);
  s.renderOrder = 22;
  return s;
}

function disposeSprite(s: THREE.Sprite | null): void {
  if (!s) return;
  s.removeFromParent();
  s.material.map?.dispose();
  s.material.dispose();
}

interface Avatar {
  peer: Peer;
  rig: CharacterRig;
  group: THREE.Group;
  tag: THREE.Sprite;
  lookKey: string;
  name: string;
  pos: THREE.Vector3;
  facing: number;
  walkT: number;
  emote: string;
  emoteT: number;
  bubble: THREE.Sprite | null;
  bubbleT: number;
  icon: THREE.Sprite | null;
  iconT: number;
}

/**
 * The other players of a local game: their character (with their own clothes),
 * a name tag, walking animation, emotes and chat bubbles.
 */
export class RemotePlayers {
  readonly group = new THREE.Group();
  private avatars = new Map<string, Avatar>();

  constructor(private net: LocalNet, private region: () => string, private groundY: (x: number, z: number) => number) {
    this.group.name = 'remote_players';
  }

  private make(p: Peer): Avatar {
    const rig = buildCharacter(p.look, { outline: true });
    const group = new THREE.Group();
    group.add(rig.root);
    const tag = textSprite(p.name, { bg: 'rgba(255,248,236,0.92)', fg: '#5a4030', size: 40 });
    tag.position.y = 2.25;
    group.add(tag);
    this.group.add(group);
    const a: Avatar = { peer: p, rig, group, tag, lookKey: JSON.stringify(p.look), name: p.name, pos: new THREE.Vector3(p.x, 0, p.z), facing: p.facing, walkT: 0, emote: '', emoteT: 0, bubble: null, bubbleT: 0, icon: null, iconT: 0 };
    a.pos.y = this.groundY(p.x, p.z);
    this.avatars.set(p.id, a);
    return a;
  }

  private drop(id: string): void {
    const a = this.avatars.get(id);
    if (!a) return;
    a.group.removeFromParent();
    disposeSprite(a.tag);
    disposeSprite(a.bubble);
    a.icon?.removeFromParent();
    this.avatars.delete(id);
  }

  clear(): void {
    for (const id of [...this.avatars.keys()]) this.drop(id);
  }

  say(peerId: string, text: string): void {
    const a = this.avatars.get(peerId);
    if (!a) return;
    disposeSprite(a.bubble);
    a.bubble = textSprite(text, { bg: 'rgba(255,255,255,0.96)', fg: '#3a2a20', size: 34, maxW: 420 });
    a.bubble.position.y = 3.0;
    a.group.add(a.bubble);
    a.bubbleT = 6;
  }

  emote(peerId: string, id: string): void {
    const a = this.avatars.get(peerId);
    const def = EMOTE_BY_ID[id];
    if (!a || !def) return;
    a.emote = id;
    a.emoteT = 0;
    a.icon?.removeFromParent();
    a.icon = emojiSprite(def.icon, 0.7);
    a.icon.position.y = 2.6;
    a.group.add(a.icon);
    a.iconT = Math.min(3, def.dur);
  }

  /** Players standing near (x,z) in this region, for the "wave" prompt. */
  nearest(x: number, z: number, r: number): Peer | null {
    let best: Peer | null = null, bd = r;
    for (const a of this.avatars.values()) {
      if (!a.group.visible) continue;
      const d = Math.hypot(a.pos.x - x, a.pos.z - z);
      if (d < bd) { bd = d; best = a.peer; }
    }
    return best;
  }

  update(dt: number, fp: boolean): void {
    const region = this.region();
    for (const id of [...this.avatars.keys()]) if (!this.net.peers.has(id)) this.drop(id);
    for (const p of this.net.peers.values()) {
      let a = this.avatars.get(p.id);
      const key = JSON.stringify(p.look);
      if (a && (a.lookKey !== key || a.name !== p.name)) {
        // changed clothes or name: rebuild
        this.drop(p.id);
        a = undefined;
      }
      if (!a) a = this.make(p);
      const here = p.region === region;
      const wasHidden = !a.group.visible;
      a.group.visible = here;
      if (!here) continue;
      if (wasHidden) a.pos.set(p.x, this.groundY(p.x, p.z), p.z);
      // smooth towards the last known position
      const k = Math.min(1, dt * 10);
      a.pos.x += (p.x - a.pos.x) * k;
      a.pos.z += (p.z - a.pos.z) * k;
      a.pos.y = this.groundY(a.pos.x, a.pos.z);
      let df = p.facing - a.facing;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      a.facing += df * Math.min(1, dt * 12);
      a.group.position.copy(a.pos);
      a.rig.root.rotation.y = a.facing;
      a.tag.visible = !fp || Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 30;
      this.animate(a, dt);
      if (a.bubble) {
        a.bubbleT -= dt;
        a.bubble.material.opacity = Math.min(1, a.bubbleT);
        if (a.bubbleT <= 0) { disposeSprite(a.bubble); a.bubble = null; }
      }
      if (a.icon) {
        a.iconT -= dt;
        a.icon.position.y = 2.75 + Math.sin(a.iconT * 4) * 0.05 + (a.bubble ? 0.75 : 0);
        if (a.iconT <= 0) { a.icon.removeFromParent(); a.icon = null; }
      }
    }
  }

  private animate(a: Avatar, dt: number): void {
    const rig = a.rig, moving = a.peer.moving > 0.2;
    if (a.emote) {
      a.emoteT += dt;
      if (applyEmote(rig, a.emote, a.emoteT) && !moving) return;
      a.emote = '';
    }
    const damp = (v: number, t: number) => v + (t - v) * Math.min(1, dt * 10);
    if (moving) {
      a.walkT += dt * (4 + a.peer.moving * 1.9);
      const s = Math.sin(a.walkT);
      const ride = a.peer.riding;
      rig.legL.rotation.x = ride ? -0.9 : s * 0.75;
      rig.legR.rotation.x = ride ? -0.9 : -s * 0.75;
      rig.armL.rotation.x = -s * 0.65;
      rig.armR.rotation.x = s * 0.65;
      rig.body.position.y = Math.abs(Math.cos(a.walkT)) * 0.06;
      rig.body.rotation.x = 0.06;
    } else {
      for (const g of [rig.legL, rig.legR, rig.armL, rig.armR]) { g.rotation.x = damp(g.rotation.x, 0); g.rotation.z = damp(g.rotation.z, 0); }
      rig.body.rotation.set(damp(rig.body.rotation.x, 0), 0, 0);
      rig.body.position.y = Math.sin(performance.now() * 0.0022) * 0.012;
      rig.head.rotation.set(0, 0, Math.sin(performance.now() * 0.0007) * 0.04);
    }
  }
}
