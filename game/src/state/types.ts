/**
 * Serializable game state. Everything that must survive a save lives here and
 * ONLY here: systems mutate it, views read it. Keep it plain JSON (no classes).
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherType = 'sun' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';
export type RegionId =
  | 'farm'
  | 'village'
  | 'woods'
  | 'mountains'
  | 'coast'
  | 'frosty'
  | 'ember'
  | 'mine'
  | 'house'
  | 'hamlet';
export type ToolId = 'hoe' | 'can' | 'axe' | 'pickaxe' | 'rod' | 'sickle';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'mythic';

export interface ItemStack {
  id: string;
  qty: number;
}

export interface Appearance {
  skin: number;
  hairStyle: number;
  hairColor: number;
  eyeStyle: number;
  eyeColor: number;
  top: string;
  topColor: number;
  bottom: string;
  bottomColor: number;
  shoes: string;
  shoesColor: number;
  hat: string;
  hatColor: number;
  accessory: string;
  cheeks: boolean;
  /** v1.5 face options (optional for older saves) */
  brow?: number;
  mouth?: number;
  freckles?: boolean;
  lashes?: boolean;
  facialHair?: number;
  /** body height multiplier 0.92..1.08 */
  height?: number;
}

export interface CropState {
  id: string;
  /** Growth progress in game minutes (only advances while watered & in season). */
  growth: number;
  /** Number of harvests already done (for regrowing crops). */
  harvests: number;
  /** true when the crop is ready. Cached for quick render decisions. */
  ready: boolean;
}

export interface PlotState {
  x: number;
  z: number;
  watered: boolean;
  fertilized: number; // 0 none, 1 basic, 2 deluxe
  crop: CropState | null;
}

export interface PlacedObject {
  uid: string;
  /** id in BUILDINGS or DECOR or FURNITURE */
  kind: string;
  x: number;
  z: number;
  rot: number; // 0..3 quarter turns
  /** For interior objects: which room. */
  room?: string;
  data?: Record<string, any>;
}

export interface AnimalState {
  uid: string;
  species: string;
  name: string;
  x: number;
  z: number;
  hunger: number; // 0 (starving) .. 100 (full)
  happiness: number; // 0..100
  friendship: number; // 0..1000
  /** Product waiting to be collected. */
  product: string | null;
  productQuality: number;
  /** Day the animal last produced. */
  lastProducedDay: number;
  petToday: boolean;
  fedToday: boolean;
  homeUid: string | null;
  bornDay: number;
  color: number; // variation index
}

export interface NodeState {
  /** absolute game minute when the node was depleted; null = available */
  depletedAt: number | null;
  hp?: number;
}

export interface RegionState {
  unlocked: boolean;
  visited: boolean;
  nodes: Record<string, NodeState>;
  chests: string[];
  secrets: string[];
}

export interface NpcState {
  friendship: number; // points, 100 per level, max 1000
  talkedDay: number;
  giftedDay: number;
  met: boolean;
  giftsGiven: number;
}

export type QuestKind = 'story' | 'daily' | 'weekly' | 'village' | 'explore' | 'farm' | 'fish' | 'animal';

export interface QuestObjective {
  type: string; // harvest, collect, deliver, sell, catch, talk, build, restore, visit, craft, cook, till, water, plant, pet, mine, discover, chop, ...
  target?: string; // item/species/region id or '*' any
  count: number;
  progress: number;
}

export interface QuestState {
  id: string;
  kind: QuestKind;
  title: string;
  desc: string;
  giver?: string;
  objectives: QuestObjective[];
  rewards: { coins?: number; gems?: number; xp?: number; items?: ItemStack[]; friendship?: { npc: string; amount: number } };
  done: boolean;
  claimed: boolean;
}

export interface VillagerState {
  uid: string;
  name: string;
  look: Appearance;
  trait: string;
  homeUid: string | null;
  jobUid: string | null;
  happiness: number; // 0..100
  friendship: number; // 0..100
  arrivedDay: number;
  wish: { id: string; qty: number; until: number } | null;
  talkedDay: number;
  giftedDay: number;
}

export interface HamletState {
  name: string;
  placed: PlacedObject[];
  villagers: VillagerState[];
  /** daily production waiting in the register chest */
  chest: ItemStack[];
  coins: number;
  /** fractional production carried over between days */
  carry: Record<string, number>;
  level: number;
  goals: string[]; // completed goal ids
  lastDay: number;
}

export interface CollectionEntry {
  count: number;
  best?: number; // e.g. max fish size
  firstDay: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  savedAt: number;
  playSeconds: number;
  seed: number;
  /** Total elapsed game minutes since start (monotonic clock for regrowth timers). */
  absMinute: number;
  time: { day: number; minute: number };
  weather: { today: WeatherType; tomorrow: WeatherType; current: WeatherType; clearAt: number; rainbowUntil: number; lightning: number };
  player: {
    name: string;
    farmName: string;
    look: Appearance;
    region: RegionId;
    x: number;
    z: number;
    facing: number;
    coins: number;
    gems: number;
    xp: number;
    level: number;
    tools: Record<ToolId, number>;
    activeTool: ToolId;
    selectedSeed: string | null;
    buffs: Record<string, number>; // buff id -> absMinute until
    hasCoat: boolean;
    riding: boolean;
  };
  inventory: (ItemStack | null)[];
  inventorySize: number;
  storage: ItemStack[];
  farm: {
    plots: Record<string, PlotState>;
    placed: PlacedObject[];
    silo: number; // hay units
    shippingBin: ItemStack[];
    fruitTrees: { uid: string; kind: string; x: number; z: number; plantedAbs: number; lastHarvestDay: number }[];
  };
  house: {
    level: number;
    rooms: Record<string, { wall: string; floor: string; unlocked: boolean }>;
    furniture: PlacedObject[];
  };
  animals: AnimalState[];
  regions: Record<RegionId, RegionState>;
  village: Record<string, { restored: boolean; contributed: Record<string, number>; restoredDay: number }>;
  hamlet: HamletState;
  npcs: Record<string, NpcState>;
  quests: {
    active: QuestState[];
    completedIds: string[];
    storyStep: number;
    dailyDay: number;
    weeklyWeek: number;
    boardDay: number;
  };
  collections: Record<string, Record<string, CollectionEntry>>;
  milestones: string[];
  recipes: string[];
  wardrobe: string[];
  decorOwned: Record<string, number>; // decor/furniture items in "build bag"
  pass: { season: number; points: number; premium: boolean; claimedFree: number[]; claimedPremium: number[] };
  festivals: { attended: Record<string, number>; tokens: number; best: Record<string, number> };
  mine: { deepest: number; floor: number; seed: number };
  stats: Record<string, number>;
  flags: Record<string, any>;
  log: { day: number; text: string }[];
}
