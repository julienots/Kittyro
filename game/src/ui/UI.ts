import * as THREE from 'three';
import './styles.css';
import { h, fmt } from './dom';
import type { GameApi } from './types';
import { formatClock, seasonOfDay, dayOfSeason, SEASON_ICONS, SEASON_NAMES, xpForLevel, yearOfDay, TOOL_TIERS } from '../data/constants';
import { WEATHER_ICONS, WEATHER_NAMES } from '../systems/Weather';
import { TOOL_BY_ID } from '../data/tools';
import { item } from '../data/items';
import { BUFF_ICONS } from '../data/recipes';
import { objectiveText } from '../systems/Quests';
import { NPC_BY_ID } from '../data/npcs';
import { FRIEND_POINTS_PER_LEVEL } from '../data/constants';
import type { ToolId } from '../state/types';
import { openPanel as openPanelImpl } from './panels';

export interface ActionInfo {
  icon: string;
  label: string;
  enabled: boolean;
}

interface FloatItem {
  el: HTMLElement;
  pos: THREE.Vector3;
  t: number;
  life: number;
}

/**
 * The whole HTML UI: HUD, panels, dialogues, toasts and floating texts.
 * Large rounded touch targets, everything reachable with the thumbs.
 */
export class UI {
  root: HTMLElement;
  private hud!: HTMLElement;
  private clockEl!: HTMLElement;
  private coinsEl!: HTMLElement;
  private gemsEl!: HTMLElement;
  private trackerEl!: HTMLElement;
  private buffsEl!: HTMLElement;
  actBtn!: HTMLButtonElement;
  toolBtn!: HTMLButtonElement;
  private seedBtn!: HTMLButtonElement;
  private rideBtn!: HTMLButtonElement;
  private waterMeter!: HTMLElement;
  private toastsEl!: HTMLElement;
  private floatsEl!: HTMLElement;
  private faderEl!: HTMLElement;
  private fpsEl!: HTMLElement;
  private badgeQuests!: HTMLElement;
  private joyHint!: HTMLElement;
  private floats: FloatItem[] = [];
  private hudT = 0;
  overlay: HTMLElement | null = null;
  panelName = '';
  dialogueEl: HTMLElement | null = null;
  private wheel: HTMLElement | null = null;
  onAction: (() => void) | null = null;
  onTool: (() => void) | null = null;
  private revealQueue: (() => HTMLElement)[] = [];
  private revealOpen = false;
  modalOpen = false;

  constructor(public g: GameApi) {
    this.root = document.getElementById('ui')!;
    this.toastsEl = h('div.toasts');
    this.floatsEl = h('div.floats');
    this.faderEl = h('div.fader');
    this.fpsEl = h('div.fps.hidden');
    this.root.append(this.floatsEl, this.toastsEl, this.faderEl, this.fpsEl);
  }

