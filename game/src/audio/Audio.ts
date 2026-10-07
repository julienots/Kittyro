/**
 * Procedural audio for Mossy Meadows — no audio files needed (and none to lose).
 * - Adaptive music: themes per region / night / rain / winter / festival, generated
 *   live from scales & chord progressions with soft synth instruments.
 * - Ambience beds: wind, birds, water, rain, crickets, waves, lava, cave drips.
 * - Synthesized SFX and animal voices.
 */

type Inst = 'kalimba' | 'pluck' | 'bell' | 'flute' | 'pad' | 'bass' | 'piano' | 'strum';

interface Theme {
  bpm: number;
  root: number; // midi
  scale: number[];
  chords: number[][]; // scale degrees
  lead: Inst;
  chord: Inst;
  density: number; // melody note probability per 8th
  bass: boolean;
  octave: number;
}

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];

const THEMES: Record<string, Theme> = {
  farm: { bpm: 84, root: 60, scale: PENTA, chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4], [5, 0, 2], [3, 5, 0], [1, 3, 5], [4, 6, 1]], lead: 'kalimba', chord: 'pad', density: 0.42, bass: true, octave: 12 },
  village: { bpm: 96, root: 65, scale: MAJ, chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], lead: 'pluck', chord: 'strum', density: 0.5, bass: true, octave: 12 },
  forest: { bpm: 72, root: 62, scale: DORIAN, chords: [[0, 2, 4], [6, 1, 3], [3, 5, 0], [0, 2, 4]], lead: 'flute', chord: 'pad', density: 0.32, bass: false, octave: 12 },
  mountain: { bpm: 70, root: 67, scale: LYDIAN, chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [4, 6, 1]], lead: 'bell', chord: 'pad', density: 0.3, bass: true, octave: 12 },
  beach: { bpm: 102, root: 69, scale: MAJ, chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [3, 5, 0]], lead: 'kalimba', chord: 'strum', density: 0.48, bass: true, octave: 0 },
  night: { bpm: 60, root: 63, scale: MAJ, chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], lead: 'bell', chord: 'pad', density: 0.28, bass: false, octave: 12 },
  rain: { bpm: 66, root: 57, scale: MINOR, chords: [[0, 2, 4], [5, 0, 2], [2, 4, 6], [6, 1, 3]], lead: 'piano', chord: 'pad', density: 0.34, bass: true, octave: 12 },
  winter: { bpm: 76, root: 64, scale: MAJ, chords: [[0, 2, 4], [5, 0, 2], [1, 3, 5], [4, 6, 1]], lead: 'bell', chord: 'pad', density: 0.38, bass: false, octave: 12 },
  cave: { bpm: 52, root: 50, scale: MINOR, chords: [[0, 2, 4], [5, 0, 2]], lead: 'bell', chord: 'pad', density: 0.16, bass: true, octave: 12 },
  ember: { bpm: 80, root: 52, scale: PHRYG, chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]], lead: 'pluck', chord: 'pad', density: 0.36, bass: true, octave: 12 },
  home: { bpm: 72, root: 58, scale: MAJ, chords: [[0, 2, 4], [3, 5, 0], [1, 3, 5], [4, 6, 1]], lead: 'kalimba', chord: 'pad', density: 0.3, bass: true, octave: 12 },
  festival: { bpm: 112, root: 62, scale: MAJ, chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]], lead: 'pluck', chord: 'strum', density: 0.62, bass: true, octave: 12 },
  title: { bpm: 70, root: 60, scale: PENTA, chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]], lead: 'bell', chord: 'pad', density: 0.3, bass: false, octave: 12 },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private theme: Theme | null = null;
  private themeId = '';
  private themeGain: GainNode | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private lastDegree = 0;
  private timer: number | null = null;
  private amb: Record<string, { gain: GainNode; src: AudioScheduledSourceNode[] }> = {};
  private ambTargets: Record<string, number> = {};
  private birdT = 0;
  private cricketT = 0;
  private dripT = 0;
  volumes = { music: 0.6, sfx: 0.8, ambience: 0.6 };
  muted = false;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.ambBus.connect(this.master);
    // simple generated reverb
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.reverb.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.timer = window.setInterval(() => this.schedule(), 90);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.muted ? 0 : 1;
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.55 * m, t, 0.2);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx * m, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.volumes.ambience * 0.8 * m, t, 0.2);
  }

  // -------------------- music --------------------
  setTheme(id: string): void {
    if (!this.ctx || id === this.themeId || !THEMES[id]) return;
    const ctx = this.ctx;
    const old = this.themeGain;
    if (old) {
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
      setTimeout(() => old.disconnect(), 4000);
    }
    this.themeId = id;
    this.theme = THEMES[id];
    this.themeGain = ctx.createGain();
    this.themeGain.gain.value = 0;
    this.themeGain.gain.setTargetAtTime(1, ctx.currentTime + 0.5, 1.2);
    this.themeGain.connect(this.musicBus);
    this.themeGain.connect(this.reverbSend);
    this.nextNoteTime = ctx.currentTime + 0.6;
    this.step = 0;
  }

  private schedule(): void {
    if (!this.ctx || !this.theme || !this.themeGain) return;
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    const th = this.theme;
    const eighth = 60 / th.bpm / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.35) {
      const t = this.nextNoteTime;
      const bar = Math.floor(this.step / 8);
      const pos = this.step % 8;
      const chord = th.chords[bar % th.chords.length];
      const deg = (d: number) => {
        const n = th.scale.length;
        const o = Math.floor(d / n);
        return th.root + th.scale[((d % n) + n) % n] + o * 12;
      };
      // chord / pad at bar start
      if (pos === 0) {
        if (th.chord === 'pad') for (const d of chord) this.voice('pad', mtof(deg(d) - 12), t, eighth * 8, 0.05);
        if (th.bass) this.voice('bass', mtof(deg(chord[0]) - 24), t, eighth * 3.5, 0.16);
      }
      if (th.chord === 'strum' && (pos === 0 || pos === 3 || pos === 6)) chord.forEach((d, i) => this.voice('pluck', mtof(deg(d)), t + i * 0.025, eighth * 1.5, 0.05));
      if (th.bass && pos === 4) this.voice('bass', mtof(deg(chord[2 % chord.length]) - 24), t, eighth * 3, 0.12);
      // melody: gentle random walk on chord-friendly degrees
      if (Math.random() < th.density * (pos % 2 === 0 ? 1.2 : 0.6)) {
        const target = chord[Math.floor(Math.random() * chord.length)] + (Math.random() < 0.5 ? th.scale.length : 0);
        let d = this.lastDegree + Math.sign(target - this.lastDegree) * (Math.random() < 0.7 ? 1 : 2);
        if (Math.random() < 0.25) d = target;
        d = Math.max(-2, Math.min(th.scale.length * 2, d));
        this.lastDegree = d;
        const len = eighth * (Math.random() < 0.3 ? 2 : 1);
        this.voice(th.lead, mtof(deg(d) + th.octave - 12), t, len, th.lead === 'pad' ? 0.06 : 0.11);
      }
      this.nextNoteTime += eighth * (pos % 2 === 0 ? 1.04 : 0.96); // tiny swing
      this.step++;
    }
  }

  private voice(inst: Inst, freq: number, t: number, dur: number, vol: number, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const out = dest ?? this.themeGain!;
    const g = ctx.createGain();
    g.connect(out);
    const env = (a: number, d: number, s: number, r: number) => {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + a);
      g.gain.setTargetAtTime(vol * s, t + a, d);
      g.gain.setTargetAtTime(0, t + dur, r);
    };
    const osc = (type: OscillatorType, f: number, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.start(t);
      o.stop(t + dur + 2.5);
      return o;
    };
    switch (inst) {
      case 'kalimba': {
        env(0.004, 0.12, 0.15, 0.25);
        const o = osc('sine', freq);
        const o2 = osc('sine', freq * 4.02);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.25, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g);
        o2.connect(g2).connect(g);
        break;
      }
      case 'pluck':
      case 'strum': {
        env(0.003, 0.09, 0.2, 0.15);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(freq * 6, t);
        f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.3);
        osc('triangle', freq).connect(f).connect(g);
        break;
      }
      case 'bell': {
        env(0.003, 0.5, 0.1, 0.8);
        osc('sine', freq).connect(g);
        const g2 = ctx.createGain();
        g2.gain.value = 0.3;
        osc('sine', freq * 2.76).connect(g2).connect(g);
        const g3 = ctx.createGain();
        g3.gain.value = 0.12;
        osc('sine', freq * 5.4).connect(g3).connect(g);
        break;
      }
      case 'flute': {
        env(0.08, 0.3, 0.8, 0.2);
        const o = osc('sine', freq);
        const lfo = osc('sine', 5.2);
        const lg = ctx.createGain();
        lg.gain.value = freq * 0.008;
        lfo.connect(lg).connect(o.frequency);
        o.connect(g);
        const n = ctx.createBufferSource();
        n.buffer = this.noiseBuf;
        const nf = ctx.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.value = freq * 2;
        const ng = ctx.createGain();
        ng.gain.value = 0.06;
        n.connect(nf).connect(ng).connect(g);
        n.start(t);
        n.stop(t + dur + 0.5);
        break;
      }
      case 'piano': {
        env(0.005, 0.35, 0.25, 0.4);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1800;
        osc('triangle', freq).connect(f).connect(g);
        const g2 = ctx.createGain();
        g2.gain.value = 0.2;
        osc('sine', freq * 2).connect(g2).connect(f);
        break;
      }
      case 'pad': {
        env(0.6, 1.2, 0.8, 1.0);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        osc('sawtooth', freq, -7).connect(f);
        osc('sawtooth', freq, 7).connect(f);
        f.connect(g);
        break;
      }
      case 'bass': {
        env(0.01, 0.25, 0.5, 0.2);
        osc('triangle', freq).connect(g);
        break;
      }
    }
  }

  // -------------------- ambience --------------------
  /** Set target levels (0..1) for each ambience bed. */
  setAmbience(levels: Record<string, number>): void {
    this.ambTargets = levels;
    if (!this.ctx) return;
    for (const k of ['wind', 'water', 'rain', 'waves', 'lava', 'fire']) {
      const want = levels[k] ?? 0;
      if (want > 0 && !this.amb[k]) this.startBed(k);
      const b = this.amb[k];
      if (b) b.gain.gain.setTargetAtTime(want * 0.5, this.ctx.currentTime, 1.0);
    }
  }

  private startBed(k: string): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.ambBus);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const srcs: AudioScheduledSourceNode[] = [src];
    switch (k) {
      case 'wind': f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6; break;
      case 'water': f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.9; break;
      case 'rain': f.type = 'highpass'; f.frequency.value = 1800; break;
      case 'waves': f.type = 'lowpass'; f.frequency.value = 600; break;
      case 'lava': f.type = 'lowpass'; f.frequency.value = 140; break;
      case 'fire': f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 2; break;
    }
    // slow swell for wind & waves
    const lfo = ctx.createOscillator();
    lfo.frequency.value = k === 'waves' ? 0.12 : 0.07;
    const lg = ctx.createGain();
    lg.gain.value = k === 'waves' ? 0.35 : 0.2;
    const mod = ctx.createGain();
    mod.gain.value = 0.6;
    lfo.connect(lg).connect(mod.gain);
    src.connect(f).connect(mod).connect(g);
    src.start();
    lfo.start();
    srcs.push(lfo);
    this.amb[k] = { gain: g, src: srcs };
  }

  /** Random one-shots: birds by day, crickets at night, cave drips. */
  tickAmbience(dt: number, opts: { birds: number; crickets: number; drips: number }): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.birdT -= dt;
    if (opts.birds > 0 && this.birdT <= 0) {
      this.birdT = 1.5 + Math.random() * 5 / opts.birds;
      this.bird();
    }
    this.cricketT -= dt;
    if (opts.crickets > 0 && this.cricketT <= 0) {
      this.cricketT = 0.6 + Math.random() * 1.5;
      this.cricket(opts.crickets);
    }
    this.dripT -= dt;
    if (opts.drips > 0 && this.dripT <= 0) {
      this.dripT = 1 + Math.random() * 3;
      this.tone(1200 + Math.random() * 900, 0.08, 'sine', 0.06, this.ambBus, 2400);
    }
  }

  private bird(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2200 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const st = t + i * (0.09 + Math.random() * 0.05);
      o.frequency.setValueAtTime(base, st);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), st + 0.06);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.035, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.08);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(g).connect(p).connect(this.ambBus);
      o.start(st);
      o.stop(st + 0.1);
    }
  }

  private cricket(level: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 4400 + Math.random() * 300;
      const st = t + i * 0.05;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.012 * level, st + 0.01);
      g.gain.linearRampToValueAtTime(0, st + 0.035);
      o.connect(g).connect(this.ambBus);
      o.start(st);
      o.stop(st + 0.05);
    }
  }

  // -------------------- SFX --------------------
  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, dest?: AudioNode, sweepTo?: number, delay = 0): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, freq: number, type: BiquadFilterType = 'bandpass', vol = 0.2, delay = 0, q = 1): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  play(name: string, p: any = {}): void {
    if (!this.ctx) return;
    switch (name) {
      case 'step': {
        const tile = p.tile ?? 0;
        if (tile === 6 || tile === 14) this.noise(0.09, 3000, 'highpass', 0.05);
        else if (tile === 9) this.tone(160, 0.06, 'triangle', 0.08);
        else if (tile === 2) this.noise(0.08, 1800, 'bandpass', 0.04);
        else this.noise(0.06, 900, 'bandpass', 0.035);
        break;
      }
      case 'hoe': this.noise(0.14, 400, 'lowpass', 0.3); this.tone(110, 0.1, 'sine', 0.2); break;
      case 'water': this.noise(0.35, 2400, 'bandpass', 0.12); this.noise(0.25, 1200, 'bandpass', 0.08, 0.1); break;
      case 'refill': for (let i = 0; i < 5; i++) this.tone(500 + i * 120, 0.08, 'sine', 0.06, undefined, 700 + i * 120, i * 0.06); break;
      case 'chop': this.tone(220, 0.1, 'triangle', 0.3, undefined, 120); this.noise(0.08, 1500, 'bandpass', 0.15); break;
      case 'fall': this.noise(0.6, 300, 'lowpass', 0.3); this.tone(90, 0.5, 'sine', 0.25, undefined, 50); break;
      case 'pick': this.tone(1400 + Math.random() * 200, 0.12, 'square', 0.06); this.tone(2100, 0.2, 'sine', 0.08); this.noise(0.05, 4000, 'highpass', 0.1); break;
      case 'break': this.noise(0.3, 700, 'lowpass', 0.3); this.tone(300, 0.2, 'triangle', 0.15, undefined, 120); break;
      case 'cut': this.noise(0.12, 3500, 'highpass', 0.12); break;
      case 'harvest': this.tone(500, 0.08, 'sine', 0.2, undefined, 900); this.tone(900, 0.12, 'sine', 0.12, undefined, 1300, 0.07); break;
      case 'plant': this.noise(0.1, 600, 'lowpass', 0.15); this.tone(600, 0.06, 'sine', 0.06); break;
      case 'pop': this.tone(700, 0.09, 'sine', 0.18, undefined, 1200); break;
      case 'coin': this.tone(1320, 0.1, 'square', 0.05); this.tone(1760, 0.25, 'square', 0.05, undefined, undefined, 0.08); break;
      case 'gem': [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.08, undefined, undefined, i * 0.07)); break;
      case 'click': this.tone(900, 0.04, 'sine', 0.08); break;
      case 'open': this.tone(400, 0.12, 'sine', 0.07, undefined, 700); break;
      case 'close': this.tone(600, 0.1, 'sine', 0.06, undefined, 350); break;
      case 'error': this.tone(240, 0.15, 'triangle', 0.12, undefined, 180); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.12, undefined, undefined, i * 0.09)); break;
      case 'quest': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, undefined, undefined, i * 0.11)); break;
      case 'discover': [659, 880, 1109, 1319, 1760].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.09, undefined, undefined, i * 0.08)); break;
      case 'bite': this.tone(1200, 0.08, 'square', 0.1); this.tone(1600, 0.1, 'square', 0.1, undefined, undefined, 0.1); break;
      case 'splash': this.noise(0.4, 1000, 'bandpass', 0.2); break;
      case 'reel': this.tone(1800, 0.02, 'square', 0.03); break;
      case 'catch': [523, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, undefined, undefined, i * 0.08)); break;
      case 'fail': this.tone(400, 0.3, 'triangle', 0.1, undefined, 200); break;
      case 'door': this.noise(0.15, 300, 'lowpass', 0.2); this.tone(180, 0.15, 'triangle', 0.1); break;
      case 'build': for (let i = 0; i < 4; i++) { this.noise(0.08, 500, 'lowpass', 0.25, i * 0.12); this.tone(200, 0.06, 'triangle', 0.1, undefined, undefined, i * 0.12); } this.tone(784, 0.4, 'sine', 0.1, undefined, undefined, 0.5); break;
      case 'thunder': this.noise(2.5, 120, 'lowpass', 0.6); this.noise(1.2, 400, 'lowpass', 0.3, 0.1); break;
      case 'sparkle': for (let i = 0; i < 4; i++) this.tone(2000 + Math.random() * 1500, 0.15, 'sine', 0.04, undefined, undefined, i * 0.05); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise(0.06, 1200, 'bandpass', 0.12, i * 0.12); break;
      case 'sleep': [523, 440, 392, 330].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.08, undefined, undefined, i * 0.25)); break;
      case 'animal': this.animal(p.species, p.soft); break;
    }
  }

  private animal(species: string, soft = false): void {
    const v = soft ? 0.5 : 1;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const formant = (f0: number, f1: number, dur: number, type: OscillatorType, vol: number, vib = 0, filt = 1200) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f1, t + dur);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filt;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.04);
      g.gain.setTargetAtTime(0, t + dur * 0.8, 0.06);
      if (vib) {
        const l = ctx.createOscillator();
        l.frequency.value = vib;
        const lg = ctx.createGain();
        lg.gain.value = f0 * 0.06;
        l.connect(lg).connect(o.frequency);
        l.start(t);
        l.stop(t + dur + 0.2);
      }
      o.connect(f).connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + dur + 0.3);
    };
    switch (species) {
      case 'chicken': for (let i = 0; i < 3; i++) this.tone(700 + i * 60, 0.07, 'square', 0.04 * v, undefined, 500, i * 0.09); break;
      case 'duck': formant(500, 420, 0.18, 'sawtooth', 0.08, 0, 1600); break;
      case 'cow': formant(130, 105, 0.9, 'sawtooth', 0.12, 0, 700); break;
      case 'sheep': formant(320, 300, 0.6, 'sawtooth', 0.08, 11, 1400); break;
      case 'goat': formant(380, 340, 0.45, 'sawtooth', 0.07, 13, 1600); break;
      case 'pig': this.noise(0.18, 400, 'bandpass', 0.15 * v, 0, 3); formant(160, 140, 0.18, 'sawtooth', 0.06, 30, 600); break;
      case 'horse': formant(600, 300, 0.7, 'sawtooth', 0.06, 14, 1800); break;
      case 'cat': formant(500, 700, 0.35, 'sine', 0.08); this.tone(650, 0.2, 'sine', 0.05 * v, undefined, 400, 0.3); break;
      case 'dog': this.noise(0.08, 700, 'bandpass', 0.25 * v, 0, 2); formant(320, 260, 0.12, 'sawtooth', 0.08, 0, 1000); break;
      case 'rabbit': case 'otter': case 'hedgehog': this.tone(1800, 0.06, 'sine', 0.05 * v, undefined, 2200); break;
      default: this.tone(1300, 0.4, 'sine', 0.06 * v, undefined, 1700);
    }
  }

  vibrate(ms: number | number[]): void {
    try { navigator.vibrate?.(ms); } catch { /* not supported */ }
  }
}

export const audio = new AudioEngine();
