import type { CharacterRig } from '../models/Character';

/**
 * Emotes: short procedural animations of the character rig plus an emoji bubble.
 * Shared by the player, the other players (local multiplayer) and the preview.
 */
export interface EmoteDef {
  id: string;
  icon: string;
  name: string;
  dur: number; // seconds (loops are cut at dur)
}

export const EMOTES: EmoteDef[] = [
  { id: 'wave', icon: '👋', name: 'Coucou', dur: 1.8 },
  { id: 'dance', icon: '💃', name: 'Danser', dur: 4 },
  { id: 'laugh', icon: '😂', name: 'Rire', dur: 2 },
  { id: 'love', icon: '❤️', name: 'Bisou', dur: 2 },
  { id: 'clap', icon: '👏', name: 'Bravo', dur: 2 },
  { id: 'thumbs', icon: '👍', name: 'Super', dur: 1.6 },
  { id: 'sad', icon: '😢', name: 'Triste', dur: 2.4 },
  { id: 'angry', icon: '😠', name: 'Fâché', dur: 1.8 },
  { id: 'think', icon: '🤔', name: 'Hmm…', dur: 2.4 },
  { id: 'jump', icon: '🎉', name: 'Youpi', dur: 1.6 },
  { id: 'sit', icon: '🧘', name: 'S\'asseoir', dur: 6 },
  { id: 'sleep', icon: '😴', name: 'Dodo', dur: 5 },
];
export const EMOTE_BY_ID: Record<string, EmoteDef> = Object.fromEntries(EMOTES.map((e) => [e.id, e]));

/** Pose the rig for emote `id` at time t (seconds). Returns false once finished. */
export function applyEmote(rig: CharacterRig, id: string, t: number): boolean {
  const def = EMOTE_BY_ID[id];
  if (!def || t >= def.dur) return false;
  const k = Math.min(1, t * 5) * Math.min(1, (def.dur - t) * 5); // ease in/out
  const s = (f: number) => Math.sin(t * f);
  const set = (o: { x: number; y: number; z: number }, x: number, y: number, z: number) => { o.x = x * k; o.y = y * k; o.z = z * k; };
  set(rig.armL.rotation, 0, 0, 0);
  set(rig.armR.rotation, 0, 0, 0);
  set(rig.legL.rotation, 0, 0, 0);
  set(rig.legR.rotation, 0, 0, 0);
  set(rig.head.rotation, 0, 0, 0);
  rig.body.rotation.set(0, 0, 0);
  rig.body.position.y = 0;
  switch (id) {
    case 'wave':
      set(rig.armR.rotation, 0, 0, 2.7 + s(14) * 0.35);
      set(rig.head.rotation, 0, 0, -0.12);
      break;
    case 'dance': {
      const b = s(9);
      rig.body.position.y = Math.abs(b) * 0.1 * k;
      rig.body.rotation.y = s(4.5) * 0.5 * k;
      set(rig.armL.rotation, -1.2 + b * 0.5, 0, -0.6);
      set(rig.armR.rotation, -1.2 - b * 0.5, 0, 0.6);
      set(rig.legL.rotation, Math.max(0, b) * 0.6, 0, 0);
      set(rig.legR.rotation, Math.max(0, -b) * 0.6, 0, 0);
      set(rig.head.rotation, 0, 0, b * 0.15);
      break;
    }
    case 'laugh':
      rig.body.rotation.x = (-0.15 + s(22) * 0.06) * k;
      set(rig.head.rotation, -0.35 + s(22) * 0.08, 0, 0);
      set(rig.armL.rotation, -0.4, 0, -0.3);
      set(rig.armR.rotation, -0.6, 0, 0.5);
      rig.body.position.y = Math.abs(s(22)) * 0.03 * k;
      break;
    case 'love':
      set(rig.armL.rotation, -2.0, 0, 0.5);
      set(rig.armR.rotation, -2.0, 0, -0.5);
      set(rig.head.rotation, 0.1, 0, s(3) * 0.15);
      rig.body.rotation.x = 0.1 * k;
      break;
    case 'clap': {
      const c = Math.abs(s(16));
      set(rig.armL.rotation, -1.4, 0, 0.35 + c * 0.35);
      set(rig.armR.rotation, -1.4, 0, -0.35 - c * 0.35);
      rig.body.position.y = c * 0.02 * k;
      break;
    }
    case 'thumbs':
      set(rig.armR.rotation, -1.6, 0, -0.2);
      set(rig.head.rotation, 0, 0, 0.12);
      break;
    case 'sad':
      rig.body.rotation.x = 0.25 * k;
      set(rig.head.rotation, 0.45, 0, s(2) * 0.05);
      set(rig.armL.rotation, -0.2, 0, -0.1);
      set(rig.armR.rotation, -0.2, 0, 0.1);
      break;
    case 'angry': {
      const a = s(20);
      set(rig.armL.rotation, -0.4, 0, -0.5 + a * 0.15);
      set(rig.armR.rotation, -0.4, 0, 0.5 - a * 0.15);
      rig.body.position.y = Math.abs(a) * 0.04 * k;
      set(rig.head.rotation, 0.15, 0, 0);
      set(rig.legR.rotation, Math.max(0, a) * 0.3, 0, 0);
      break;
    }
    case 'think':
      set(rig.armR.rotation, -2.3, 0, -0.4);
      set(rig.armL.rotation, -0.9, 0, 0.6);
      set(rig.head.rotation, -0.12, 0, 0.18 + s(1.5) * 0.05);
      break;
    case 'jump': {
      const j = Math.max(0, Math.sin(t * 7.8));
      rig.body.position.y = j * 0.45 * k;
      set(rig.armL.rotation, 0, 0, -2.6);
      set(rig.armR.rotation, 0, 0, 2.6);
      set(rig.legL.rotation, -j * 0.5, 0, 0);
      set(rig.legR.rotation, -j * 0.5, 0, 0);
      break;
    }
    case 'sit':
      rig.body.position.y = -0.22 * k;
      set(rig.legL.rotation, -1.5, 0, 0);
      set(rig.legR.rotation, -1.5, 0, 0);
      set(rig.armL.rotation, -0.5, 0, 0.1);
      set(rig.armR.rotation, -0.5, 0, -0.1);
      set(rig.head.rotation, s(0.8) * 0.06, 0, s(0.6) * 0.08);
      break;
    case 'sleep':
      rig.body.position.y = -0.22 * k;
      set(rig.legL.rotation, -1.5, 0, 0);
      set(rig.legR.rotation, -1.5, 0, 0);
      set(rig.head.rotation, 0.5, 0, 0.3);
      rig.body.rotation.x = (0.15 + s(1.4) * 0.02) * k;
      set(rig.armL.rotation, -0.3, 0, 0);
      set(rig.armR.rotation, -0.3, 0, 0);
      break;
  }
  return true;
}
