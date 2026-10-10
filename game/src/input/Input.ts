import type { ControlMode } from '../save/Settings';

/**
 * Mobile-first input: optional floating joystick (left side), optional
 * tap-to-move, pinch/wheel zoom, and keyboard for desktop testing.
 * UI elements stop their own events, so the canvas only sees world input.
 */
export class Input {
  moveX = 0; // screen space: right +
  moveY = 0; // screen space: up +
  mode: ControlMode = 'both';
  onTap: ((nx: number, ny: number, sx: number, sy: number) => void) | null = null;
  onZoom: ((delta: number) => void) | null = null;
  onKey: ((key: string) => void) | null = null;
  onDrag: ((nx: number, ny: number, phase: 'start' | 'move' | 'end') => void) | null = null;
  /** one-finger drag outside the joystick (or mouse drag): turn the camera / look around */
  onLook: ((dx: number, dy: number) => void) | null = null;
  /** when true, single-finger drags go to onDrag (placement mode) instead of the joystick */
  dragMode = false;
  enabled = true;
  leftHanded = false;
  private keys = new Set<string>();
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; moved: boolean; lx: number; ly: number }>();
  private pinchDist = 0;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;

  constructor(private canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    uiRoot.appendChild(this.base);
    canvas.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.onZoom?.(e.deltaY > 0 ? 0.08 : -0.08);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (!e.repeat) this.onKey?.(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.releaseJoy();
    });
  }

  private joystickAllowed(x: number): boolean {
    if (this.mode === 'tap') return false;
    const half = window.innerWidth * 0.55;
    return this.leftHanded ? x > window.innerWidth - half : x < half;
  }

  private down = (e: PointerEvent) => {
    if (!this.enabled && !this.dragMode) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, lx: e.clientX, ly: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.releaseJoy();
      return;
    }
    if (this.dragMode) {
      this.onDrag?.(...this.norm(e.clientX, e.clientY), 'start');
      return;
    }
    if (this.joyId === null && this.joystickAllowed(e.clientX) && e.pointerType !== 'mouse') {
      this.joyId = e.pointerId;
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('on');
      this.knob.style.transform = 'translate(-50%,-50%)';
    }
  };

  private norm(x: number, y: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1];
  }

  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 12) p.moved = true;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0) this.onZoom?.((this.pinchDist - d) * 0.004);
      this.pinchDist = d;
      return;
    }
    if (this.dragMode) {
      this.onDrag?.(...this.norm(e.clientX, e.clientY), 'move');
      return;
    }
    if (e.pointerId !== this.joyId) {
      if (p.moved) this.onLook?.(e.clientX - p.lx, e.clientY - p.ly);
      p.lx = e.clientX;
      p.ly = e.clientY;
      return;
    }
    if (e.pointerId === this.joyId) {
      const R = 52;
      let dx = e.clientX - this.joyOrigin.x, dy = e.clientY - this.joyOrigin.y;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      this.joyVec = { x: dx / R, y: -dy / R };
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  };

  private up = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (!p) return;
    if (this.dragMode) {
      this.onDrag?.(...this.norm(e.clientX, e.clientY), 'end');
      if (!p.moved) this.onTap?.(...this.norm(e.clientX, e.clientY), e.clientX, e.clientY);
      return;
    }
    if (e.pointerId === this.joyId) {
      const wasTap = !p.moved && performance.now() - p.t < 250;
      this.releaseJoy();
      if (wasTap && this.mode !== 'joystick') this.onTap?.(...this.norm(e.clientX, e.clientY), e.clientX, e.clientY);
      return;
    }
    if (!p.moved && performance.now() - p.t < 350 && (this.mode !== 'joystick' || e.pointerType === 'mouse')) {
      this.onTap?.(...this.norm(e.clientX, e.clientY), e.clientX, e.clientY);
    }
  };

  private releaseJoy(): void {
    this.joyId = null;
    this.joyVec = { x: 0, y: 0 };
    this.base.classList.remove('on');
  }

  update(): void {
    let x = this.joyVec.x, y = this.joyVec.y;
    if (this.keys.has('a') || this.keys.has('q') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('z') || this.keys.has('arrowup')) y += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    this.moveX = this.enabled ? x : 0;
    this.moveY = this.enabled ? y : 0;
  }

  get active(): boolean {
    return Math.hypot(this.moveX, this.moveY) > 0.05;
  }
}
