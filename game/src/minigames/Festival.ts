import { h } from '../ui/dom';
import type { UI } from '../ui/UI';
import type { AudioEngine } from '../audio/Audio';

/**
 * Chill festival mini-games drawn on a 2D canvas overlay. Short (~30s),
 * forgiving, always rewarding. Score is normalised to 0..100.
 */
export type MiniId = 'harvest' | 'lantern_run' | 'market' | 'toss' | 'animal_race';

interface Thing {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  emoji: string;
  life: number;
  value: number;
  hit?: boolean;
}

export const MINI_INFO: Record<MiniId, { name: string; icon: string; howto: string; seconds: number }> = {
  harvest: { name: 'Concours de récolte', icon: '🌷', howto: 'Touchez les fleurs et légumes qui poussent avant qu\'ils ne fanent. Évitez les limaces !', seconds: 30 },
  lantern_run: { name: 'Course aux lanternes', icon: '🏮', howto: 'Attrapez les lucioles et allumez les lanternes en les touchant.', seconds: 30 },
  market: { name: 'Stand du marché', icon: '🧺', howto: 'Servez à chaque client le produit qu\'il demande.', seconds: 35 },
  toss: { name: 'Lancer d\'anneaux', icon: '🎯', howto: 'Touchez au bon moment pour lancer l\'anneau sur la citrouille.', seconds: 30 },
  animal_race: { name: 'Course de moutons', icon: '🐑', howto: 'Tapotez en rythme pour encourager votre mouton !', seconds: 25 },
};

