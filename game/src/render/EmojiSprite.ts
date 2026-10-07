import * as THREE from 'three';

/** 2D emoji billboards inside the 3D world (product bubbles, emotes, item drops). */
const cache = new Map<string, THREE.SpriteMaterial>();

export function emojiMaterial(emoji: string, bubble = true): THREE.SpriteMaterial {
  const key = `${emoji}|${bubble}`;
  let m = cache.get(key);
  if (m) return m;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  if (bubble) {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.arc(S / 2, S / 2 - 6, 50, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(S / 2 - 14, S / 2 + 36);
    g.lineTo(S / 2, S / 2 + 58);
    g.lineTo(S / 2 + 14, S / 2 + 36);
    g.fill();
    g.strokeStyle = 'rgba(90,70,60,0.25)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(S / 2, S / 2 - 6, 50, 0, Math.PI * 2);
    g.stroke();
  }
  g.font = `${bubble ? 62 : 96}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, S / 2, S / 2 - (bubble ? 4 : 0));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.SpriteMaterial({ map: t, depthTest: true, depthWrite: false, transparent: true });
  cache.set(key, m);
  return m;
}

export function emojiSprite(emoji: string, size = 0.6, bubble = true): THREE.Sprite {
  const s = new THREE.Sprite(emojiMaterial(emoji, bubble));
  s.scale.setScalar(size);
  s.renderOrder = 20;
  return s;
}
