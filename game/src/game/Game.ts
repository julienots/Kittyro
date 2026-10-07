import * as THREE from 'three';
import { Ctx } from '../systems/Context';
import type { GameState, RegionId, ToolId, Appearance } from '../state/types';
import { createNewGame, FARM } from '../state/newGame';
import { SaveManager } from '../save/SaveManager';
import { loadSettings, saveSettings, type Settings } from '../save/Settings';
import { Renderer } from '../render/Renderer';
import { SkyRig } from '../render/Sky';
import { CameraRig } from '../render/CameraRig';
import { Particles, PF } from '../render/Particles';
import { WeatherFX } from '../render/WeatherFX';
import { globalUniforms } from '../render/Materials';
import { World, type Interactable } from '../world/World';
import { T, WALKABLE } from '../world/Layout';
import { updateGlow, updateWindows } from '../world/PropFactory';
import { Player } from '../entities/Player';
import { EntityManager, type WildAgent } from '../entities/Agents';
import { Input } from '../input/Input';
import { audio } from '../audio/Audio';
import { UI } from '../ui/UI';
import { h, fmt } from '../ui/dom';
import { titleScreen, creatorScreen } from '../ui/screens';
import type { GameApi } from '../ui/types';
import { FishingGame } from '../minigames/Fishing';
import { runMinigame, type MiniId, MINI_INFO } from '../minigames/Festival';
import { Placement } from './Placement';
import { NODE_KINDS } from '../data/nodes';
import { item } from '../data/items';
import { NPC_BY_ID } from '../data/npcs';
import { REGION_BY_ID } from '../data/regions';
import { CREATURE_BY_ID } from '../data/creatures';
import { INSECT_BY_ID } from '../data/insects';
import { ANIMAL_BY_ID } from '../data/animals';
import { VILLAGE_BY_ID } from '../data/village';
import { BUILDING_BY_ID } from '../data/buildings';
import { DECOR_BY_ID } from '../data/decor';
import { RARITY_COLOR, RARITY_NAME } from '../data/fish';
import { TOOL_BY_ID, toolArea } from '../data/tools';
import { BUFF_NAMES } from '../data/recipes';
import { FESTIVAL_BY_ID } from '../data/festivals';
import { FRUIT_TREES } from '../data/resources';
import { seasonOfDay, isNight, SEASON_NAMES, SECONDS_PER_GAME_MINUTE } from '../data/constants';
import { WEATHER_NAMES, WEATHER_ICONS } from '../systems/Weather';
import { footprintOf } from '../systems/Building';
import { structureGeo } from '../models/Buildings';
import { vcMat } from '../render/Materials';
import { emojiSprite } from '../render/EmojiSprite';
import type { MineFloor } from '../systems/Mining';
import { rng } from '../core/Random';

interface ActionTarget {
  icon: string;
  label: string;
  run: () => void;
  x?: number;
  z?: number;
}

const MUSIC_BY_REGION: Record<string, string> = { farm: 'farm', village: 'village', woods: 'forest', mountains: 'mountain', coast: 'beach', frosty: 'winter', ember: 'ember', mine: 'cave', house: 'home' };

