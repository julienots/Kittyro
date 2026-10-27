export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type ControlMode = 'joystick' | 'tap' | 'both';

export interface Settings {
  quality: Quality;
  controls: ControlMode;
  music: number;
  sfx: number;
  ambience: number;
  zoom: number;
  showFps: boolean;
  haptics: boolean;
  autoQuality: boolean;
  leftHanded: boolean;
  tips: boolean;
  view: 'iso' | 'fp';
  /** quest tracker on screen */
  tracker: boolean;
  /** golden arrow towards the objective */
  guideArrow: boolean;
  /** play the intro cut-scene for new games */
  intro: boolean;
}

const KEY = 'mm_settings';

export function detectQuality(): Quality {
  if (typeof navigator === 'undefined') return 'medium';
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as any).deviceMemory ?? 4;
  if (!mobile) return cores >= 8 ? 'high' : 'medium';
  if (mem <= 2 || cores <= 4) return 'low';
  if (mem >= 8 && cores >= 8) return 'high';
  return 'medium';
}

export function defaultSettings(): Settings {
  return { quality: detectQuality(), controls: 'both', music: 0.6, sfx: 0.8, ambience: 0.6, zoom: 1, showFps: false, haptics: true, autoQuality: true, leftHanded: false, tips: true, view: 'iso', tracker: true, guideArrow: true, intro: true };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultSettings();
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}
