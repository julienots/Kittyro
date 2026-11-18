import * as THREE from 'three';
import { mb } from './Builder';
import { toonGradient } from '../render/Materials';
import { TOOL_TIER_COLORS } from '../data/constants';

/**
 * Detailed tools for the first-person view (much finer than the chibi avatar's).
 * Tool space = where the fist is: origin at the grip, +Y up, -Z forward (away
 * from the player), +X to the right. The hand rig maps this space to the view.
 */

const WOOD = 0x9a6a3a, WOOD_DARK = 0x6e4a2a, WRAP = 0x5a3a2a, LEATHER = 0x7a4a2e;

function lighter(c: number, f: number): number {
  const col = new THREE.Color(c);
  col.lerp(new THREE.Color(0xffffff), f);
  return col.getHex();
}

/** Extruded blade from a 2D outline drawn in the YZ plane (thickness along X). */
function blade(points: [number, number][], thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) shape.lineTo(p[0], p[1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.35, bevelSize: thickness * 0.35, bevelSegments: 2, curveSegments: 6 });
  // shape is in XY: x = forward (we map to -Z), y = up; extrusion along +Z = thickness → X
  g.translate(0, 0, -thickness / 2);
  g.rotateY(Math.PI / 2);
  return g.index ? g.toNonIndexed() : g;
}

function handle(b: ReturnType<typeof mb>, y0: number, y1: number, r0: number, r1: number, wraps = 3): void {
  const len = y1 - y0;
  b.cyl(r1, r0, len, [WOOD_DARK, WOOD], { pos: [0, y0 + len / 2, 0] }, 10);
  b.sphere(r0 * 1.15, WOOD_DARK, { pos: [0, y0, 0], scale: [1, 0.6, 1] }, 8); // pommel
  for (let i = 0; i < wraps; i++) b.cyl(r0 * 1.12, r0 * 1.12, 0.018, WRAP, { pos: [0, -0.035 + i * 0.03, 0] }, 10); // leather grip
}