  // ------------------------------------------------------------ HUD
  buildHud(): void {
    this.hud?.remove();
    const g = this.g;
    this.clockEl = h('div.card.clock');
    this.trackerEl = h('div.card.tracker', { onclick: () => this.openPanel('quests') });
    this.buffsEl = h('div.buffs');
    this.coinsEl = h('span', null, '0');
    this.gemsEl = h('span', null, '0');
    this.badgeQuests = h('span.badge.hidden', null, '!');
    const btn = (icon: string, title: string, fn: () => void, extra?: HTMLElement) => h('button.icon-btn', { title, onclick: (e: Event) => { e.stopPropagation(); g.audio.play('click'); fn(); } }, icon, extra);
    this.actBtn = <HTMLButtonElement>h('button.act-btn.idle', null, h('span.ic', null, '✋'), h('span.lbl', null, ''));
    const press = (el: HTMLElement, fn: () => void) => {
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        el.classList.add('pressed');
        fn();
      });
      el.addEventListener('pointerup', () => el.classList.remove('pressed'));
      el.addEventListener('pointerleave', () => el.classList.remove('pressed'));
    };
    press(this.actBtn, () => this.onAction?.());
    this.toolBtn = <HTMLButtonElement>h('button.tool-btn', null, h('span.ic', null, '⛏'), h('span.tier', null, ''));
    let longT: number | null = null;
    this.toolBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      longT = window.setTimeout(() => {
        longT = null;
        this.toggleToolWheel(true);
      }, 380);
    });
    this.toolBtn.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (longT !== null) {
        clearTimeout(longT);
        longT = null;
        if (this.wheel) this.toggleToolWheel(false);
        else this.onTool?.();
      }
    });
    this.seedBtn = <HTMLButtonElement>h('button.seed-btn', { onclick: (e: Event) => { e.stopPropagation(); this.openPanel('seeds'); } }, '🌱', h('span.q', null, '0'));
    this.rideBtn = <HTMLButtonElement>h('button.ride-btn.hidden', { onclick: (e: Event) => { e.stopPropagation(); g.toggleRide(); } }, '🐴');
    this.waterMeter = h('div.water-meter', null, h('i'));
    this.joyHint = h('div.joy-hint', null, 'Glisser');
    this.hud = h('div.hud.passthrough', { style: { position: 'absolute', inset: '0' } },
      h('div.hud-top-left', null, this.clockEl, this.trackerEl, this.buffsEl),
      h('div.hud-top-right', null,
        h('div.money', null, h('div.pill', { onclick: () => this.openPanel('pass') }, '🪙', this.coinsEl), h('div.pill', { onclick: () => this.openPanel('shop', 'boutique') }, '💎', this.gemsEl)),
        h('div.menu-row', null,
          btn('🎒', 'Sac', () => this.openPanel('inventory')),
          btn('📜', 'Quêtes', () => this.openPanel('quests'), this.badgeQuests),
          btn('🔨', 'Construire', () => this.openPanel('build')),
          btn('🗺️', 'Carte', () => this.openPanel('map')),
          h('button.icon-btn.view-btn', { title: 'Vue 1ʳᵉ personne / vue d\'ensemble (V)', onclick: (e: Event) => { e.stopPropagation(); g.toggleView(); } }, '👁️'),
          btn('📖', 'Collections', () => this.openPanel('collections')),
          btn('⚙️', 'Menu', () => this.openPanel('settings')),
        ),
      ),
      h('div.hud-actions', null, this.actBtn, this.toolBtn, this.seedBtn, this.rideBtn, this.waterMeter),
      h('div.fp-vignette'),
      h('div.crosshair'),
      this.joyHint,
    );
    // pointer events on interactive children only
    for (const el of this.hud.querySelectorAll('button, .card, .pill')) (el as HTMLElement).style.pointerEvents = 'auto';
    this.root.appendChild(this.hud);
    this.applyLayout();
    this.refreshHud(true);
  }

  applyLayout(): void {
    const s = this.g.settings;
    this.root.classList.toggle('left-handed', s.leftHanded);
    this.joyHint?.classList.toggle('hidden', s.controls === 'tap' || this.g.ctx.state.stats.walked > 200);
    this.fpsEl?.classList.toggle('hidden', !s.showFps);
  }

  setHudVisible(v: boolean): void {
    if (this.hud) this.hud.style.display = v ? '' : 'none';
  }

  refreshHud(force = false): void {
    const st = this.g.ctx.state;
    const season = seasonOfDay(st.time.day);
    const w = st.weather.current;
    const fest = this.g.ctx.festivals.active();
    this.clockEl.replaceChildren(
      h('span.ico', null, w === 'sun' && (st.time.minute >= 1200 || st.time.minute < 330) ? '🌙' : WEATHER_ICONS[w]),
      h('div', null,
        h('div.big', null, formatClock(st.time.minute)),
        h('div.sub', null, `${SEASON_ICONS[season]} ${SEASON_NAMES[season]} ${dayOfSeason(st.time.day)} · An ${yearOfDay(st.time.day)}`),
        fest ? h('div.sub', { style: { color: '#e06a8a', fontWeight: '600' } }, `${fest.icon} ${fest.name}`) : null,
      ),
      h('div', { style: { marginLeft: '4px', textAlign: 'center' } }, h('div', { style: { fontSize: '13px', fontWeight: '600' } }, `Nv ${st.player.level}`), h('div.progress', { style: { width: '46px', height: '6px' } }, h('i', { style: { width: `${(st.player.xp / xpForLevel(st.player.level)) * 100}%` } }))),
    );
    this.coinsEl.textContent = fmt(st.player.coins);
    this.gemsEl.textContent = fmt(st.player.gems);
    // quest tracker: story first, else first unfinished quest
    const q = this.g.ctx.quests.active.find((a) => a.kind === 'story' && !a.claimed) ?? this.g.ctx.quests.active.find((a) => !a.done);
    if (q) {
      const o = q.objectives.find((x) => x.progress < x.count) ?? q.objectives[0];
      const pct = Math.min(100, (o.progress / o.count) * 100);
      this.trackerEl.replaceChildren(h('b', null, `${q.kind === 'story' ? '⭐ ' : ''}${q.title}`), q.done ? h('span', { style: { color: '#4fb886', fontWeight: '600' } }, '✓ Terminé ! Touchez pour réclamer') : h('span', null, `${objectiveText(o)} — ${o.progress}/${o.count}`), h('div.bar', null, h('i', { style: { width: `${q.done ? 100 : pct}%` } })));
      this.trackerEl.classList.remove('hidden');
    } else this.trackerEl.classList.add('hidden');
    const claim = this.g.ctx.quests.claimableCount();
    this.badgeQuests.textContent = String(claim);
    this.badgeQuests.classList.toggle('hidden', claim === 0);
    // buffs
    const buffs = Object.entries(st.player.buffs).filter(([, until]) => until > st.absMinute);
    this.buffsEl.replaceChildren(...buffs.map(([id, until]) => h('span.buff', null, `${BUFF_ICONS[id] ?? '✨'} ${Math.ceil((until - st.absMinute) / 60)}h`)));
    // tool & seeds
    const tool = st.player.activeTool;
    const td = TOOL_BY_ID[tool];
    (this.toolBtn.querySelector('.ic') as HTMLElement).textContent = td.icon;
    (this.toolBtn.querySelector('.tier') as HTMLElement).textContent = td.name;
    this.toolBtn.title = `${td.name} (${TOOL_TIERS[st.player.tools[tool]]}) — appui long : changer d'outil`;
    const seeds = this.g.ctx.inventory.seeds();
    const sel = st.player.selectedSeed;
    const selQty = sel ? this.g.ctx.inventory.count(sel) : 0;
    this.seedBtn.firstChild!.textContent = sel && selQty ? item(sel.replace('seed_', '')).icon : '🌱';
    (this.seedBtn.querySelector('.q') as HTMLElement).textContent = String(sel && selQty ? selQty : seeds.reduce((a, s) => a + s.qty, 0));
    this.seedBtn.classList.toggle('hidden', seeds.length === 0);
    const hasHorse = st.animals.some((a) => a.species === 'horse');
    this.rideBtn.classList.toggle('hidden', !hasHorse || this.g.regionId === 'house' || this.g.regionId === 'mine');
    this.rideBtn.textContent = st.player.riding ? '🚶' : '🐴';
    const cap = this.g.ctx.tools.capacity();
    (this.waterMeter.firstChild as HTMLElement).style.width = `${Math.min(100, (this.g.ctx.tools.water / cap) * 100)}%`;
    this.waterMeter.classList.toggle('hidden', tool !== 'can' || cap > 9000);
    void force;
  }

  setAction(a: ActionInfo): void {
    (this.actBtn.querySelector('.ic') as HTMLElement).textContent = a.icon;
    (this.actBtn.querySelector('.lbl') as HTMLElement).textContent = a.label;
    this.actBtn.classList.toggle('idle', !a.enabled);
  }

  toggleToolWheel(open: boolean): void {
    this.wheel?.remove();
    this.wheel = null;
    if (!open) return;
    const st = this.g.ctx.state;
    const tools: ToolId[] = ['hoe', 'can', 'sickle', 'axe', 'pickaxe', 'rod'];
    this.wheel = h('div.card.tool-wheel', null, ...tools.map((t) => h(`button${st.player.activeTool === t ? '.on' : ''}`, {
      onclick: (e: Event) => {
        e.stopPropagation();
        this.g.selectTool(t);
        this.toggleToolWheel(false);
      },
    }, TOOL_BY_ID[t].icon, h('small', null, TOOL_BY_ID[t].name))));
    this.root.appendChild(this.wheel);
  }

  update(dt: number): void {
    this.hudT -= dt;
    if (this.hudT <= 0 && this.hud) {
      this.hudT = 0.25;
      this.refreshHud();
      if (this.g.settings.showFps) this.fpsEl.textContent = this.g.fps();
    }
    // floating texts projected from world positions
    const cam = this.g.camera;
    const w = window.innerWidth, hgt = window.innerHeight;
    const v = new THREE.Vector3();
    for (const f of this.floats) {
      f.t += dt;
      v.copy(f.pos);
      v.y += f.t * 1.1;
      v.project(cam);
      f.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      f.el.style.top = `${(-v.y * 0.5 + 0.5) * hgt}px`;
      const k = f.t / f.life;
      f.el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      f.el.style.transform = `translate(-50%,-50%) scale(${k < 0.15 ? 0.6 + k * 2.7 : 1})`;
    }
    for (const f of this.floats.filter((x) => x.t >= x.life)) f.el.remove();
    this.floats = this.floats.filter((x) => x.t < x.life);
  }

  float(pos: THREE.Vector3, text: string, emoji = '', life = 1.3): void {
    const el = h('div.float', null, emoji ? h('span.em', null, emoji) : null, ' ', text);
    this.floatsEl.appendChild(el);
    this.floats.push({ el, pos: pos.clone(), t: 0, life });
    if (this.floats.length > 24) {
      const old = this.floats.shift()!;
      old.el.remove();
    }
  }

  toast(text: string, icon = '✨', kind: 'info' | 'good' | 'warn' = 'info'): void {
    if (!this.toastsEl) return;
    const el = h(`div.toast.${kind}`, null, h('span', null, icon), h('span', null, text));
    this.toastsEl.appendChild(el);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstChild!.remove();
    setTimeout(() => {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(() => el.remove(), 450);
    }, 2600);
  }

  async fade(fn: () => void | Promise<void>, text = '', night = false): Promise<void> {
    this.faderEl.textContent = text;
    this.faderEl.classList.toggle('night', night);
    this.faderEl.classList.add('on');
    await new Promise((r) => setTimeout(r, 380));
    await fn();
    await new Promise((r) => setTimeout(r, text ? 900 : 150));
    this.faderEl.classList.remove('on');
  }

  // ------------------------------------------------------------ panels
  openPanel(name: string, ...args: any[]): void {
    this.closeDialogue();
    this.toggleToolWheel(false);
    openPanelImpl(this, name, ...args);
  }

  showPanel(name: string, title: string, body: any, opts: { tabs?: HTMLElement; size?: 'narrow' | 'wide'; onClose?: () => void; headExtra?: HTMLElement } = {}): HTMLElement {
    this.closePanel(false);
    this.panelName = name;
    const close = () => this.closePanel();
    const panel = h(`div.panel${opts.size ? `.${opts.size}` : ''}`, { onpointerdown: (e: Event) => e.stopPropagation() },
      h('div.panel-head', null, h('h2', null, title), opts.headExtra ?? null, h('button.x', { onclick: close }, '✕')),
      opts.tabs ?? null,
      h('div.panel-body', null, ...(Array.isArray(body) ? body : [body]).filter(Boolean)),
    );
    this.overlay = h('div.overlay', { onpointerdown: (e: Event) => { if (e.target === this.overlay) close(); } }, panel);
    (this.overlay as any).__onClose = opts.onClose;
    this.root.appendChild(this.overlay);
    this.modalOpen = true;
    this.g.setPaused(true);
    this.g.audio.play('open');
    return panel;
  }

  /** Replace body content of the open panel (for tab switches & refresh). */
  setPanelBody(...nodes: any[]): void {
    const body = this.overlay?.querySelector('.panel-body');
    if (!body) return;
    const scroll = body.scrollTop;
    body.replaceChildren(...nodes.filter(Boolean));
    body.scrollTop = scroll;
  }

  closePanel(sound = true): void {
    if (!this.overlay) return;
    const cb = (this.overlay as any).__onClose as (() => void) | undefined;
    this.overlay.remove();
    this.overlay = null;
    this.panelName = '';
    this.modalOpen = false;
    this.g.setPaused(false);
    if (sound) this.g.audio.play('close');
    cb?.();
    this.nextReveal();
  }

  // ------------------------------------------------------------ dialogue
  dialogue(npc: string | { name: string; role: string; meter: string }, text: string, options: { label: string; cls?: string; fn: () => void }[]): void {
    this.closeDialogue();
    let who: { name: string; role: string; meter: string };
    if (typeof npc === 'string') {
      const def = NPC_BY_ID[npc];
      const st = this.g.ctx.state.npcs[npc];
      const lvl = Math.floor((st?.friendship ?? 0) / FRIEND_POINTS_PER_LEVEL);
      who = { name: def?.name ?? npc, role: def?.role ?? '', meter: '🍃'.repeat(Math.min(10, lvl)) + '·'.repeat(Math.max(0, 10 - lvl)) };
    } else who = npc;
    const p = h('p', null, '');
    this.dialogueEl = h('div.dialogue', { onpointerdown: (e: Event) => e.stopPropagation() },
      h('div.who', null, h('b', null, who.name), h('span.role', null, who.role), h('span.leaves', { title: 'Amitié' }, who.meter)),
      p,
      h('div.opts', null, ...options.map((o) => h(`button.btn.small${o.cls ? `.${o.cls}` : ''}`, { onclick: () => { this.g.audio.play('click'); o.fn(); } }, o.label))),
    );
    this.root.appendChild(this.dialogueEl);
    this.g.setPaused(true);
    // typewriter
    let i = 0;
    const tick = () => {
      if (!this.dialogueEl || !p.isConnected) return;
      i += 2;
      p.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(tick, 18);
    };
    tick();
    this.dialogueEl.addEventListener('click', () => (p.textContent = text), { once: true });
  }

  closeDialogue(): void {
    if (!this.dialogueEl) return;
    this.dialogueEl.remove();
    this.dialogueEl = null;
    if (!this.overlay) this.g.setPaused(false);
  }

  // ------------------------------------------------------------ reveal cards (queued)
  reveal(make: () => HTMLElement): void {
    this.revealQueue.push(make);
    if (!this.overlay && !this.revealOpen) this.nextReveal();
  }

  private nextReveal(): void {
    if (this.overlay || this.dialogueEl) return;
    const make = this.revealQueue.shift();
    if (!make) {
      this.revealOpen = false;
      return;
    }
    this.revealOpen = true;
    const body = make();
    this.showPanel('reveal', '', h('div.reveal', null, body, h('div', { style: { marginTop: '14px' } }, h('button.btn', { onclick: () => this.closePanel() }, 'Super !'))), { size: 'narrow', onClose: () => { this.revealOpen = false; } });
  }

  confirm(text: string, yes: () => void, yesLabel = 'Oui', noLabel = 'Non'): void {
    this.showPanel('confirm', '', h('div.center', null, h('p', { style: { fontSize: '18px' } }, text), h('div.row', { style: { justifyContent: 'center' } }, h('button.btn.ghost', { onclick: () => this.closePanel() }, noLabel), h('button.btn', { onclick: () => { this.closePanel(); yes(); } }, yesLabel))), { size: 'narrow' });
  }

  // ------------------------------------------------------------ one-time tips
  private tipEl: HTMLElement | null = null;
  /** Show a friendly tip once per save (can be turned off in the menu). */
  tip(id: string, icon: string, title: string, text: string): void {
    const st = this.g.ctx.state;
    if (!this.g.settings.tips) return;
    const seen: string[] = Array.isArray(st.flags.tips) ? st.flags.tips : (st.flags.tips = []);
    if (seen.includes(id)) return;
    seen.push(id);
    this.tipEl?.remove();
    const el = h('div.tip-card', { onpointerdown: (e: Event) => e.stopPropagation() }, h('span.em', null, icon), h('div', null, h('b', null, title), h('p', null, text)), h('button.btn.small', { onclick: () => el.remove() }, 'OK'));
    this.tipEl = el;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 16000);
  }

  confetti(): void {
    const c = h('div.confetti');
    const colors = ['#ff8fab', '#ffd166', '#7fd1a8', '#8fd3ff', '#b9a3ff'];
    for (let i = 0; i < 60; i++) c.appendChild(h('i', { style: { left: `${Math.random() * 100}%`, background: colors[i % 5], animationDelay: `${Math.random() * 0.8}s` } }));
    this.root.appendChild(c);
    setTimeout(() => c.remove(), 3500);
  }
}