export class Game implements GameApi {
  settings: Settings;
  saves: SaveManager;
  renderer: Renderer;
  sky = new SkyRig();
  rig: CameraRig;
  particles: Particles;
  weatherFx: WeatherFX;
  ctx!: Ctx;
  world!: World;
  player!: Player;
  entities!: EntityManager;
  fishing!: FishingGame;
  placement!: Placement;
  input: Input;
  ui: UI;
  audio = audio;
  hasSave = false;
  inShopRange = false;
  private clock = new THREE.Clock();
  private paused = 0;
  private running = false;
  private title = true;
  private elapsed = 0;
  private actionT = 0;
  private current: ActionTarget | null = null;
  private autosaveT = 40;
  private musicT = 0;
  private portalCooldown = 0;
  private refreshNodesT = 0;
  private lastSeason = '';
  private mineFloor: MineFloor | null = null;
  private mineLadder: THREE.Object3D | null = null;
  private mineLadderPos: { x: number; z: number } | null = null;
  private lastDayCoins = 0;
  private contestTimer = 0;
  private previewRig: Player | null = null;
  private dayCoinsStart = 0;
  private festivalSprite: THREE.Sprite | null = null;
  private tapMarker: THREE.Mesh;
  private offs: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.settings = loadSettings();
    this.saves = SaveManager.auto();
    this.renderer = new Renderer(canvas, this.settings.quality);
    this.renderer.autoQuality = this.settings.autoQuality;
    this.rig = new CameraRig(this.renderer.camera);
    this.particles = new Particles(this.settings.quality === 'low' ? 700 : 1600);
    this.particles.budget = this.renderer.profile.particles;
    this.weatherFx = new WeatherFX(this.particles, this.settings.quality === 'low' ? 400 : 900);
    const scene = this.renderer.scene;
    scene.add(this.sky.group, this.particles.group, this.weatherFx.group);
    this.sky.setShadowSize(this.renderer.profile.shadow);
    this.ui = new UI(this);
    this.input = new Input(canvas, this.ui.root);
    this.tapMarker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.36, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(this.tapMarker);
    this.applyInputSettings();
    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    window.addEventListener('pagehide', () => this.save());
  }

  // ------------------------------------------------------------ GameApi basics
  get camera(): THREE.Camera {
    return this.renderer.camera;
  }
  get regionId(): RegionId {
    return this.world?.region ?? 'farm';
  }
  fps(): string {
    return this.renderer.info();
  }
  setPaused(p: boolean): void {
    this.paused = Math.max(0, this.paused + (p ? 1 : -1));
    if (!p && !this.ui.modalOpen && !this.ui.dialogueEl) this.paused = 0;
  }
  saveSettings(): void {
    saveSettings(this.settings);
    audio.volumes = { music: this.settings.music, sfx: this.settings.sfx, ambience: this.settings.ambience };
    audio.applyVolumes();
    if (this.settings.quality !== this.renderer.quality) {
      this.renderer.applyQuality(this.settings.quality);
      this.sky.setShadowSize(this.renderer.profile.shadow);
      this.particles.budget = this.renderer.profile.particles;
      if (this.ctx) this.loadRegion(this.world.region, null, true);
    }
    this.renderer.autoQuality = this.settings.autoQuality;
    this.applyInputSettings();
    this.ui.applyLayout();
  }
  private applyInputSettings(): void {
    this.input.mode = this.settings.controls;
    this.input.leftHanded = this.settings.leftHanded;
  }

  // ------------------------------------------------------------ boot
  async boot(): Promise<void> {
    audio.volumes = { music: this.settings.music, sfx: this.settings.sfx, ambience: this.settings.ambience };
    const existing = await this.saves.load();
    this.hasSave = !!existing;
    // a living demo farm behind the title screen
    const demo = createNewGame('', '', undefined, 777);
    demo.time.minute = 17 * 60;
    this.setupState(demo);
    this.loadRegion('farm', 'spawn', true);
    this.title = true;
    this.running = true;
    this.loop();
    titleScreen(this.ui, this.hasSave, () => this.continueGame(), () => creatorScreen(this.ui, (n, f, l) => this.newGame(n, f, l)));
    (window as any).__game = this;
  }

  private setupState(state: GameState): void {
    for (const off of this.offs) off();
    this.offs = [];
    if (this.world) {
      this.world.dispose();
      this.renderer.scene.remove(this.world.root, this.entities.group, this.player.root);
    }
    this.ctx = new Ctx(state);
    this.world = new World(this.ctx, this.particles, () => this.renderer.profile.grass, () => this.renderer.profile.lights);
    this.ctx.terrain = {
      isTillable: (x, z) => this.world.region === 'farm' && this.tileFree(x, z, [T.GRASS, T.DIRT]),
      isBuildable: (x, z) => this.world.region === 'farm' && this.tileFree(x, z, [T.GRASS, T.DIRT, T.PATH]),
    };
    this.player = new Player(this.ctx, this.world, this.particles);
    this.player.outline = this.renderer.profile.outlines;
    this.player.rebuild();
    this.entities = new EntityManager(this.ctx, this.world, this.particles);
    this.entities.outline = this.renderer.profile.outlines;
    this.renderer.scene.add(this.world.root, this.entities.group, this.player.root);
    this.fishing?.end();
    this.fishing = new FishingGame(this.ctx, this.player, this.particles, this.ui, audio, this.renderer.scene);
    this.placement = new Placement(this.ctx, this.world, this.ui, this.rig, this.renderer.scene);
    this.placement.onDone = () => {
      this.input.dragMode = false;
      this.refreshWorld(this.world.region === 'house' ? 'house' : 'placed');
    };
    this.ctx.tools.refill();
    this.wireEvents();
    this.input.onTap = (nx, ny) => this.onTap(nx, ny);
    this.input.onZoom = (d) => this.rig.setZoom(this.rig.zoomTarget + d);
    this.input.onKey = (k) => this.onKey(k);
    this.input.onDrag = (nx, ny) => this.placement.drag(nx, ny);
    this.ui.onAction = () => this.primaryAction();
    this.ui.onTool = () => this.useTool();
  }

  private tileFree(x: number, z: number, allowed: number[]): boolean {
    const L = this.world.layout;
    if (!L || x < 0 || z < 0 || x >= L.w || z >= L.d) return false;
    const t = L.tiles[z * L.w + x];
    if (!allowed.includes(t) || L.blocked[z * L.w + x]) return false;
    for (const nv of this.world.nodes) if (Math.floor(nv.node.x) === x && Math.floor(nv.node.z) === z && nv.growth > 0.05 && !(nv.node.once && nv.growth < 1)) return false;
    return true;
  }

  newGame(name: string, farm: string, look: Appearance): void {
    const st = createNewGame(name, farm, look, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    this.start(st, true);
  }

  async continueGame(): Promise<void> {
    const st = await this.saves.load();
    if (!st) {
      creatorScreen(this.ui, (n, f, l) => this.newGame(n, f, l));
      return;
    }
    const away = (Date.now() - st.savedAt) / 1000;
    this.start(st, false);
    const mins = this.ctx.time.catchUp(away);
    if (mins > 30) this.ui.toast(`Pendant votre absence, vos cultures ont poussé (${Math.round(mins / 60)} h) 🌱`, '🌙', 'good');
  }

  private start(st: GameState, isNew: boolean): void {
    this.ui.fade(() => {
      this.setupState(st);
      this.title = false;
      let region = st.player.region;
      let anchor: string | null = null;
      if (region === 'mine') {
        region = 'mountains';
        anchor = 'mine_door';
      }
      if (!st.regions[region]?.unlocked) {
        region = 'farm';
        anchor = 'spawn';
      }
      this.ctx.quests.refresh();
      this.loadRegion(region, anchor, true, isNew ? undefined : { x: st.player.x, z: st.player.z });
      this.ui.buildHud();
      this.dayCoinsStart = st.player.coins;
      if (isNew) {
        this.save();
        setTimeout(() => this.ui.toast(`Bienvenue à ${st.player.farmName} ! Allez parler à Moss 👴`, '🌿', 'good'), 1200);
      }
    }, isNew ? `Jour 1 · ${SEASON_NAMES.spring}` : '');
  }

  async resetGame(): Promise<void> {
    await this.saves.wipe();
    location.reload();
  }

  // ------------------------------------------------------------ events
  private wireEvents(): void {
    const bus = this.ctx.bus;
    const on = (e: string, f: (p: any) => void) => this.offs.push(bus.on(e, f));
    const head = () => this.player.pos.clone().add(new THREE.Vector3(0, 1.7, 0));
    on('toast', (p) => this.ui.toast(p.text, p.icon, p.kind));
    on('item:gained', (p) => this.ui.float(head(), `+${p.qty}`, (DECOR_BY_ID[p.id]?.icon ?? item(p.id).icon)));
    on('harvested', (p) => {
      this.ui.float(head(), `+${p.qty} ${item(p.id).name}`, item(p.id).icon);
      audio.play('harvest');
    });
    on('coins:changed', (p) => { if (p.delta > 0 && !p.silent) { this.ui.float(head().add(new THREE.Vector3(0, 0.3, 0)), `+${fmt(p.delta)}`, '🪙'); audio.play('coin'); } });
    on('gems:changed', (p) => { if (p.delta > 0) { this.ui.float(head(), `+${p.delta}`, '💎'); audio.play('gem'); } });
    on('levelup', (p) => {
      audio.play('levelup');
      this.ui.confetti();
      this.player.celebrate();
      this.ui.reveal(() => h('div', null, h('span.em', null, '⭐'), h('h2', null, `Niveau ${p.level} !`), h('p', null, 'Nouvelles graines, recettes et animaux disponibles. +5 💎')));
    });
    on('quest:done', (p) => { audio.play('quest'); this.ui.toast(`Quête terminée : ${p.title}`, '📜', 'good'); });
    on('quest:new', (p) => { if (p.story) setTimeout(() => this.ui.toast(`Nouvelle quête : ${p.title}`, '⭐'), 600); });
    on('collection:new', (p) => { if (p.cat !== 'creatures' && p.cat !== 'fish') this.ui.toast(`Nouvelle entrée de collection : ${item(p.id).name !== p.id ? item(p.id).name : DECOR_BY_ID[p.id]?.name ?? p.id}`, '📖'); });
    on('milestone', (p) => this.ui.toast(`Collection ${Math.round(p.pct * 100)}% ! +${p.gems} 💎`, '🏆', 'good'));
    on('village:restored', (p) => {
      audio.play('build');
      this.ui.confetti();
      if (this.world.region === 'village') this.loadRegion('village', null, true, { x: this.player.pos.x, z: this.player.pos.z });
      this.ui.reveal(() => h('div', null, h('span.em', null, VILLAGE_BY_ID[p.id].icon), h('h2', null, `${p.name} restauré(e) !`), h('p', null, VILLAGE_BY_ID[p.id].benefit)));
    });
    on('region:unlocked', (p) => {
      audio.play('discover');
      this.ui.confetti();
      setTimeout(() => this.ui.openPanel('map', p.id), 400);
    });
    on('creature:discovered', (p) => {
      const c = CREATURE_BY_ID[p.id];
      if (p.isNew) {
        audio.play('discover');
        this.ui.reveal(() => h('div', null, h('span.em', null, '📖'), h('h2', null, c.name), h('span.rarity', { style: { background: RARITY_COLOR[c.rarity] } }, RARITY_NAME[c.rarity]), h('p', null, c.desc), h('p.muted', null, 'Ajouté au Bestiaire !')));
      } else this.ui.toast(`${c.name} vous salue !`, '🐾');
    });
    on('insect:caught', (p) => {
      audio.play(p.isNew ? 'discover' : 'pop');
      this.ui.toast(`${p.isNew ? 'Nouveau ! ' : ''}${INSECT_BY_ID[p.id].name}`, INSECT_BY_ID[p.id].icon, p.isNew ? 'good' : 'info');
    });
    on('friend:level', (p) => this.ui.toast(`Amitié avec ${NPC_BY_ID[p.npc].name} : niveau ${p.level} 🍃`, '💚', 'good'));
    on('friend:reward', (p) => this.ui.toast(`${NPC_BY_ID[p.npc].name} vous offre : ${p.reward}`, '🎁', 'good'));
    on('festival:start', (p) => { this.ui.toast(`${p.name} commence au village !`, FESTIVAL_BY_ID[p.id]?.icon ?? '🎉', 'good'); this.musicT = 0; });
    on('rainbow', () => { this.ui.toast('Un arc-en-ciel ! Les créatures rares sortent...', '🌈', 'good'); this.ctx.state.flags.rainbowDay = this.ctx.state.time.day; });
    on('lightning', () => { this.sky.flash = 1.2; setTimeout(() => audio.play('thunder'), 300 + Math.random() * 900); });
    on('weather:changed', () => { this.musicT = 0; });
    on('buff', (p) => this.ui.toast(BUFF_NAMES[p.id] ?? 'Bonus', '✨', 'good'));
    on('pass:tier', (p) => this.ui.toast(`Cozy Pass : palier ${p.tier} atteint !`, '🎟️', 'good'));
    on('mine:deepest', (p) => this.ui.toast(`Nouveau record : niveau ${p.floor}`, '⛏️', 'good'));
    on('tool:upgraded', () => this.player.showTool(null));
    on('step', (p) => audio.play('step', p));
    on('animal:sound', (p) => audio.play('animal', p));
    on('animal:react', (p) => this.entities.animal(p.uid)?.react(p.kind));
    on('animals:changed', () => this.entities.syncAnimals());
    on('plot:changed', (p) => {
      if (!this.world.farm) return;
      if (p.kind === 'grow') this.world.farm.rebuildCrops();
      else this.world.farm.refreshPlots();
      if (p.kind === 'till' || p.kind === 'untill') this.world.rebuildGrass();
    });
    on('plots:reset', () => this.world.farm?.refreshPlots());
    on('crop:ready', () => this.world.farm?.rebuildCrops());
    on('trees:changed', () => this.world.farm?.refreshTrees());
    on('node:depleted', (p) => this.onNodeDepleted(p));
    on('day:start', () => this.onDayStart());
    on('slept', (p) => this.onSlept(p.passedOut));
    on('finale', () => {
      this.ui.confetti();
      this.ui.reveal(() => h('div', null, h('span.em', null, '🌈'), h('h2', null, 'Willowbrook revit !'), h('p', null, 'Grâce à vous, la vallée a retrouvé ses couleurs. L\'aventure continue : à vous de cultiver, explorer et décorer à votre rythme. 💚')));
    });
  }

  // ------------------------------------------------------------ regions
  loadRegion(region: RegionId, anchor: string | null, silent = false, pos?: { x: number; z: number }): void {
    const st = this.ctx.state;
    const prevRegion = this.world.layout ? this.world.region : null;
    this.fishing.end();
    this.placement.cancel(false);
    this.input.dragMode = false;
    let floor: MineFloor | undefined;
    if (region === 'mine') {
      floor = this.ctx.mining.generate(Math.max(1, st.mine.floor));
      this.mineFloor = floor;
    } else this.mineFloor = null;
    this.mineLadder?.removeFromParent();
    this.mineLadder = null;
    this.mineLadderPos = null;
    this.world.load(region, floor);
    st.player.region = region;
    if (region !== 'house' && region !== 'mine') this.lastSeason = seasonOfDay(st.time.day);
    if (region === 'house' || region === 'mine' || region === 'frosty') st.player.riding = region === 'frosty' ? st.player.riding : false;
    this.player.updateRiding();
    this.entities.populate();
    const a = anchor ? this.world.layout.anchors[anchor] : null;
    const p = pos ?? a ?? this.world.layout.anchors.spawn ?? this.world.layout.anchors.entry ?? { x: this.world.layout.w / 2, z: this.world.layout.d / 2 };
    let sx = p.x, sz = p.z;
    if (this.world.isBlocked(sx, sz, 0.25)) {
      const free = this.world.randomWalkable(sx, sz, 2.5, rng);
      if (free) { sx = free.x; sz = free.z; }
    }
    this.player.teleport(sx, sz, Math.PI * 0.25);
    this.rig.snap(this.player.pos);
    this.rig.mode = region === 'house' ? 'house' : region === 'mine' ? 'cave' : 'outdoor';
    this.sky.indoor = region === 'house' ? 'house' : region === 'mine' ? 'cave' : 'none';
    this.sky.aurora = region === 'frosty' ? 1 : 0;
    this.sky.tint.set(region === 'ember' ? 0xffd0b0 : 0xffffff);
    const L = this.world.layout;
    this.rig.bounds = region === 'house' ? { x0: 8, z0: 5, x1: 14, z1: 9 } : { x0: 2, z0: 2, x1: L.w - 2, z1: L.d - 2 };
    this.player.setLantern(region === 'mine');
    this.particles.clear();
    if (region === 'mine' && floor && floor.floor % 5 === 0) this.revealLadder(11.5, 6.5);
    this.festivalSprite?.removeFromParent();
    this.festivalSprite = null;
    this.musicT = 0;
    // first visits
    const rs = st.regions[region];
    if (!rs.visited) {
      rs.visited = true;
      if ((!silent || prevRegion) && region !== 'house' && region !== 'mine') {
        const def = REGION_BY_ID[region];
        setTimeout(() => this.ui.reveal(() => h('div', null, h('span.em', null, def.icon), h('h2', null, def.name), h('p', null, def.desc))), 500);
        audio.play('discover');
      }
    }
    this.ctx.progress('visit', region);
    if (this.weatherFx) this.placePuddles();
  }

  travel(region: RegionId, anchor?: string): void {
    if (this.title) return;
    const st = this.ctx.state;
    if (!st.regions[region].unlocked) {
      this.ui.toast(REGION_BY_ID[region].unlockHint, '🔒', 'warn');
      return;
    }
    // default arrival anchors
    const defaults: Record<string, string> = { farm: 'spawn', village: 'farm_entry', woods: 'farm_entry', mountains: 'farm_entry', coast: 'village_entry', frosty: 'mountains_entry', ember: 'village_entry', house: 'door' };
    audio.play('door');
    this.ui.fade(() => {
      this.loadRegion(region, anchor ?? defaults[region] ?? null);
      this.save();
    });
  }

  goMine(floor: number): void {
    this.ctx.state.mine.floor = floor;
    this.ctx.mining.reachFloor(floor);
    this.ctx.gathering.resetTransient();
    audio.play('door');
    this.ui.fade(() => this.loadRegion('mine', 'entry'), `Mine · niveau ${floor}`);
  }

  private revealLadder(x: number, z: number): void {
    this.mineLadderPos = { x, z };
    const m = new THREE.Mesh(structureGeo('ladder_down'), vcMat());
    m.position.set(x, this.world.heightAt(x, z) + 0.02, z);
    this.world.root.add(m);
    this.mineLadder = m;
  }

  private onNodeDepleted(p: { id: string; region: string; drops: { id: string; qty: number }[] }): void {
    const nv = this.world.node(p.id);
    if (nv) {
      const k = NODE_KINDS[nv.node.kind];
      const y = this.world.heightAt(nv.node.x, nv.node.z);
      if (k.tool === 'axe') {
        this.particles.leaves(nv.node.x, y + 1.4, nv.node.z, this.world.season === 'autumn' ? 0xe8903a : 0x6cbf4c, 14);
        audio.play('fall');
        this.rig.shake(0.1, 0.25);
      } else if (k.tool === 'pickaxe') {
        this.particles.dust(nv.node.x, y + 0.2, nv.node.z, 0xb0aaa0, 12);
        audio.play('break');
      } else this.particles.dust(nv.node.x, y + 0.1, nv.node.z, 0xd8f0b0, 6);
      for (const d of p.drops) this.ui.float(new THREE.Vector3(nv.node.x, y + 1.2, nv.node.z), `+${d.qty}`, item(d.id).icon);
      // mine: ladder hidden under this rock?
      if (this.world.region === 'mine' && this.mineFloor) {
        const r = this.mineFloor.rocks.find((q) => q.id === p.id);
        if (r?.ladder) {
          this.revealLadder(r.x, r.z);
          this.ui.toast('Une échelle vers le niveau suivant !', '🪜', 'good');
          audio.play('sparkle');
        }
      }
    }
    this.world.refreshNodes();
  }

  // ------------------------------------------------------------ day cycle
  private onDayStart(): void {
    const st = this.ctx.state;
    const season = seasonOfDay(st.time.day);
    if (season !== this.lastSeason && this.world.region !== 'house' && this.world.region !== 'mine') {
      this.lastSeason = season;
      this.loadRegion(this.world.region, null, true, { x: this.player.pos.x, z: this.player.pos.z });
      this.ui.toast(`Le ${SEASON_NAMES[season].toLowerCase()} arrive dans la vallée !`, '🍃', 'good');
    } else {
      this.world.refreshNodes();
      this.world.farm?.refreshPlots();
      this.world.farm?.refreshTrees();
    }
    this.placePuddles();
    this.save();
  }

  private onSlept(passedOut: boolean): void {
    const st = this.ctx.state;
    const earned = Math.max(0, st.stats.coinsEarned ?? 0) - this.lastDayCoins;
    this.lastDayCoins = st.stats.coinsEarned ?? 0;
    if (passedOut || this.world.region !== 'house') this.loadRegion('house', 'bed', true);
    const fest = this.ctx.festivals.today();
    this.ui.openPanel('daySummary', {
      day: st.time.day, earned, passedOut,
      weather: `${WEATHER_ICONS[st.weather.today]} ${WEATHER_NAMES[st.weather.today]}`,
      forecast: `${WEATHER_ICONS[st.weather.tomorrow]} ${WEATHER_NAMES[st.weather.tomorrow]}`,
      fest: fest && fest.id !== 'rainbow' ? `${fest.icon} Aujourd'hui : ${fest.name} !` : undefined,
    });
  }

  sleep(): void {
    this.ui.fade(() => {
      audio.play('sleep');
      this.ctx.time.sleep(false);
    }, '💤 Bonne nuit…', true);
  }

  private placePuddles(): void {
    const L = this.world.layout;
    const pts: { x: number; z: number; y: number }[] = [];
    if (!L.indoor) for (let i = 0; i < 300 && pts.length < 30; i++) {
      const x = rng.int(2, L.w - 3) + 0.5, z = rng.int(2, L.d - 3) + 0.5;
      const t = L.tiles[Math.floor(z) * L.w + Math.floor(x)];
      if ((t === T.PATH || t === T.GRASS || t === T.PLAZA) && !L.blocked[Math.floor(z) * L.w + Math.floor(x)]) pts.push({ x, z, y: this.world.heightAt(x, z) });
    }
    this.weatherFx.placePuddles(pts);
  }

  // ------------------------------------------------------------ main loop
  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;
    try {
      this.frame(dt);
    } catch (e) {
      console.error('[frame]', e);
    }
  };

  private frame(dt: number): void {
    const st = this.ctx.state;
    globalUniforms.uTime.value = this.elapsed;
    const active = !this.title && this.paused === 0 && !this.ui.modalOpen && !this.ui.dialogueEl;
    if (active && !this.placement.active && !this.placement.editMode) {
      this.ctx.time.update(dt);
      st.playSeconds += dt;
    }
    if (this.title) {
      this.rig.yaw += dt * 0.04;
      st.time.minute = 17 * 60 + Math.sin(this.elapsed * 0.05) * 30;
    }
    // input -> world space movement
    this.input.enabled = !this.title && !this.placement.active;
    this.input.update();
    let mx = 0, mz = 0;
    if (active && !this.fishing.active) {
      mx = this.rig.right.x * this.input.moveX + this.rig.forward.x * this.input.moveY;
      mz = this.rig.right.z * this.input.moveX + this.rig.forward.z * this.input.moveY;
    }
    if (this.title) this.player.root.visible = false;
    else this.player.root.visible = !this.previewRig;
    const prev = this.player.pos.clone();
    this.player.update(active ? dt : 0, mx, mz, this.sky.state.night);
    st.stats.walked = (st.stats.walked ?? 0) + prev.distanceTo(this.player.pos);
    const speed = prev.distanceTo(this.player.pos) / Math.max(dt, 0.001);
    this.entities.update(active || this.title ? dt : 0, this.player.pos, speed);
    this.fishing.update(dt);
    // camera & sky
    this.rig.update(dt, this.player.pos, this.player.vel);
    this.rig.updateSeeThrough(this.player.pos);
    const weather = this.world.layout.indoor ? 'sun' : st.weather.current;
    this.sky.overcast += ((weather === 'rain' ? 0.7 : weather === 'storm' ? 1 : weather === 'cloudy' ? 0.45 : weather === 'fog' ? 0.6 : weather === 'snow' ? 0.5 : 0) - this.sky.overcast) * Math.min(1, dt);
    this.sky.storm = weather === 'storm' ? 1 : 0;
    this.sky.update(st.time.minute, this.elapsed, this.player.pos, this.renderer.scene);
    const fog = this.renderer.scene.fog as THREE.Fog;
    const fogK = weather === 'fog' ? 0.45 : weather === 'snow' || weather === 'rain' ? 0.75 : 1;
    fog.near = (this.world.region === 'mine' ? 22 : 42) * fogK;
    fog.far = (this.renderer.profile.drawDistance + 20) * fogK;
    globalUniforms.uSnow.value = this.world.layout.seasonal && seasonOfDay(st.time.day) === 'winter' ? 1 : this.world.region === 'frosty' ? 1 : 0;
    updateGlow(this.sky.state.night);
    updateWindows(this.sky.state.night);
    const night = this.sky.state.night;
    this.world.update(dt, this.elapsed, night, this.player.pos, this.renderer.camera);
    this.weatherFx.update(dt, this.player.pos, weather, seasonOfDay(st.time.day), night, this.ctx.weather.rainbow(), !this.world.layout.indoor, this.world.region, (x, z) => this.world.heightAt(x, z), this.renderer.camera);
    this.particles.update(dt);
    // periodic logic
    this.refreshNodesT -= dt;
    if (this.refreshNodesT <= 0) {
      this.refreshNodesT = 2;
      this.world.refreshNodes();
    }
    if (!this.title) {
      this.updateInteraction(dt);
      this.checkPortals(dt);
      this.updateFestival(dt);
      this.autosaveT -= dt;
      if (this.autosaveT <= 0) {
        this.autosaveT = 40;
        this.save();
      }
    }
    this.updateAudio(dt);
    // tap marker fade
    const tm = this.tapMarker.material as THREE.MeshBasicMaterial;
    tm.opacity = Math.max(0, tm.opacity - dt * 1.5);
    this.tapMarker.scale.setScalar(1 + (0.6 - tm.opacity));
    this.ui.update(dt);
    this.renderer.trackFps(dt);
    this.renderer.render();
    (window as any).__frames = ((window as any).__frames ?? 0) + 1;
  }

  private updateAudio(dt: number): void {
    if (!audio.ctx) return;
    const st = this.ctx.state;
    this.musicT -= dt;
    const r = this.world.region;
    const outdoor = !this.world.layout.indoor;
    const night = isNight(st.time.minute);
    if (this.musicT <= 0) {
      this.musicT = 3;
      let theme = MUSIC_BY_REGION[r] ?? 'farm';
      if (this.title) theme = 'title';
      else if (this.ctx.festivals.active() && r === 'village') theme = 'festival';
      else if (outdoor && (st.weather.current === 'rain' || st.weather.current === 'storm')) theme = 'rain';
      else if (outdoor && night) theme = 'night';
      else if (outdoor && seasonOfDay(st.time.day) === 'winter' && r !== 'ember' && r !== 'coast') theme = 'winter';
      audio.setTheme(theme);
      const nearWater = this.world.nearWater(this.player.pos.x, this.player.pos.z, 4);
      audio.setAmbience({
        wind: outdoor ? (r === 'mountains' || r === 'frosty' ? 0.7 : 0.25) : 0,
        water: nearWater && r !== 'coast' ? 0.6 : 0,
        rain: outdoor ? this.weatherFx.rainAmount : 0,
        waves: r === 'coast' ? 0.8 : 0,
        lava: r === 'ember' ? 0.7 : 0,
        fire: this.world.firePoints.some((p) => p.distanceTo(this.player.pos) < 6) ? 0.5 : 0,
      });
    }
    const raining = st.weather.current === 'rain' || st.weather.current === 'storm';
    const season = seasonOfDay(st.time.day);
    audio.tickAmbience(dt, {
      birds: outdoor && !night && !raining && season !== 'winter' && r !== 'ember' ? 1 : 0,
      crickets: outdoor && night && season !== 'winter' && r !== 'frosty' ? 1 : 0,
      drips: r === 'mine' ? 1 : 0,
    });
  }

  // ------------------------------------------------------------ interaction
  private frontPoint(d = 0.8): { x: number; z: number } {
    return { x: this.player.pos.x + Math.sin(this.player.facing) * d, z: this.player.pos.z + Math.cos(this.player.facing) * d };
  }

  private updateInteraction(dt: number): void {
    this.actionT -= dt;
    if (this.actionT > 0) return;
    this.actionT = 0.12;
    if (this.fishing.active) {
      const ph = this.fishing.phase;
      this.ui.setAction({ icon: ph === 'bite' ? '❗' : '🎣', label: ph === 'bite' ? 'Ferrer !' : ph === 'wait' ? 'Patience…' : 'Pêche', enabled: true });
      return;
    }
    this.current = this.findTarget();
    if (this.current) this.ui.setAction({ icon: this.current.icon, label: this.current.label, enabled: true });
    else {
      const t = TOOL_BY_ID[this.ctx.state.player.activeTool];
      this.ui.setAction({ icon: t.icon, label: t.name, enabled: false });
    }
  }

  /** Everything you can interact with, sorted by distance (facing bonus). */
  private findTarget(): ActionTarget | null {
    const st = this.ctx.state;
    const px = this.player.pos.x, pz = this.player.pos.z;
    const fx = Math.sin(this.player.facing), fz = Math.cos(this.player.facing);
    const score = (x: number, z: number, radius: number): number => {
      const dx = x - px, dz = z - pz;
      const d = Math.hypot(dx, dz);
      if (d > radius) return Infinity;
      const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      return d - facing * 0.6;
    };
    let best: ActionTarget | null = null;
    let bestS = Infinity;
    const consider = (s: number, t: () => ActionTarget | null) => {
      if (s < bestS) {
        const a = t();
        if (a) {
          best = a;
          bestS = s;
        }
      }
    };
    // entities & structures
    for (const it of [...this.entities.interactables(), ...this.world.interactables]) consider(score(it.x, it.z, it.radius), () => this.interactableAction(it));
    // farm specifics
    if (this.world.region === 'farm') {
      const bin = FARM.shippingBin;
      consider(score(bin.x + 0.5, bin.z + 0.5, 1.6), () => ({ icon: '📦', label: 'Expédier', run: () => this.ui.openPanel('sell', 'bin') }));
      for (const p of st.farm.placed) {
        const def = BUILDING_BY_ID[p.kind];
        if (!def) continue;
        const door = this.world.farm?.doorOf(p.uid);
        if (!door) continue;
        consider(score(door.x, door.z, p.kind === 'house' ? 1.5 : 1.4) + 0.2, () => this.buildingAction(p.uid, p.kind));
      }
      for (const t of st.farm.fruitTrees) {
        if (!this.ctx.farming.treeHasFruit(t)) continue;
        consider(score(t.x + 0.5, t.z + 0.5, 1.5), () => ({ icon: FRUIT_TREES.find((f) => f.id === t.kind) ? item(FRUIT_TREES.find((f) => f.id === t.kind)!.fruit).icon : '🍎', label: 'Cueillir', run: () => this.player.act('pet', null, () => { this.ctx.farming.harvestTree(t.uid); }, 0.5) }));
      }
    }
    if (this.world.region === 'house') {
      const door = this.world.layout.anchors.door;
      consider(score(door.x, door.z, 1.4), () => ({ icon: '🚪', label: 'Sortir', run: () => this.travel('farm', 'house_entry') }));
      for (const f of st.house.furniture) {
        const def = DECOR_BY_ID[f.kind];
        const fp = footprintOf(f.kind, f.x, f.z, f.rot);
        const cx = (fp.x0 + fp.x1) / 2, cz = (fp.z0 + fp.z1) / 2;
        const r = Math.max(fp.w, fp.d) / 2 + 0.9;
        if (def.cat === 'bed') consider(score(cx, cz, r), () => ({ icon: '🛏️', label: 'Dormir', run: () => this.ui.confirm('Dormir jusqu\'à demain matin ?', () => this.sleep(), '💤 Dormir', 'Pas encore') }));
        if (f.kind === 'stove' || f.kind === 'counter' || f.kind === 'fridge') consider(score(cx, cz, r), () => ({ icon: '🍳', label: 'Cuisiner', run: () => this.ui.openPanel('craft', 'kitchen') }));
        if (f.kind === 'wardrobe' || f.kind === 'mirror' || f.kind === 'dresser') consider(score(cx, cz, r), () => ({ icon: '👗', label: 'Garde-robe', run: () => this.ui.openPanel('wardrobe') }));
      }
    }
    if (this.mineLadderPos) consider(score(this.mineLadderPos.x, this.mineLadderPos.z, 1.3), () => ({ icon: '🪜', label: 'Descendre', run: () => this.goMine((this.mineFloor?.floor ?? 1) + 1) }));
    // nodes in reach
    for (const nv of this.world.nodesNear(px, pz, 2.2)) {
      if (nv.growth < 1) continue;
      const k = NODE_KINDS[nv.node.kind];
      if (!k) continue;
      consider(score(nv.node.x, nv.node.z, k.radius * nv.baseScale + 1.0) + 0.3, () => this.nodeAction(nv.node.id));
    }
    // farming in front
    if (this.world.region === 'farm') {
      const fp = this.frontPoint(0.75);
      const tx = Math.floor(fp.x), tz = Math.floor(fp.z);
      const plot = this.ctx.farming.plot(tx, tz);
      if (plot?.crop?.ready) consider(0.9, () => ({ icon: item(plot.crop!.id).icon, label: 'Récolter', run: () => this.harvestAt(tx, tz) }));
      else if (plot && !plot.crop) {
        const seed = this.currentSeed();
        if (seed) consider(1.2, () => ({ icon: '🌱', label: `Planter ${item(seed.replace('seed_', '')).name}`, run: () => this.plantAt(tx, tz, seed) }));
      } else if (plot?.crop && !plot.watered && this.ctx.state.player.activeTool === 'can') consider(1.25, () => ({ icon: '💧', label: 'Arroser', run: () => this.useTool() }));
    }
    // water: refill or fish
    if (!best || bestS > 1.0) {
      const w = this.world.waterInFront(px, pz, this.player.facing, 2.2);
      if (w) {
        const tool = st.player.activeTool;
        if (tool === 'can' && !w.lava && this.ctx.tools.water < this.ctx.tools.capacity()) consider(1.5, () => ({ icon: '🚿', label: 'Remplir', run: () => this.useTool() }));
        else consider(1.6, () => ({ icon: '🎣', label: 'Pêcher', run: () => { this.selectTool('rod'); this.fishing.start(w, this.world.region); } }));
      }
    }
    return best;
  }

  private currentSeed(): string | null {
    const st = this.ctx.state;
    if (st.player.selectedSeed && this.ctx.inventory.has(st.player.selectedSeed)) return st.player.selectedSeed;
    const s = this.ctx.inventory.seeds().find((x) => x.id.startsWith('seed_'));
    if (s) st.player.selectedSeed = s.id;
    return s?.id ?? null;
  }

  private interactableAction(it: Interactable): ActionTarget | null {
    const st = this.ctx.state;
    const runFace = (fn: () => void) => () => { this.player.faceTo(it.x, it.z); fn(); };
    switch (it.kind) {
      case 'npc': return { icon: '💬', label: `Parler à ${it.label}`, run: runFace(() => this.talkTo(it.data.npc)) };
      case 'animal': {
        const a = this.ctx.animals.byUid(it.data.uid);
        if (!a) return null;
        if (a.product) return { icon: item(a.product).icon, label: 'Récolter', run: runFace(() => this.player.act('pet', null, () => this.ctx.animals.collect(a.uid), 0.5)) };
        if (!a.petToday) return { icon: '🤚', label: `Câliner ${a.name}`, run: runFace(() => this.player.act('pet', null, () => { this.ctx.animals.pet(a.uid); audio.play('animal', { species: a.species }); }, 0.9)) };
        return { icon: ANIMAL_BY_ID[a.species].icon, label: a.name, run: () => this.ui.openPanel('animal', a.uid) };
      }
      case 'creature': {
        const ag = it.data.agent as WildAgent;
        return { icon: '🔍', label: 'Observer', run: runFace(() => this.observe(ag)) };
      }
      case 'insect': {
        const ag = it.data.agent as WildAgent;
        return { icon: '🫙', label: 'Attraper', run: runFace(() => this.catchBug(ag)) };
      }
      case 'wildanimal': {
        const ag = it.data.agent as WildAgent;
        return { icon: ANIMAL_BY_ID[ag.id].icon, label: 'Amadouer', run: runFace(() => this.befriend(ag)) };
      }
      case 'village': {
        const id = it.data.id as string;
        const restored = st.village[id].restored;
        return { icon: restored ? VILLAGE_BY_ID[id].icon : '🔨', label: restored ? VILLAGE_BY_ID[id].name : 'Restaurer', run: () => this.villageAction(id) };
      }
      case 'board': return { icon: '📋', label: 'Demandes', run: () => this.ui.openPanel('quests') };
      case 'map': return { icon: '🗺️', label: 'Carte', run: () => this.ui.openPanel('map') };
      case 'mine': return { icon: '⛏️', label: 'Entrer', run: () => (st.mine.deepest >= 5 ? this.ui.openPanel('elevator') : this.goMine(1)) };
      case 'ladder_up': return { icon: '🪜', label: 'Sortir', run: () => this.ui.fade(() => this.loadRegion('mountains', 'mine_door')) };
      case 'elevator': return { icon: '🛗', label: 'Ascenseur', run: () => this.ui.openPanel('elevator') };
      case 'bridge': return { icon: '🌉', label: 'Pont cassé', run: () => this.brokenBridge() };
      case 'secret': return { icon: it.icon, label: it.label, run: () => this.secret(it.data.secret, it.label) };
      case 'camp': return { icon: '⛺', label: 'Se reposer', run: () => { this.player.celebrate(); st.player.buffs.luck = Math.max(st.player.buffs.luck ?? 0, st.absMinute) + 60; this.ui.toast('Un moment au coin du feu… +Chance', '🔥', 'good'); } };
      case 'shrine': return { icon: '💜', label: 'Prier', run: () => this.shrine() };
      case 'fountain': return { icon: '⛲', label: 'Faire un vœu', run: () => this.fountain() };
      case 'festival': return { icon: it.icon, label: it.label, run: () => this.playFestival() };
    }
    return null;
  }

  private nodeAction(id: string): ActionTarget | null {
    const nv = this.world.node(id);
    if (!nv) return null;
    const k = NODE_KINDS[nv.node.kind];
    const label = { axe: 'Couper', pickaxe: 'Miner', sickle: 'Faucher', hand: nv.node.kind === 'chest' ? 'Ouvrir' : 'Ramasser' }[k.tool];
    const icon = k.tool === 'hand' ? (nv.node.kind === 'chest' ? '🧰' : nv.node.kind === 'forage' ? item(this.ctx.gathering.forageItem(nv.node)).icon : '✋') : TOOL_BY_ID[k.tool as ToolId].icon;
    return { icon, label, run: () => this.hitNode(id) };
  }

  /** Hit/collect a world node with the right tool automatically. */
  private hitNode(id: string): void {
    const nv = this.world.node(id);
    if (!nv || this.player.busy) return;
    const k = NODE_KINDS[nv.node.kind];
    this.player.faceTo(nv.node.x, nv.node.z);
    const tool = k.tool === 'hand' ? null : k.tool;
    if (tool) this.ctx.state.player.activeTool = tool as ToolId;
    const impact = () => {
      const r = this.ctx.gathering.hit(nv.node, k.tool);
      if (!r.ok) {
        if (r.reason) this.ui.toast(r.reason, '🔧', 'warn');
        audio.play('error');
        return;
      }
      this.world.shakeNode(id);
      const y = this.world.heightAt(nv.node.x, nv.node.z);
      if (k.tool === 'axe') { audio.play('chop'); this.particles.dust(nv.node.x, y + 0.6, nv.node.z, 0xd8b07a, 4); }
      else if (k.tool === 'pickaxe') { audio.play('pick'); this.particles.sparkle(nv.node.x, y + 0.4, nv.node.z, 0xffffff, 4); }
      else if (k.tool === 'sickle') audio.play('cut');
      else audio.play('pop');
      if (s.settings.haptics) audio.vibrate(15);
      if (r.done && nv.node.kind === 'chest') this.openChest(nv.node.id, nv.node.region);
    };
    const s = this;
    if (tool) this.player.act('tool', tool, impact, 0.45, 0.55);
    else this.player.act('pet', null, impact, 0.45);
  }

  private openChest(id: string, region: RegionId): void {
    const st = this.ctx.state;
    let loot: { id: string; qty: number }[];
    if (region === 'mine' && this.mineFloor) loot = this.ctx.mining.chestLoot(this.mineFloor.floor, !!this.mineFloor.chest?.key);
    else {
      const pools: Record<string, string[]> = { woods: ['chanterelle', 'glowcap', 'hardwood', 'treasure_map'], mountains: ['amethyst', 'aquamarine', 'iron_bar'], coast: ['pearl', 'coral', 'magic_bait'], frosty: ['frost_crystal', 'moonstone', 'cloth'], ember: ['emberite', 'ember_core', 'gold_bar'] };
      const pool = pools[region] ?? ['geode', 'copper_bar'];
      loot = [{ id: rng.pick(pool), qty: rng.int(1, 3) }, { id: rng.pick(pool), qty: 1 }];
      st.regions[region].chests.push(id);
      this.ctx.economy.addGems(5);
    }
    for (const l of loot) this.ctx.inventory.add(l.id, l.qty, true);
    audio.play('discover');
    this.ui.reveal(() => h('div', null, h('span.em', null, '🧰'), h('h2', null, 'Coffre au trésor !'), h('p', null, loot.map((l) => `${item(l.id).icon} ${item(l.id).name} ×${l.qty}`).join(' · '))));
  }

  private buildingAction(uid: string, kind: string): ActionTarget | null {
    const st = this.ctx.state;
    switch (kind) {
      case 'house': return { icon: '🏡', label: 'Entrer', run: () => this.travel('house', 'door') };
      case 'workshop': return { icon: '🔨', label: 'Établi', run: () => this.ui.openPanel('craft', 'workbench') };
      case 'kitchen': return { icon: '🍳', label: 'Cuisiner', run: () => this.ui.openPanel('craft', 'kitchen') };
      case 'forge': return { icon: '🔥', label: 'Fourneau', run: () => this.ui.openPanel('craft', 'forge') };
      case 'mill': return { icon: '🌀', label: 'Moulin', run: () => this.ui.openPanel('craft', 'mill') };
      case 'dairy': return { icon: '🧀', label: 'Laiterie', run: () => this.ui.openPanel('craft', 'dairy') };
      case 'shed': return { icon: '📦', label: 'Remise', run: () => this.ui.openPanel('inventory', 'storage') };
      case 'silo': return { icon: '🌾', label: `Silo (${st.farm.silo})`, run: () => { const n = this.ctx.animals.storeHay(999); this.ui.toast(n ? `${n} foin rangé(s) · ${st.farm.silo}/${this.ctx.animals.siloCapacity()}` : `Silo : ${st.farm.silo}/${this.ctx.animals.siloCapacity()} foin. Coupez de l'herbe à la faucille !`, '🌾'); } };
      case 'beehive': return { icon: '🍯', label: `Miel (${st.flags.honey ?? 0})`, run: () => { const n = st.flags.honey ?? 0; if (n > 0) { this.ctx.inventory.add('honey', n, true); this.ctx.progress('collect_product', 'honey', n); st.flags.honey = 0; this.ui.float(this.player.pos.clone().setY(2), `+${n}`, '🍯'); audio.play('harvest'); } else this.ui.toast('Les abeilles travaillent… revenez dans un jour ou deux.', '🐝'); } };
      case 'pond': return { icon: '🎣', label: 'Pêcher', run: () => { const p = st.farm.placed.find((q) => q.uid === uid)!; this.selectTool('rod'); this.fishing.start({ x: p.x + 1.5, z: p.z + 1.5 }, 'farm'); } };
      case 'coop': case 'barn': case 'stable': case 'sanctuary': {
        const n = st.animals.filter((a) => a.homeUid === uid).length;
        const cap = BUILDING_BY_ID[kind].capacity ?? 0;
        return { icon: BUILDING_BY_ID[kind].icon, label: `${n}/${cap} animaux`, run: () => this.ui.toast(n ? `${n} animaux vivent ici. Hazel vend d'autres animaux au village.` : 'Vide pour l\'instant : adoptez des animaux auprès de Hazel !', BUILDING_BY_ID[kind].icon) };
      }
    }
    return null;
  }

  private villageAction(id: string): void {
    const st = this.ctx.state;
    if (!st.village[id].restored) {
      this.ui.openPanel('restore', id);
      return;
    }
    const map: Record<string, () => void> = {
      shop: () => this.ui.openPanel('shop', 'general'),
      workshop: () => this.ui.openPanel('upgrades'),
      bakery: () => this.ui.openPanel('shop', 'bakery'),
      fishing_shop: () => this.ui.openPanel('shop', 'fishing'),
      florist: () => this.ui.openPanel('shop', 'florist'),
      stable: () => this.ui.openPanel('shop', 'animals'),
      market: () => this.ui.openPanel('sell', 'market'),
      houses: () => this.ui.toast('De nouveaux voisins ont emménagé. Plus de demandes au tableau !', '🏡'),
      fountain: () => this.fountain(),
      park: () => this.ui.toast('Le parc attire des créatures rares au crépuscule.', '🌳'),
    };
    map[id]?.();
  }

  private talkTo(npcId: string): void {
    const npc = NPC_BY_ID[npcId];
    const st = this.ctx.state;
    const text = this.ctx.npcs.talk(npcId);
    const agent = this.entities.npc(npcId);
    if (agent) agent.talking = 2.5;
    audio.play('pop');
    const opts: { label: string; cls?: string; fn: () => void }[] = [];
    if (this.ctx.npcs.canGift(npcId)) opts.push({ label: '🎁 Offrir', cls: 'peach', fn: () => this.ui.openPanel('gift', npcId) });
    const shopOk = npc.shop && (npc.shop === 'general' || npc.shop === 'animals' || (npc.village && st.village[npc.village]?.restored));
    if (shopOk) opts.push({ label: '🛍️ Boutique', cls: 'sky', fn: () => this.ui.openPanel('shop', npc.shop!) });
    if (npcId === 'toma' && st.village.workshop.restored) opts.push({ label: '🔨 Améliorer', cls: 'lav', fn: () => this.ui.openPanel('upgrades') });
    if (npcId === 'niko' && st.village.fishing_shop.restored) opts.push({ label: '🐟 Vendre', fn: () => this.ui.openPanel('sell', 'fishing') });
    if (npcId === 'brie' && st.village.bakery.restored) opts.push({ label: '🍰 Vendre', fn: () => this.ui.openPanel('sell', 'bakery') });
    if (npcId === 'mallow') opts.push({ label: '💰 Vendre', fn: () => this.ui.openPanel('sell', 'shop') });
    if (this.ctx.quests.active.some((q) => q.giver === npcId && (q.done && !q.claimed || this.ctx.quests.canDeliver(q)))) opts.push({ label: '📜 Quêtes', cls: 'rose', fn: () => this.ui.openPanel('quests') });
    const fest = this.ctx.festivals.active();
    if (fest && fest.minigame !== 'none' && this.world.region === 'village') opts.push({ label: `${fest.icon} Participer`, cls: 'rose', fn: () => { this.ui.closeDialogue(); this.playFestival(); } });
    opts.push({ label: 'À bientôt 👋', cls: 'ghost', fn: () => this.ui.closeDialogue() });
    this.ui.dialogue(npcId, text, opts);
  }

  private observe(ag: WildAgent): void {
    if (ag.mode === 'flee' || ag.mode === 'gone' || ag.discovered) return;
    this.player.act('pet', null, () => {
      const c = CREATURE_BY_ID[ag.id];
      const shy = c.shy * (this.ctx.hasBuff('luck') ? 0.6 : 1);
      if (Math.random() < shy * 0.35) {
        ag.flee(this.player.pos);
        this.ui.toast(`${c.name} a pris peur… approchez plus doucement`, '💨');
        return;
      }
      ag.discovered = true;
      this.ctx.creatures.discover(ag.id);
      this.particles.hearts(ag.pos.x, ag.pos.y + 0.8, ag.pos.z, 3, 0xfff0a0);
      setTimeout(() => { ag.mode = 'gone'; this.particles.sparkle(ag.pos.x, ag.pos.y + 0.4, ag.pos.z); }, 1800);
    }, 1.1, 0.8);
  }

  private catchBug(ag: WildAgent): void {
    const def = INSECT_BY_ID[ag.id];
    this.player.act('tool', 'net', () => {
      const chance = { common: 0.9, uncommon: 0.8, rare: 0.65, epic: 0.5, mythic: 0.4 }[def.rarity];
      if (Math.random() < chance) {
        ag.mode = 'gone';
        this.ctx.creatures.catchInsect(ag.id);
        this.particles.sparkle(ag.pos.x, ag.pos.y, ag.pos.z, 0xfff0a0, 6);
      } else {
        this.ui.toast(`${def.name} s'est envolé(e) !`, def.icon);
        audio.play('fail');
      }
    }, 0.5, 0.5);
  }

  private befriend(ag: WildAgent): void {
    const def = ANIMAL_BY_ID[ag.id];
    this.player.act('pet', null, () => {
      const r = this.ctx.animals.befriendWild(ag.id);
      if (r.fedToday) { this.ui.toast(`${def.name} a déjà mangé aujourd'hui. Revenez demain !`, def.icon); return; }
      if (r.level === 0) { this.ui.toast('Il vous faut une friandise, des baies, une pomme ou une carotte…', '🍪', 'warn'); return; }
      this.particles.hearts(ag.pos.x, ag.pos.y + 1, ag.pos.z, 4);
      if (r.adoptable) {
        const a = this.ctx.animals.adopt(ag.id, true);
        if (a) {
          ag.mode = 'gone';
          this.ui.reveal(() => h('div', null, h('span.em', null, def.icon), h('h2', null, `${def.name} vous fait confiance !`), h('p', null, 'Il/elle s\'installe dans votre refuge sauvage à la ferme.')));
        } else this.ui.toast(`${def.name} vous fait confiance ! Construisez un refuge sauvage pour l'accueillir.`, '🦊', 'good');
      } else this.ui.toast(`${def.name} se rapproche… confiance ${r.level}/3`, '💚', 'good');
    }, 0.9);
  }

  private brokenBridge(): void {
    const q = this.ctx.quests.active.find((a) => a.id === 's9');
    if (q && this.ctx.quests.canDeliver(q)) {
      this.ctx.quests.deliver('s9');
      this.ctx.quests.claim('s9');
      audio.play('build');
      this.ui.fade(() => this.loadRegion('farm', 'woods_entry', true));
    } else this.ui.toast(q ? 'Il faut 30 planches pour réparer le pont (fabriquez-les à l\'atelier).' : 'Ce vieux pont est cassé… Moss saura peut-être quoi faire.', '🌉');
  }

  private secret(id: string, label: string): void {
    const st = this.ctx.state;
    const rs = st.regions[this.world.region];
    if (rs.secrets.includes(id)) {
      this.ui.toast(`${label} : un endroit paisible.`, '✨');
      return;
    }
    rs.secrets.push(id);
    const rewards: Record<string, [string, number]> = { grove: ['moonbloom', 0], igloo: ['warm_coat', 0], lighthouse: ['pearl', 2], spring: ['ember_core', 1], waterfall: ['aquamarine', 2] };
    const [it, q] = rewards[id] ?? ['geode', 1];
    if (it === 'moonbloom') this.ctx.inventory.add('seed_moonbloom', 2, true);
    else if (it === 'warm_coat') this.ctx.inventory.add('frost_crystal', 3, true);
    else this.ctx.inventory.add(it, q, true);
    this.ctx.economy.addGems(10);
    audio.play('discover');
    this.ui.confetti();
    this.ui.reveal(() => h('div', null, h('span.em', null, '✨'), h('h2', null, 'Secret découvert !'), h('p', null, `${label} — vous trouvez un petit trésor et 10 💎.`)));
  }

  private shrine(): void {
    const st = this.ctx.state;
    const key = `shrine_${this.mineFloor?.floor}_${st.time.day}`;
    if (st.flags[key]) { this.ui.toast('L\'autel brille doucement.', '💜'); return; }
    st.flags[key] = true;
    this.ctx.inventory.add('crystal_shard', 2, true);
    st.player.buffs.luck = Math.max(st.player.buffs.luck ?? 0, st.absMinute) + 180;
    audio.play('sparkle');
    this.particles.sparkle(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z, 0xd8a8ff, 16);
    this.ui.toast('Bénédiction de cristal : +Chance', '💜', 'good');
  }

  private fountain(): void {
    const st = this.ctx.state;
    if (st.flags.fountainWish === st.time.day) { this.ui.toast('Un vœu par jour suffit 😊', '⛲'); return; }
    if (!this.ctx.economy.spend(10)) return;
    st.flags.fountainWish = st.time.day;
    this.ctx.economy.addGems(1);
    this.particles.splash(this.player.pos.x + Math.sin(this.player.facing), 0.4, this.player.pos.z + Math.cos(this.player.facing));
    this.ui.toast('Vous lancez une pièce… +1 Moon Gem', '⛲', 'good');
  }

  // ------------------------------------------------------------ festival
  private updateFestival(dt: number): void {
    const fest = this.ctx.festivals.active();
    const want = !!fest && fest.minigame !== 'none' && this.world.region === 'village';
    if (want && !this.festivalSprite) {
      const p = this.world.layout.anchors.plaza;
      this.festivalSprite = emojiSprite(fest!.icon, 1.1);
      this.festivalSprite.position.set(p.x, 3.4, p.z - 4);
      this.world.root.add(this.festivalSprite);
      this.world.interactables.push({ id: 'festival', kind: 'festival', x: p.x, z: p.z - 1, radius: 2.4, label: `Participer : ${MINI_INFO[fest!.minigame as MiniId]?.name ?? 'Concours'}`, icon: fest!.icon });
    } else if (!want && this.festivalSprite) {
      this.festivalSprite.removeFromParent();
      this.festivalSprite = null;
      this.world.interactables = this.world.interactables.filter((i) => i.kind !== 'festival');
    }
    if (this.festivalSprite) this.festivalSprite.position.y = 3.4 + Math.sin(this.elapsed * 2) * 0.15;
    if (fest && this.world.region === 'village' && Math.random() < dt * 3) {
      const p = this.world.layout.anchors.plaza;
      const c = [0xff8fab, 0xffd166, 0x7fd1a8, 0x8fd3ff][Math.floor(Math.random() * 4)];
      this.particles.emit({ x: p.x + (Math.random() - 0.5) * 10, y: 4, z: p.z - 4 + (Math.random() - 0.5) * 8, vy: -0.6, life: 4, size: 0.12, color: c, frame: PF.PETAL, wobble: 1.5, spin: 3 });
    }
    // fishing contest timer
    if (this.fishing.contest) {
      this.contestTimer -= dt;
      if (this.contestTimer <= 0) {
        const c = this.fishing.contest;
        this.fishing.contest = null;
        const score = Math.min(100, c.count * 15 + c.best * 0.3);
        this.festivalReward('fishing_contest', score, `${c.count} poisson(s), record ${c.best} cm`);
      }
    }
  }

  private playFestival(): void {
    const fest = this.ctx.festivals.active();
    if (!fest || fest.minigame === 'none') return;
    if (fest.minigame === 'fishing_contest') {
      this.fishing.contest = { until: 0, best: 0, count: 0 };
      this.contestTimer = 90;
      this.ui.toast('Concours lancé ! 90 secondes pour pêcher au ponton 🎣', '⏱️', 'good');
      return;
    }
    this.startMinigame(fest.minigame);
  }

  startMinigame(id: string): void {
    const fest = this.ctx.festivals.active();
    runMinigame(this.ui, audio, id as MiniId, (score) => this.festivalReward(fest?.id ?? id, score, `Score : ${score}/100`));
  }

  private festivalReward(festId: string, score: number, detail: string): void {
    const r = this.ctx.festivals.reward(festId, score);
    this.ui.confetti();
    this.ui.reveal(() => h('div', null, h('span.em', null, '🏅'), h('h2', null, r.best ? 'Nouveau record !' : 'Bravo !'), h('p', null, detail), h('p', null, `+${r.tokens} 🎟️ · +${fmt(r.coins)} 🪙`), h('p.muted', null, 'Échangez vos jetons au stand du festival (Menu → Fêtes).')));
  }

  // ------------------------------------------------------------ actions
  primaryAction(): void {
    if (this.title || this.ui.modalOpen) return;
    audio.unlock();
    if (this.fishing.active) {
      this.fishing.action();
      return;
    }
    if (this.player.busy) return;
    const t = this.current ?? this.findTarget();
    if (t) t.run();
    else this.useTool();
    this.actionT = 0;
  }

  private plantAt(tx: number, tz: number, seed: string): void {
    this.player.faceTo(tx + 0.5, tz + 0.5);
    this.player.act('pet', null, () => {
      const r = this.ctx.farming.plant(tx, tz, seed);
      if (r.ok) { audio.play('plant'); this.particles.dust(tx + 0.5, 0.1, tz + 0.5, 0x8a6a4a, 4); }
      else { this.ui.toast(r.reason!, '🌱', 'warn'); audio.play('error'); }
    }, 0.35);
  }

  private harvestAt(tx: number, tz: number): void {
    this.player.faceTo(tx + 0.5, tz + 0.5);
    this.player.act('pet', null, () => {
      const r = this.ctx.farming.harvest(tx, tz);
      if (r) { this.particles.sparkle(tx + 0.5, 0.5, tz + 0.5, 0xfff0a0, 6); this.particles.leaves(tx + 0.5, 0.3, tz + 0.5, 0x8ad07a, 4); }
    }, 0.35);
  }

  /** Use the equipped tool on the area in front of the player. */
  useTool(): void {
    if (this.title || this.player.busy || this.ui.modalOpen) return;
    audio.unlock();
    const st = this.ctx.state;
    const tool = st.player.activeTool;
    const px = this.player.pos.x, pz = this.player.pos.z;
    // quantize facing to a grid direction
    const fx = Math.sin(this.player.facing), fz = Math.cos(this.player.facing);
    const dir = Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz)];
    const right = [-dir[1], dir[0]];
    const front = this.frontPoint(0.75);
    const baseX = Math.floor(front.x), baseZ = Math.floor(front.z);
    const area = toolArea(st.player.tools[tool]).map(([f, r]) => [baseX + dir[0] * f + right[0] * r, baseZ + dir[1] * f + right[1] * r]);
    if (tool === 'rod') {
      const w = this.world.waterInFront(px, pz, this.player.facing, 2.4);
      if (w) this.fishing.start(w, this.world.region);
      else { this.ui.toast('Placez-vous face à l\'eau pour pêcher.', '🎣'); audio.play('error'); }
      return;
    }
    if (tool === 'axe' || tool === 'pickaxe') {
      const nodes = this.world.nodesNear(front.x, front.z, 1.3).filter((n) => n.growth >= 1 && NODE_KINDS[n.node.kind].tool === tool);
      if (nodes.length) { this.hitNode(nodes[0].node.id); return; }
      if (tool === 'pickaxe' && this.ctx.farming.plot(baseX, baseZ) && !this.ctx.farming.plot(baseX, baseZ)!.crop) {
        this.player.act('tool', 'pickaxe', () => { this.ctx.farming.untill(baseX, baseZ); audio.play('hoe'); }, 0.45);
        return;
      }
      this.player.act('tool', tool, () => audio.play('cut'), 0.45);
      return;
    }
    if (tool === 'can') {
      const w = this.world.waterInFront(px, pz, this.player.facing, 2.0);
      if (w && !w.lava) {
        this.player.act('tool', 'can', () => { this.ctx.tools.refill(); audio.play('refill'); this.particles.splash(w.x, -0.2, w.z, 8); this.ui.toast('Arrosoir rempli', '💧'); }, 0.5);
        return;
      }
      this.player.act('tool', 'can', () => {
        let n = 0;
        for (const [x, z] of area) {
          const p = this.ctx.farming.plot(x, z);
          if (!p || p.watered) continue;
          if (!this.ctx.tools.useWater()) { this.ui.toast('Arrosoir vide ! Remplissez-le à l\'eau.', '💧', 'warn'); break; }
          this.ctx.farming.water(x, z);
          this.particles.burst(5, () => ({ x: x + 0.5 + (Math.random() - 0.5) * 0.6, y: 0.9, z: z + 0.5 + (Math.random() - 0.5) * 0.6, vy: -2, life: 0.4, size: 0.1, color: 0x8fd3ff, frame: PF.DROP, gravity: 6, rot: 0 }));
          n++;
        }
        if (n) audio.play('water');
        else this.particles.burst(5, () => ({ x: front.x, y: 0.9, z: front.z, vy: -2, vx: (Math.random() - 0.5), life: 0.4, size: 0.1, color: 0x8fd3ff, frame: PF.DROP, gravity: 6 }));
      }, 0.55, 0.5);
      return;
    }
    if (tool === 'hoe') {
      this.player.act('tool', 'hoe', () => {
        let n = 0;
        for (const [x, z] of area) if (this.ctx.farming.till(x, z)) {
          n++;
          this.particles.dust(x + 0.5, 0.05, z + 0.5, 0x9a7a5a, 5);
        }
        if (n) { audio.play('hoe'); this.rig.shake(0.04, 0.1); }
        else {
          audio.play('error');
          if (this.world.region !== 'farm') this.ui.toast('On ne peut labourer que sur sa ferme.', '⛏', 'warn');
          else if (this.ctx.farming.plot(baseX, baseZ)) this.ui.toast('Déjà labouré. Plantez une graine avec le bouton d\'action !', '🌱');
        }
      }, 0.5);
      return;
    }
    if (tool === 'sickle') {
      this.player.act('tool', 'sickle', () => {
        let did = false;
        for (const [x, z] of area) {
          const p = this.ctx.farming.plot(x, z);
          if (p?.crop?.ready) { this.ctx.farming.harvest(x, z, st.player.tools.sickle >= 4); did = true; }
        }
        for (const nv of this.world.nodesNear(front.x, front.z, 1.6)) {
          if (nv.growth >= 1 && NODE_KINDS[nv.node.kind].tool === 'sickle') { this.ctx.gathering.hit(nv.node, 'sickle'); did = true; }
        }
        if (!did && this.world.tile(front.x, front.z) === T.GRASS && !this.world.layout.indoor && seasonOfDay(st.time.day) !== 'winter') {
          // cutting plain grass makes hay & fiber — gentle and unlimited
          if (Math.random() < 0.45) this.ctx.inventory.add(Math.random() < 0.55 ? 'hay' : 'fiber', 1);
          this.particles.leaves(front.x, 0.2, front.z, 0x8ad07a, 5);
        }
        audio.play('cut');
      }, 0.45);
    }
  }

  private onTap(nx: number, ny: number): void {
    if (this.title) return;
    audio.unlock();
    if (this.placement.editMode) { this.placement.pick(nx, ny); return; }
    if (this.placement.active) return;
    if (this.ui.modalOpen || this.fishing.active) return;
    // raycast terrain for an accurate ground point
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.renderer.camera);
    const hit = ray.intersectObject(this.world.terrain.ground, false)[0];
    const p = hit?.point ?? this.rig.screenToGround(nx, ny, 0);
    if (!p) return;
    // tapped an interactable? walk to it and interact
    const all = [...this.entities.interactables(), ...this.world.interactables];
    let target: Interactable | null = null;
    let bd = 1.3;
    for (const it of all) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < bd) { bd = d; target = it; }
    }
    let nodeId: string | null = null;
    if (!target) for (const nv of this.world.nodesNear(p.x, p.z, 1.0)) if (nv.growth >= 1) { nodeId = nv.node.id; break; }
    const tm = this.tapMarker.material as THREE.MeshBasicMaterial;
    this.tapMarker.position.set(p.x, this.world.heightAt(p.x, p.z) + 0.05, p.z);
    tm.opacity = 0.8;
    if (this.settings.controls === 'joystick') return;
    const dest = target ?? (nodeId ? this.world.node(nodeId)!.node : null);
    if (dest) {
      const dx = dest.x - this.player.pos.x, dz = dest.z - this.player.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const stop = target ? Math.max(0.8, target.radius * 0.6) : 1.0;
      const go = () => {
        this.player.faceTo(dest.x, dest.z);
        if (target) { const a = this.interactableAction(target); a?.run(); }
        else if (nodeId) this.hitNode(nodeId);
      };
      if (d <= stop + 0.3) go();
      else this.player.walkTo(dest.x - (dx / d) * stop, dest.z - (dz / d) * stop, go);
      return;
    }
    if (WALKABLE[this.world.tile(p.x, p.z)]) this.player.walkTo(p.x, p.z);
  }

  private onKey(k: string): void {
    if (this.title) return;
    if (k === 'e' || k === ' ' || k === 'enter') this.primaryAction();
    else if (k === 'f') this.useTool();
    else if (k === 'r' || k === 'tab') {
      const tools: ToolId[] = ['hoe', 'can', 'sickle', 'axe', 'pickaxe', 'rod'];
      this.selectTool(tools[(tools.indexOf(this.ctx.state.player.activeTool) + 1) % tools.length]);
    } else if (k === 'i') this.ui.openPanel('inventory');
    else if (k === 'm') this.ui.openPanel('map');
    else if (k === 'j') this.ui.openPanel('quests');
    else if (k === 'b') this.ui.openPanel('build');
    else if (k === 'escape') {
      if (this.placement.active) this.placement.cancel();
      else if (this.ui.overlay) this.ui.closePanel();
      else if (this.ui.dialogueEl) this.ui.closeDialogue();
      else this.ui.openPanel('settings');
    } else if (k >= '1' && k <= '6') this.selectTool((['hoe', 'can', 'sickle', 'axe', 'pickaxe', 'rod'] as ToolId[])[+k - 1]);
  }

  private checkPortals(dt: number): void {
    this.portalCooldown -= dt;
    if (this.portalCooldown > 0) return;
    const px = this.player.pos.x, pz = this.player.pos.z;
    for (const p of this.world.layout.portals) {
      if (px >= p.x0 && px < p.x1 && pz >= p.z0 && pz < p.z1) {
        this.portalCooldown = 1.5;
        if (!this.ctx.state.regions[p.to].unlocked) {
          this.ui.toast(`${p.label} : ${REGION_BY_ID[p.to].unlockHint}`, '🔒', 'warn');
          // step back
          const c = { x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 };
          const dx = px - c.x, dz = pz - c.z;
          const L = this.world.layout;
          const inward = { x: c.x < 3 ? 1 : c.x > L.w - 3 ? -1 : 0, z: c.z < 3 ? 1 : c.z > L.d - 3 ? -1 : 0 };
          this.player.teleport(px + inward.x * 1.5 + dx * 0, pz + inward.z * 1.5 + dz * 0);
          return;
        }
        this.travel(p.to, p.anchor);
        return;
      }
    }
  }

  // ------------------------------------------------------------ misc API
  eat(id: string): void {
    this.player.act('eat', null, () => {
      if (this.ctx.crafting.eat(id)) { audio.play('eat'); this.particles.hearts(this.player.pos.x, this.player.pos.y + 1.6, this.player.pos.z, 2, 0xffd166); }
    }, 0.9);
  }

  selectTool(t: ToolId): void {
    this.ctx.state.player.activeTool = t;
    audio.play('click');
    this.ui.refreshHud();
    this.actionT = 0;
  }

  selectSeed(id: string | null): void {
    this.ctx.state.player.selectedSeed = id;
    this.ui.refreshHud();
  }

  toggleRide(): void {
    const st = this.ctx.state;
    if (!st.animals.some((a) => a.species === 'horse') || this.world.layout.indoor) return;
    st.player.riding = !st.player.riding;
    this.player.updateRiding();
    audio.play('animal', { species: 'horse' });
  }

  enterPlacement(kind: string, uid?: string): void {
    if (this.world.region !== 'farm' && this.world.region !== 'house') {
      this.ui.toast('Retournez à la ferme pour construire.', '🏡');
      return;
    }
    if (BUILDING_BY_ID[kind]) {
      const a = this.ctx.building.affordable(kind);
      if (!a.ok) { this.ui.toast(a.reason!, '🔨', 'warn'); return; }
    }
    const f = this.frontPoint(2.5);
    this.input.dragMode = true;
    this.placement.start(kind, f, uid);
  }

  enterEditMode(): void {
    if (this.world.region !== 'farm' && this.world.region !== 'house') return;
    this.input.dragMode = true;
    this.placement.beginEdit();
  }

  refreshWorld(kind: 'placed' | 'house' | 'plots' | 'all'): void {
    if (kind === 'all') {
      this.loadRegion(this.world.region, null, true, { x: this.player.pos.x, z: this.player.pos.z });
      return;
    }
    if (kind === 'house') {
      if (this.world.house) { this.world.house.buildShell(); this.world.house.refreshFurniture(); }
      return;
    }
    if (kind === 'placed') {
      this.world.farm?.refreshPlaced();
      this.world.farm?.refreshTrees();
      this.world.house?.refreshFurniture();
      this.world.rebuildGrass();
      this.entities.syncAnimals();
    }
    if (kind === 'plots') this.world.farm?.refreshPlots();
  }

  refreshLook(): void {
    this.player.rebuild();
  }

  previewLook(look: Appearance | null): void {
    if (!look) {
      this.player.rebuild();
      this.previewRig = null;
      return;
    }
    // rebuild the avatar live with the edited look
    const saved = this.ctx.state.player.look;
    this.ctx.state.player.look = look;
    this.player.rebuild();
    this.ctx.state.player.look = saved;
    this.player.root.visible = true;
  }

  async save(): Promise<boolean> {
    if (this.title || !this.ctx) return false;
    return this.saves.save(this.ctx.state);
  }

  exportSave(): string {
    return this.saves.exportString(this.ctx.state);
  }

  async importSave(code: string): Promise<boolean> {
    const st = this.saves.importString(code);
    if (!st) return false;
    await this.saves.save(st);
    this.start(st, false);
    return true;
  }
}

export { SECONDS_PER_GAME_MINUTE };
