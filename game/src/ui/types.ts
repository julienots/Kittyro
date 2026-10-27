import type { Ctx } from '../systems/Context';
import type { Settings } from '../save/Settings';
import type { AudioEngine } from '../audio/Audio';
import type { Appearance, RegionId, ToolId } from '../state/types';
import type * as THREE from 'three';

/** What the UI may ask the game to do. Implemented by Game. */
export interface GameApi {
  ctx: Ctx;
  settings: Settings;
  audio: AudioEngine;
  camera: THREE.Camera;
  regionId: RegionId;
  hasSave: boolean;
  inShopRange: boolean;
  fps(): string;
  saveSettings(): void;
  newGame(name: string, farm: string, look: Appearance): void;
  continueGame(): Promise<void>;
  save(): Promise<boolean>;
  exportSave(): string;
  importSave(code: string): Promise<boolean>;
  resetGame(): Promise<void>;
  travel(region: RegionId, anchor?: string): void;
  enterPlacement(kind: string, uid?: string): void;
  enterEditMode(): void;
  eat(id: string): void;
  sleep(): void;
  selectTool(t: ToolId): void;
  selectSeed(id: string | null): void;
  toggleRide(): void;
  setPaused(p: boolean): void;
  refreshLook(): void;
  refreshWorld(kind: 'placed' | 'house' | 'plots' | 'all'): void;
  goMine(floor: number): void;
  startMinigame(id: string): void;
  previewLook(look: Appearance | null): void;
  rotateCamera(d: number): void;
  /** Optional rewarded ad; resolves with the reward text, or null. */
  watchAd(p: import('../systems/AdRewards').AdPlacement, offer?: import('../systems/Shop').Offer): Promise<string | null>;
  adsAvailable(): boolean;
  adsPrivacy(): { required: boolean; show: () => void };
  toggleView(): void;
  readonly view: 'iso' | 'fp';
  guideInfo(): import('../game/Guide').GuideInfo | null;
  trackQuest(id: string | null): void;
  groundY(x: number, z: number): number;
  emotes(): { id: string; icon: string; name: string }[];
  emote(id: string): void;
  replayIntro(): void;
  /** rainbow strength for the overhead-view sky arc (0 = none) */
  rainbowOverlay(): number;
}