export function fpToolMesh(tool: string, tier: number): THREE.Mesh {
  const b = mb();
  const metal = TOOL_TIER_COLORS[tier] ?? 0xb8c2cc;
  const edge = lighter(metal, 0.55);
  switch (tool) {
    case 'axe': {
      handle(b, -0.14, 0.42, 0.016, 0.019);
      // head: socket + flared blade facing forward (-Z)
      b.box(0.034, 0.075, 0.06, lighter(metal, -0.1), { pos: [0, 0.4, 0.008] });
      b.geo(blade([[0.02, 0.36], [0.17, 0.3], [0.19, 0.4], [0.17, 0.5], [0.02, 0.44]], 0.014), metal, { pos: [0, 0, 0] });
      b.geo(blade([[0.165, 0.305], [0.19, 0.3], [0.205, 0.4], [0.19, 0.5], [0.165, 0.495]], 0.016), edge, { pos: [0, 0, 0] });
      break;
    }
    case 'pickaxe': {
      handle(b, -0.14, 0.42, 0.016, 0.019);
      b.cyl(0.026, 0.026, 0.06, metal, { pos: [0, 0.42, 0], rot: [Math.PI / 2, 0, 0] }, 10);
      // curved pick: two tapering spikes forward & back
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const t = (i + 1) / 5;
          const z = dir * t * 0.2, y = 0.42 - t * t * 0.06;
          b.cyl(0.02 * (1 - t * 0.8), 0.02 * (1 - (t - 0.2) * 0.8), 0.045, i === 4 ? edge : metal, { pos: [0, y, -z], rot: [Math.PI / 2 + dir * t * 0.45, 0, 0] }, 7);
        }
      }
      break;
    }
    case 'hoe': {
      handle(b, -0.2, 0.62, 0.015, 0.018);
      b.cyl(0.022, 0.022, 0.05, metal, { pos: [0, 0.62, -0.01], rot: [Math.PI / 2, 0, 0] }, 8);
      b.box(0.012, 0.03, 0.09, metal, { pos: [0, 0.6, -0.06], rot: [-0.4, 0, 0] });
      b.box(0.13, 0.1, 0.012, metal, { pos: [0, 0.54, -0.1] });
      b.box(0.13, 0.014, 0.014, edge, { pos: [0, 0.49, -0.1] });
      break;
    }
    case 'can': {
      const body = tier === 0 ? 0x6ab8e8 : metal;
      // rear vertical handle in the fist, body forward
      b.cyl(0.016, 0.016, 0.15, body, { pos: [0, 0.0, 0] }, 8);
      b.torus(0.06, 0.012, body, { pos: [0, 0.08, -0.06], rot: [0, Math.PI / 2, 0] }, Math.PI);
      b.cyl(0.1, 0.11, 0.17, [lighter(body, -0.2), body], { pos: [0, -0.04, -0.14] }, 18);
      b.cyl(0.103, 0.103, 0.014, lighter(body, 0.3), { pos: [0, 0.045, -0.14] }, 18);
      b.cyl(0.075, 0.075, 0.01, 0x3a5a7a, { pos: [0, 0.05, -0.14] }, 16);
      b.cyl(0.012, 0.02, 0.26, body, { pos: [0, 0.03, -0.32], rot: [-1.0, 0, 0] }, 8); // spout
      b.cyl(0.035, 0.018, 0.03, lighter(body, 0.2), { pos: [0, 0.13, -0.42], rot: [-1.0, 0, 0] }, 12); // rose
      b.cyl(0.036, 0.036, 0.005, 0x9ab8c8, { pos: [0, 0.145, -0.435], rot: [-1.0, 0, 0] }, 12);
      break;
    }
    case 'rod': {
      b.cyl(0.02, 0.022, 0.16, 0xd8b88a, { pos: [0, 0, 0] }, 10); // cork grip
      b.cyl(0.024, 0.024, 0.02, WOOD_DARK, { pos: [0, 0.09, 0] }, 10);
      // reel under the grip
      b.box(0.012, 0.03, 0.012, 0x5a5a6a, { pos: [0, -0.02, 0.03] });
      b.cyl(0.035, 0.035, 0.03, metal, { pos: [0, -0.02, 0.055], rot: [0, 0, Math.PI / 2] }, 14);
      b.cyl(0.01, 0.01, 0.04, 0x3a3a4a, { pos: [0.03, -0.02, 0.055], rot: [0, 0, Math.PI / 2] }, 6);
      // blank: long, thin, leaning forward
      const len = 0.95;
      b.cyl(0.004, 0.011, len, WOOD, { pos: [0, 0.1 + Math.cos(0.55) * len / 2, -Math.sin(0.55) * len / 2], rot: [-0.55, 0, 0] }, 6);
      for (let i = 1; i <= 3; i++) b.torus(0.008, 0.002, metal, { pos: [0, 0.1 + Math.cos(0.55) * len * i / 4, -Math.sin(0.55) * len * i / 4], rot: [-0.55, 0, 0] });
      break;
    }
    case 'sickle': {
      b.cyl(0.017, 0.019, 0.17, [WOOD_DARK, WOOD], { pos: [0, 0.0, 0] }, 10);
      b.cyl(0.021, 0.021, 0.02, metal, { pos: [0, 0.09, 0] }, 10);
      b.torus(0.11, 0.012, metal, { pos: [0, 0.2, -0.1], rot: [0, Math.PI / 2, 0.2] }, Math.PI * 1.15);
      b.torus(0.11, 0.004, edge, { pos: [0, 0.2, -0.1], rot: [0, Math.PI / 2, 0.2], scale: [0.92, 0.92, 1] }, Math.PI * 1.15);
      break;
    }
    case 'net': {
      handle(b, -0.12, 0.5, 0.013, 0.015, 2);
      b.torus(0.12, 0.008, 0xd8d8d8, { pos: [0, 0.6, -0.08], rot: [Math.PI / 2 - 0.4, 0, 0] });
      break;
    }
    default:
      b.box(0.06, 0.06, 0.06, LEATHER);
  }
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  const m = new THREE.Mesh(b.build(), mat);
  if (tool === 'net') {
    const net = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.2, 14, 1, true), new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    net.position.set(0, 0.52, -0.05);
    net.rotation.x = -0.4;
    m.add(net);
  }
  return m;
}
