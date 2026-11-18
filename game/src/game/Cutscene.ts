import * as THREE from 'three';
import { h } from '../ui/dom';

/**
 * Tiny cut-scene player: letterbox bars, typed subtitles and scripted camera
 * moves. Each shot drives the camera from a function of its local time.
 */
export interface Shot {
  dur: number;
  text?: string;
  who?: string;
  /** big centred title card instead of a subtitle */
  title?: string;
  cam: (t: number, k: number) => { pos: THREE.Vector3; look: THREE.Vector3 };
  start?: () => void;
  tick?: (t: number, dt: number) => void;
}

export class Cutscene {
  private i = -1;
  private t = 0;
  private el: HTMLElement;
  private sub: HTMLElement;
  private who: HTMLElement;
  private titleEl: HTMLElement;
  private typed = 0;
  private done = false;
  private look = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private first = true;

  constructor(private root: HTMLElement, private camera: THREE.PerspectiveCamera, private shots: Shot[], private onEnd: () => void) {
    this.sub = h('div.cs-text');
    this.who = h('div.cs-who');
    this.titleEl = h('div.cs-title');
    this.el = h('div.cutscene', { onpointerdown: (e: Event) => e.stopPropagation() },
      h('div.cs-bar.top'),
      h('div.cs-bar.bottom', null, this.who, this.sub),
      this.titleEl,
      h('button.cs-skip', { onclick: (e: Event) => { e.stopPropagation(); this.finish(); } }, 'Passer ⏭'),
    );
    root.appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add('on'));
    this.next();
  }

  get active(): boolean {
    return !this.done;
  }

  private next(): void {
    this.i++;
    this.t = 0;
    this.first = true;
    this.typed = 0;
    const s = this.shots[this.i];
    if (!s) { this.finish(); return; }
    s.start?.();
    this.who.textContent = s.who ?? '';
    this.who.style.display = s.who ? '' : 'none';
    this.sub.textContent = '';
    this.titleEl.textContent = s.title ?? '';
    this.titleEl.classList.toggle('show', !!s.title);
  }

  private last = performance.now();
  update(_frameDt: number): void {
    if (this.done) return;
    // real time: slow devices must not stretch the scene
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    const s = this.shots[this.i];
    if (!s) return;
    this.t += dt;
    const k = Math.min(1, this.t / s.dur);
    s.tick?.(this.t, dt);
    const c = s.cam(this.t, k);
    // smooth camera (snap on the first frame of the scene)
    const a = this.first ? 1 : Math.min(1, dt * 4);
    this.first = false;
    this.camPos.lerp(c.pos, a);
    this.look.lerp(c.look, a);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.look);
    if (s.text) {
      this.typed = Math.min(s.text.length, this.typed + dt * 38);
      this.sub.textContent = s.text.slice(0, Math.floor(this.typed));
    }
    if (this.t >= s.dur) this.next();
  }

  finish(): void {
    if (this.done) return;
    this.done = true;
    this.el.classList.remove('on');
    setTimeout(() => this.el.remove(), 500);
    this.onEnd();
  }
}
