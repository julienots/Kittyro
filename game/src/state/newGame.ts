import type { Appearance, GameState, RegionId, RegionState } from './types';
import { DAY_START, INVENTORY_START, SAVE_VERSION } from '../data/constants';
import { NPCS } from '../data/npcs';
import { VILLAGE_BUILDINGS } from '../data/village';
import { WEAR, wearKey } from '../data/wardrobe';

export const DEFAULT_LOOK: Appearance = {
  skin: 1,
  hairStyle: 1,
  hairColor: 2,
  eyeStyle: 0,
  eyeColor: 0,
  top: 'overalls',
  topColor: 0x5ab8e8,
  bottom: 'pants',
  bottomColor: 0x4a5a8a,
  shoes: 'boots',
  shoesColor: 0x8a5a3a,
  hat: 'straw',
  hatColor: 0xe8c86a,
  accessory: 'none',
  cheeks: true,
};

const region = (unlocked: boolean): RegionState => ({ unlocked, visited: false, nodes: {}, chests: [], secrets: [] });

/** Farm layout constants shared by the world builder and the logic. */
export const FARM = {
  /** tillable/buildable rectangle (inclusive min, exclusive max) */
  minX: 8,
  maxX: 40,
  minZ: 10,
  maxZ: 38,
  house: { x: 12, z: 11 },
  shippingBin: { x: 18, z: 14 },
  spawn: { x: 14.5, z: 17 },
};

export function createNewGame(name = 'Sacha', farmName = 'Ferme Moussue', look: Appearance = DEFAULT_LOOK, seed = Date.now()): GameState {
  const now = Date.now();
  const regions = {} as Record<RegionId, RegionState>;
  for (const id of ['farm', 'village', 'woods', 'mountains', 'coast', 'frosty', 'ember', 'mine', 'house'] as RegionId[]) {
    regions[id] = region(id === 'farm' || id === 'village' || id === 'house');
  }
  regions.farm.visited = true;

  const npcs: GameState['npcs'] = {};
  for (const n of NPCS) npcs[n.id] = { friendship: 0, talkedDay: 0, giftedDay: 0, met: false, giftsGiven: 0 };

  const village: GameState['village'] = {};
  for (const b of VILLAGE_BUILDINGS) village[b.id] = { restored: false, contributed: {}, restoredDay: 0 };

  const s: GameState = {
    version: SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    playSeconds: 0,
    seed: seed >>> 0,
    absMinute: DAY_START,
    time: { day: 1, minute: DAY_START },
    weather: { today: 'sun', tomorrow: 'sun', current: 'sun', clearAt: 0, rainbowUntil: 0, lightning: 0 },
    player: {
      name,
      farmName,
      look: { ...look },
      region: 'farm',
      x: FARM.spawn.x,
      z: FARM.spawn.z,
      facing: 0,
      coins: 500,
      gems: 10,
      xp: 0,
      level: 1,
      tools: { hoe: 0, can: 0, axe: 0, pickaxe: 0, rod: 0, sickle: 0 },
      activeTool: 'hoe',
      selectedSeed: null,
      buffs: {},
      hasCoat: false,
      riding: false,
    },
    inventory: new Array(INVENTORY_START).fill(null),
    inventorySize: INVENTORY_START,
    storage: [],
    farm: { plots: {}, placed: [], silo: 0, shippingBin: [], fruitTrees: [] },
    house: {
      level: 1,
      rooms: {
        bedroom: { wall: 'cream', floor: 'oak', unlocked: true },
        kitchen: { wall: 'mint', floor: 'checker', unlocked: true },
        living: { wall: 'sunny', floor: 'birch', unlocked: true },
        office: { wall: 'wood', floor: 'oak', unlocked: false },
        veranda: { wall: 'forest', floor: 'stone', unlocked: false },
      },
      furniture: [],
    },
    animals: [],
    regions,
    village,
    npcs,
    quests: { active: [], completedIds: [], storyStep: 0, dailyDay: 0, weeklyWeek: -1, boardDay: 0 },
    collections: { fish: {}, insects: {}, animals: {}, plants: {}, minerals: {}, recipes: {}, furniture: {}, flowers: {}, creatures: {} },
    milestones: [],
    recipes: [],
    wardrobe: WEAR.filter((w) => w.price === 0 && !w.gems && !w.tokens && !w.pass).map(wearKey),
    decorOwned: { fence_wood: 8, flower_pot: 2, lantern_pole: 1 },
    pass: { season: 1, points: 0, premium: false, claimedFree: [], claimedPremium: [], },
    festivals: { attended: {}, tokens: 0, best: {} },
    mine: { deepest: 0, floor: 0, seed: (seed * 7) >>> 0 },
    stats: {},
    flags: { theme: 'classic', trail: 'none', themesOwned: ['classic'], trailsOwned: ['none'] },
    log: [],
  };

  // Starter kit
  const starter: [string, number][] = [
    ['seed_lettuce', 8],
    ['seed_carrot', 4],
    ['seed_tulip', 2],
    ['wood', 10],
    ['bread', 2],
  ];
  starter.forEach(([id, qty], i) => (s.inventory[i] = { id, qty }));

  // House placed on the farm, plus a few starting plots near the house
  s.farm.placed.push({ uid: 'house', kind: 'house', x: FARM.house.x, z: FARM.house.z, rot: 0 });
  for (let x = 20; x < 24; x++) {
    for (let z = 18; z < 20; z++) {
      s.farm.plots[`${x},${z}`] = { x, z, watered: false, fertilized: 0, crop: null };
    }
  }
  // Starter furniture in the house
  s.house.furniture.push(
    { uid: 'f_bed', kind: 'bed_simple', x: 2, z: 2, rot: 0, room: 'bedroom' },
    { uid: 'f_stove', kind: 'stove', x: 9, z: 1, rot: 0, room: 'kitchen' },
    { uid: 'f_counter', kind: 'counter', x: 10, z: 1, rot: 0, room: 'kitchen' },
    { uid: 'f_table', kind: 'table_round', x: 15, z: 3, rot: 0, room: 'living' },
    { uid: 'f_rug', kind: 'rug_round', x: 2, z: 6, rot: 0, room: 'bedroom' },
    { uid: 'f_plant', kind: 'plant_tall', x: 19, z: 1, rot: 0, room: 'living' },
  );
  s.recipes = [];
  return s;
}
