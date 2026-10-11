import type { GameState, ToolId } from '../state/types';
import { EventBus } from '../core/EventBus';
import { Random } from '../core/Random';
import { InventorySystem } from './Inventory';
import { EconomySystem } from './Economy';
import { CollectionSystem } from './Collections';
import { FarmingSystem } from './Farming';
import { AnimalSystem } from './Animals';
import { CraftingSystem } from './Crafting';
import { QuestSystem } from './Quests';
import { VillageSystem } from './Village';
import { NpcSystem } from './Npcs';
import { FishingSystem } from './Fishing';
import { GatheringSystem } from './Gathering';
import { CreatureSystem } from './Creatures';
import { WeatherSystem } from './Weather';
import { TimeSystem } from './Time';
import { FestivalSystem } from './Festivals';
import { ShopSystem } from './Shop';
import { BuildingSystem } from './Building';
import { MiningSystem } from './Mining';
import { ToolSystem } from './Tools';
import { HamletSystem } from './Hamlet';
import { AdRewardSystem } from './AdRewards';

/** World queries the logic layer needs. The 3D world implements it; tests stub it. */
export interface TerrainQuery {
  isTillable(x: number, z: number): boolean;
  isBuildable(x: number, z: number): boolean;
}

export const OPEN_TERRAIN: TerrainQuery = { isTillable: () => true, isBuildable: () => true };

/**
 * Game context: owns the state and wires every logic system together.
 * Pure logic — no rendering, no DOM — so it runs headless in unit tests.
 */
export class Ctx {
  bus = new EventBus();
  rng: Random;
  terrain: TerrainQuery = OPEN_TERRAIN;

  inventory: InventorySystem;
  economy: EconomySystem;
  collections: CollectionSystem;
  farming: FarmingSystem;
  animals: AnimalSystem;
  crafting: CraftingSystem;
  quests: QuestSystem;
  village: VillageSystem;
  npcs: NpcSystem;
  fishing: FishingSystem;
  gathering: GatheringSystem;
  creatures: CreatureSystem;
  weather: WeatherSystem;
  time: TimeSystem;
  festivals: FestivalSystem;
  shop: ShopSystem;
  building: BuildingSystem;
  mining: MiningSystem;
  tools: ToolSystem;
  hamlet: HamletSystem;
  adRewards: AdRewardSystem;

  constructor(public state: GameState) {
    this.rng = new Random((state.seed ^ state.time.day * 7919) >>> 0);
    this.inventory = new InventorySystem(this);
    this.economy = new EconomySystem(this);
    this.collections = new CollectionSystem(this);
    this.farming = new FarmingSystem(this);
    this.animals = new AnimalSystem(this);
    this.crafting = new CraftingSystem(this);
    this.quests = new QuestSystem(this);
    this.village = new VillageSystem(this);
    this.npcs = new NpcSystem(this);
    this.fishing = new FishingSystem(this);
    this.gathering = new GatheringSystem(this);
    this.creatures = new CreatureSystem(this);
    this.weather = new WeatherSystem(this);
    this.time = new TimeSystem(this);
    this.festivals = new FestivalSystem(this);
    this.shop = new ShopSystem(this);
    this.building = new BuildingSystem(this);
    this.mining = new MiningSystem(this);
    this.tools = new ToolSystem(this);
    this.hamlet = new HamletSystem(this);
    this.adRewards = new AdRewardSystem(this);
    this.quests.init();
  }

  /** Notify quests/pass/stats about an activity. */
  progress(type: string, target = '*', amount = 1): void {
    this.state.stats[type] = (this.state.stats[type] ?? 0) + amount;
    this.quests.onProgress(type, target, amount);
    this.economy.addPassPoints(type, amount);
  }

  toast(text: string, icon = '✨', kind: 'info' | 'good' | 'warn' = 'info'): void {
    this.bus.emit('toast', { text, icon, kind });
  }

  log(text: string): void {
    this.state.log.unshift({ day: this.state.time.day, text });
    if (this.state.log.length > 60) this.state.log.length = 60;
  }

  hasBuff(id: string): boolean {
    return (this.state.player.buffs[id] ?? 0) > this.state.absMinute;
  }

  toolTier(t: ToolId): number {
    return this.state.player.tools[t] ?? 0;
  }
}
