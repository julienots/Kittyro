import type { Ctx } from './Context';
import { STORY_TALK } from '../data/quests';
import { NPC_BY_ID, FRIEND_REWARDS } from '../data/npcs';
import { FRIEND_MAX, FRIEND_POINTS_PER_LEVEL, isNight, seasonOfDay } from '../data/constants';
import { item } from '../data/items';

export class NpcSystem {
  constructor(private ctx: Ctx) {}

  level(id: string): number {
    return Math.floor((this.ctx.state.npcs[id]?.friendship ?? 0) / FRIEND_POINTS_PER_LEVEL);
  }

  addFriendship(id: string, amount: number): void {
    const n = this.ctx.state.npcs[id];
    if (!n) return;
    const before = this.level(id);
    n.friendship = Math.max(0, Math.min(FRIEND_MAX, n.friendship + amount));
    const after = this.level(id);
    if (after > before) {
      for (const r of FRIEND_REWARDS[id] ?? []) {
        if (r.level > before && r.level <= after) {
          for (const [iid, q] of r.items ?? []) this.ctx.inventory.add(iid, q, true);
          if (r.gems) this.ctx.economy.addGems(r.gems);
          this.ctx.bus.emit('friend:reward', { npc: id, reward: r.reward });
        }
      }
      this.ctx.bus.emit('friend:level', { npc: id, level: after });
    }
    this.ctx.bus.emit('npcs:changed');
  }

  /** Talk to an NPC. Returns the line to display. */
  talk(id: string): string {
    const def = NPC_BY_ID[id];
    const n = this.ctx.state.npcs[id];
    if (!def || !n) return '...';
    const st = this.ctx.state;
    const first = !n.met;
    n.met = true;
    if (n.talkedDay !== st.time.day) {
      n.talkedDay = st.time.day;
      this.addFriendship(id, 10);
      this.ctx.progress('talk', id);
    }
    const story = st.quests.active.find((q) => q.kind === 'story' && !q.claimed);
    const sl = story ? STORY_TALK[story.id]?.[id] : undefined;
    if (sl) return sl;
    if (first) return def.lines[0][0];
    const tier = Math.min(3, Math.floor(this.level(id) / 3));
    const r = this.ctx.rng;
    if (st.weather.current === 'rain' || st.weather.current === 'storm') if (r.chance(0.4)) return def.rain;
    if (isNight(st.time.minute) && r.chance(0.5)) return def.night;
    if (seasonOfDay(st.time.day) === 'winter' && r.chance(0.3)) return def.winter;
    return r.pick(def.lines[tier]);
  }

  giftReaction(id: string, itemId: string): 'love' | 'like' | 'neutral' | 'dislike' {
    const def = NPC_BY_ID[id];
    if (def.loves.includes(itemId)) return 'love';
    if (def.likes.includes(itemId)) return 'like';
    if (def.dislikes.includes(itemId)) return 'dislike';
    return 'neutral';
  }

  canGift(id: string): boolean {
    return this.ctx.state.npcs[id]?.giftedDay !== this.ctx.state.time.day;
  }

  gift(id: string, itemId: string): { ok: boolean; reaction?: string; text?: string } {
    const n = this.ctx.state.npcs[id];
    const def = NPC_BY_ID[id];
    if (!n || !def) return { ok: false };
    if (!this.canGift(id)) return { ok: false, text: 'Tu m\'as déjà offert quelque chose aujourd\'hui. Merci encore !' };
    if (!this.ctx.inventory.remove(itemId, 1)) return { ok: false };
    n.giftedDay = this.ctx.state.time.day;
    n.giftsGiven++;
    n.met = true;
    const reaction = this.giftReaction(id, itemId);
    const pts = { love: 80, like: 45, neutral: 20, dislike: 0 }[reaction];
    this.addFriendship(id, pts);
    this.ctx.progress('gift', id);
    const name = item(itemId).name;
    const text = {
      love: `${name} ?! C'est exactement ce que j'adore ! Merci du fond du cœur !`,
      like: `Oh, ${name.toLowerCase()} ! C'est gentil, merci beaucoup !`,
      neutral: `Merci pour ${name.toLowerCase()}, c'est une attention adorable.`,
      dislike: `Hum... ${name.toLowerCase()}. Ce n'est pas trop mon truc, mais merci d'avoir pensé à moi.`,
    }[reaction];
    return { ok: true, reaction, text };
  }

  discount(id: string): number {
    const lv = this.level(id);
    if (id === 'mallow') return lv >= 6 ? 0.2 : lv >= 3 ? 0.1 : 0;
    return 0;
  }
}
