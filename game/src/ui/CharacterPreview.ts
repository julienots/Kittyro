import * as THREE from 'three';
import type { Appearance } from '../state/types';
import { buildCharacter, buildToolMesh, type CharacterRig } from '../models/Character';
import { applyEmote, EMOTES } from '../entities/Emotes';

/**
 * Live 3D preview of a character (creator & wardrobe): its own small canvas,
 * turntable with the finger, idle breathing/blinking and emotes on demand.
 */
export class CharacterPreview {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private rig: CharacterRig | null = null;
  private holder = new THREE.Group();
  private yaw = 0.35;
  private yawVel = 0;
  private t = 0;
  private blink = 2;
  private emote = '';
  private emoteT = 0;
  private raf = 0;
  private last = performance.now();
  private dragging = false;
  private lastX = 0;
  private zoomFace = false;
  private camY = 0.8;
  private camD = 4.4;
  private tool: string | null = null;
  private lookKey = '';

  constructor(cls = 'char-preview') {
    this.el = document.createElement('div');
    this.el.className = cls;
    this.canvas = document.createElement('canvas');
    this.el.appendChild(this.canvas);
    let r: THREE.WebGLRenderer | null = null;
    try {
      r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.outputColorSpace = THREE.SRGBColorSpace;
    } catch {
      r = null;
    }
    this.renderer = r;
    const hemi = new THREE.HemisphereLight(0xfff6e8, 0x8aa070, 1.9);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 4, 3);
    const rim = new THREE.DirectionalLight(0xcfe8ff, 0.7);
    rim.position.set(-3, 2, -3);
    this.scene.add(hemi, sun, rim, this.holder);
    // little grass disc to stand on
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.08, 40), new THREE.MeshLambertMaterial({ color: 0x9fd472 }));
    disc.position.y = -0.04;
    const rimDisc = new THREE.Mesh(new THREE.TorusGeometry(0.775, 0.025, 8, 40).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x7ab85a }));
    this.scene.add(disc, rimDisc);
    // finger turntable
    this.el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.dragging = true; this.lastX = e.clientX; this.el.setPointerCapture(e.pointerId); });
    this.el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      this.lastX = e.clientX;
      this.yaw += dx * 0.012;
      this.yawVel = dx * 0.6;
    });
    const up = () => { this.dragging = false; };
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);
    if (!this.renderer) this.el.classList.add('no-gl');
    this.loop();
  }

  setLook(look: Appearance): void {
    const key = JSON.stringify(look);
    if (key === this.lookKey) return;
    this.lookKey = key;
    if (this.rig) this.holder.remove(this.rig.root);
    this.rig = buildCharacter(look, { outline: true });
    this.holder.add(this.rig.root);
    if (this.tool) this.rig.toolSlot.add(buildToolMesh(this.tool, 1));
  }

  /** Show the face close-up (hair, eyes...) or the whole body. */
  setFocus(face: boolean): void {
    this.zoomFace = face;
  }

  showTool(tool: string | null): void {
    this.tool = tool;
    if (!this.rig) return;
    this.rig.toolSlot.clear();
    if (tool) this.rig.toolSlot.add(buildToolMesh(tool, 1));
  }

  play(id: string): void {
    this.emote = id;
    this.emoteT = 0;
  }

  randomEmote(): void {
    const pool = ['wave', 'dance', 'laugh', 'love', 'clap', 'jump', 'thumbs'];
    this.play(pool[Math.floor(Math.random() * pool.length)]);
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.renderer || !this.el.isConnected) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (w < 4 || h < 4) return;
    if (this.canvas.width !== Math.floor(w * this.renderer.getPixelRatio()) || this.canvas.height !== Math.floor(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    if (!this.dragging) {
      this.yaw += this.yawVel * dt * 0.02;
      this.yawVel *= Math.pow(0.05, dt);
    }
    this.holder.rotation.y = this.yaw;
    const rig = this.rig;
    if (rig) {
      this.blink -= dt;
      rig.eyes.scale.y = this.blink < 0.12 ? 0.15 : 1;
      if (this.blink < 0) this.blink = 2 + Math.random() * 3;
      if (this.emote) {
        this.emoteT += dt;
        if (!applyEmote(rig, this.emote, this.emoteT)) this.emote = '';
      } else {
        rig.body.position.y = Math.sin(this.t * 2.2) * 0.006;
        rig.body.rotation.set(0, 0, 0);
        rig.head.rotation.set(Math.sin(this.t * 0.5) * 0.04, Math.sin(this.t * 0.35) * 0.15, Math.sin(this.t * 0.7) * 0.04);
        for (const a of [rig.armL, rig.armR]) { a.rotation.x *= 0.85; a.rotation.z *= 0.85; }
        rig.armL.rotation.z += (-0.06 + Math.sin(this.t * 2.2) * 0.02) * 0.15;
        rig.armR.rotation.z += (0.06 - Math.sin(this.t * 2.2) * 0.02) * 0.15;
        rig.legL.rotation.x *= 0.85;
        rig.legR.rotation.x *= 0.85;
      }
    }
    const ty = this.zoomFace ? 1.12 : 0.72;
    const td = this.zoomFace ? 1.55 : 4.2;
    this.camY += (ty - this.camY) * Math.min(1, dt * 6);
    this.camD += (td - this.camD) * Math.min(1, dt * 6);
    this.camera.position.set(0, this.camY + 0.12, this.camD);
    this.camera.lookAt(0, this.camY, 0);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }
    this.el.remove();
  }

  static emoteList(): typeof EMOTES {
    return EMOTES;
  }
}