export function runMinigame(ui: UI, audio: AudioEngine, id: MiniId, onEnd: (score: number) => void): void {
  const info = MINI_INFO[id];
  const W = 720, H = 440;
  const canvas = h('canvas.mg-canvas', { width: W, height: H }) as HTMLCanvasElement;
  const g = canvas.getContext('2d')!;
  const hud = h('div.mg-hud', null, '');
  let started = false;
  let time = info.seconds;
  let points = 0;
  let maxPoints = 1;
  let combo = 0;
  const things: Thing[] = [];
  let spawnT = 0;
  let raf = 0;
  let last = performance.now();
  // per-game state
  let order = '';
  let orderT = 0;
  const goods = ['🍓', '🥕', '🌽', '🍅', '🥚', '🧀', '🍞', '🌻'];
  let aim = 0, aimDir = 1, ring: { x: number; y: number; t: number; tx: number } | null = null;
  const racers = [{ x: 60, v: 0, emoji: '🐑', you: true }, { x: 60, v: 0, emoji: '🐏' }, { x: 60, v: 0, emoji: '🐐' }, { x: 60, v: 0, emoji: '🐄' }];
  let tapRate = 0;
  let finished = false;

  const close = () => {
    cancelAnimationFrame(raf);
    overlay.remove();
    ui.setHudVisible(true);
    ui.g.setPaused(false);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    const score = Math.max(0, Math.min(100, Math.round((points / Math.max(1, maxPoints)) * 100)));
    close();
    audio.play(score > 60 ? 'levelup' : 'quest');
    onEnd(score);
  };

  const pointerXY = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!started) return;
    const p = pointerXY(e);
    if (id === 'toss') {
      if (!ring) ring = { x: W / 2, y: H - 30, t: 0, tx: 80 + aim * (W - 160) };
      return;
    }
    if (id === 'animal_race') {
      tapRate += 1;
      racers[0].v += 14;
      audio.play('pop');
      return;
    }
    for (const t of things) {
      if (t.hit || Math.hypot(t.x - p.x, t.y - p.y) > t.r + 14) continue;
      if (id === 'market') {
        t.hit = true;
        if (t.emoji === order) {
          points += 10 + combo * 2;
          combo++;
          audio.play('coin');
          newOrder();
        } else {
          combo = 0;
          audio.play('error');
        }
        return;
      }
      t.hit = true;
      if (t.value < 0) {
        combo = 0;
        points = Math.max(0, points + t.value);
        audio.play('error');
      } else {
        combo++;
        points += t.value + Math.min(5, combo);
        audio.play('harvest');
      }
      return;
    }
  });

  const newOrder = () => {
    order = goods[Math.floor(Math.random() * goods.length)];
    orderT = 5;
    maxPoints += 12;
    things.length = 0;
    const shuffled = [...goods].sort(() => Math.random() - 0.5).slice(0, 4);
    if (!shuffled.includes(order)) shuffled[Math.floor(Math.random() * 4)] = order;
    shuffled.forEach((em, i) => things.push({ x: 140 + i * 150, y: 330, vx: 0, vy: 0, r: 46, emoji: em, life: 99, value: 0 }));
  };

  const startGame = () => {
    started = true;
    if (id === 'market') newOrder();
    last = performance.now();
  };

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (started) time -= dt;
    // background
    const grad = g.createLinearGradient(0, 0, 0, H);
    const night = id === 'lantern_run';
    grad.addColorStop(0, night ? '#25306a' : '#bfe8ff');
    grad.addColorStop(1, night ? '#5a3a7a' : '#c8e8a0');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (started) {
      spawnT -= dt;
      if (id === 'harvest' || id === 'lantern_run') {
        if (spawnT <= 0) {
          spawnT = 0.55 - Math.min(0.25, (info.seconds - time) * 0.008);
          const bad = Math.random() < 0.15;
          const em = id === 'harvest' ? (bad ? '🐌' : ['🌷', '🥕', '🌻', '🍓', '🎃', '🌼'][Math.floor(Math.random() * 6)]) : (bad ? '🦇' : Math.random() < 0.5 ? '✨' : '🏮');
          things.push({ x: 60 + Math.random() * (W - 120), y: id === 'harvest' ? 120 + Math.random() * (H - 170) : H + 20, vx: id === 'lantern_run' ? (Math.random() - 0.5) * 40 : 0, vy: id === 'lantern_run' ? -60 - Math.random() * 50 : 0, r: 34, emoji: em, life: id === 'harvest' ? 1.8 : 6, value: bad ? -5 : 5 });
          if (!bad) maxPoints += 6.5;
        }
      }
      if (id === 'market') {
        orderT -= dt;
        if (orderT <= 0) { combo = 0; newOrder(); }
      }
      if (id === 'toss') {
        aim += aimDir * dt * 0.9;
        if (aim > 1 || aim < 0) { aimDir *= -1; aim = Math.max(0, Math.min(1, aim)); }
        if (ring) {
          ring.t += dt * 1.6;
          ring.x = W / 2 + (ring.tx - W / 2) * ring.t;
          ring.y = H - 30 - Math.sin(ring.t * Math.PI) * 220 - ring.t * 140;
          if (ring.t >= 1) {
            maxPoints += 10;
            const hitT = things.find((t) => Math.abs(t.x - ring!.tx) < 45);
            if (hitT) { points += 10; audio.play('coin'); hitT.hit = true; } else audio.play('fail');
            ring = null;
          }
        }
        if (things.filter((t) => !t.hit).length < 3) things.push({ x: 120 + Math.random() * (W - 240), y: 170, vx: (Math.random() - 0.5) * 60, vy: 0, r: 34, emoji: '🎃', life: 99, value: 10 });
      }
      if (id === 'animal_race') {
        tapRate = Math.max(0, tapRate - dt * 2);
        for (const r of racers) {
          if (!r.you) r.v += (8 + Math.random() * 10) * dt * 6;
          r.v *= 0.96;
          r.x += r.v * dt;
        }
        maxPoints = 100;
        const finishX = W - 70;
        const me = racers[0];
        if (racers.some((r) => r.x >= finishX) || time <= 0) {
          const place = racers.filter((r) => r.x > me.x).length;
          points = [100, 75, 55, 40][place];
          time = 0;
        }
      }
      for (const t of things) {
        t.life -= dt;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        if (id === 'toss' && (t.x < 80 || t.x > W - 80)) t.vx *= -1;
      }
      for (let i = things.length - 1; i >= 0; i--) if (things[i].life <= 0 || (things[i].hit && id !== 'market')) things.splice(i, 1);
    }
    // draw
    for (const t of things) {
      const s = id === 'harvest' ? Math.min(1, (1.8 - t.life) * 4, t.life * 3) : 1;
      g.font = `${Math.round(t.r * 1.6 * Math.max(0.2, s))}px "Noto Color Emoji",sans-serif`;
      if (id === 'market') {
        g.fillStyle = '#fff8ec';
        g.beginPath();
        g.arc(t.x, t.y, t.r + 6, 0, Math.PI * 2);
        g.fill();
      }
      g.fillText(t.emoji, t.x, t.y);
    }
    if (id === 'market' && started) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.roundRect(W / 2 - 150, 60, 300, 120, 30);
      g.fill();
      g.font = '64px "Noto Color Emoji",sans-serif';
      g.fillText('🙂', W / 2 - 80, 120);
      g.fillText(order, W / 2 + 60, 120);
      g.fillStyle = '#ffb38a';
      g.fillRect(W / 2 - 130, 165, 260 * Math.max(0, orderT / 5), 8);
    }
    if (id === 'toss') {
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.fillRect(80, H - 60, W - 160, 12);
      g.fillStyle = '#ff8fab';
      g.fillRect(80 + aim * (W - 160) - 6, H - 66, 12, 24);
      if (ring) {
        g.strokeStyle = '#ffd166';
        g.lineWidth = 8;
        g.beginPath();
        g.ellipse(ring.x, ring.y, 30, 12, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    if (id === 'animal_race') {
      racers.forEach((r, i) => {
        const y = 110 + i * 80;
        g.fillStyle = i % 2 ? '#a8d878' : '#b8e088';
        g.fillRect(0, y - 34, W, 68);
        g.fillStyle = '#fff';
        g.fillRect(W - 70, y - 34, 8, 68);
        g.font = '52px "Noto Color Emoji",sans-serif';
        g.save();
        g.translate(r.x, y + Math.abs(Math.sin(r.x * 0.08)) * -10);
        g.scale(-1, 1);
        g.fillText(r.emoji, 0, 0);
        g.restore();
        if (r.you) {
          g.fillStyle = '#5a4036';
          g.font = '600 16px Fredoka, sans-serif';
          g.fillText('Vous', r.x, y - 40);
        }
      });
    }
    if (!started) {
      g.fillStyle = 'rgba(255,248,236,.92)';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#5a4036';
      g.font = '72px "Noto Color Emoji",sans-serif';
      g.fillText(info.icon, W / 2, 110);
      g.font = '600 32px Fredoka, sans-serif';
      g.fillText(info.name, W / 2, 190);
      g.font = '20px Fredoka, sans-serif';
      wrap(g, info.howto, W / 2, 240, W - 120, 28);
    }
    hud.textContent = started ? `⏱️ ${Math.max(0, Math.ceil(time))}s · ⭐ ${Math.round(points)}${combo > 2 ? ` · x${combo}` : ''}` : info.name;
    if (started && time <= 0) {
      finish();
      return;
    }
    raf = requestAnimationFrame(loop);
  };

  const startBtn = h('button.btn', { style: { position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)', fontSize: '20px' }, onclick: (e: Event) => { e.stopPropagation(); startBtn.remove(); startGame(); } }, '▶ Jouer');
  const quit = h('button.btn.ghost.small', { style: { position: 'absolute', top: '14px', right: '14px' }, onclick: (e: Event) => { e.stopPropagation(); close(); } }, '✕');
  const overlay = h('div.minigame', { style: { background: 'rgba(60,40,30,.35)' }, onpointerdown: (e: Event) => e.stopPropagation() }, hud, canvas, startBtn, quit);
  ui.root.appendChild(overlay);
  ui.setHudVisible(false);
  ui.g.setPaused(true);
  raf = requestAnimationFrame(loop);
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = t;
  }
  g.fillText(line, x, y);
}
