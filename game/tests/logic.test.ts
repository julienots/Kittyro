import { describe, it, expect } from 'vitest';
import { createNewGame } from '../src/state/newGame';
import { Ctx } from '../src/systems/Context';
import { SaveManager, MemoryAdapter, migrate } from '../src/save/SaveManager';
import { CROP_BY_ID } from '../src/data/crops';
import { DAY_START, DAY_END } from '../src/data/constants';
import { ITEMS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { NODE_KINDS } from '../src/data/nodes';
import { STORY } from '../src/data/quests';
import { VILLAGE_BUILDINGS } from '../src/data/village';

const fresh = () => new Ctx(createNewGame('Test', 'Ferme', undefined, 1234));

describe('data integrity', () => {
  it('every recipe ingredient and output exists', () => {
    for (const r of RECIPES) {
      for (const [id] of r.ing) expect(ITEMS[id], `${r.id} ingredient ${id}`).toBeDefined();
    }
  });
  it('every node drop exists', () => {
    for (const k of Object.values(NODE_KINDS)) for (const d of k.drops) expect(ITEMS[d.id], d.id).toBeDefined();
  });
  it('village costs reference real items', () => {
    for (const b of VILLAGE_BUILDINGS) for (const [id] of b.items) expect(ITEMS[id], id).toBeDefined();
  });
});

describe('farming', () => {
  it('till -> plant -> water -> grow -> harvest', () => {
    const c = fresh();
    expect(c.farming.till(25, 25)).toBe(true);
    expect(c.farming.till(25, 25)).toBe(false);
    expect(c.farming.plant(25, 25, 'seed_lettuce').ok).toBe(true);
    expect(c.inventory.count('seed_lettuce')).toBe(7);
    // not watered: no growth
    c.farming.tick(1000);
    expect(c.farming.plot(25, 25)!.crop!.ready).toBe(false);
    c.farming.water(25, 25);
    c.farming.tick(CROP_BY_ID.lettuce.grow);
    expect(c.farming.plot(25, 25)!.crop!.ready).toBe(true);
    const h = c.farming.harvest(25, 25);
    expect(h?.id).toBe('lettuce');
    expect(c.inventory.count('lettuce')).toBeGreaterThan(0);
    expect(c.farming.plot(25, 25)!.crop).toBeNull();
  });

  it('regrowing crops come back', () => {
    const c = fresh();
    c.state.time.day = 13; // summer
    c.inventory.add('seed_tomato', 1);
    c.farming.till(26, 26);
    c.farming.water(26, 26);
    expect(c.farming.plant(26, 26, 'seed_tomato').ok).toBe(true);
    c.farming.tick(CROP_BY_ID.tomato.grow);
    c.farming.harvest(26, 26);
    const p = c.farming.plot(26, 26)!;
    expect(p.crop?.id).toBe('tomato');
    expect(p.crop?.harvests).toBe(1);
  });

  it('out of season seeds are refused outside the greenhouse', () => {
    const c = fresh();
    c.inventory.add('seed_pumpkin', 1);
    c.farming.till(27, 27);
    expect(c.farming.plant(27, 27, 'seed_pumpkin').ok).toBe(false);
  });
});

describe('inventory', () => {
  it('stacks, removes and overflows to storage', () => {
    const c = fresh();
    c.inventory.add('stone', 50);
    expect(c.inventory.count('stone')).toBe(50);
    expect(c.inventory.remove('stone', 20)).toBe(true);
    expect(c.inventory.count('stone')).toBe(30);
    expect(c.inventory.remove('stone', 999)).toBe(false);
    // fill every slot with distinct items
    const ids = Object.keys(ITEMS).slice(0, 40);
    for (const id of ids) c.inventory.add(id, 1);
    expect(c.state.storage.length).toBeGreaterThan(0);
  });
  it('decor goes to the build bag', () => {
    const c = fresh();
    c.inventory.add('bench', 2);
    expect(c.state.decorOwned.bench).toBe(2);
  });
});

describe('time & weather', () => {
  it('passes out at 2:00 and wakes at 6:00 next day', () => {
    const c = fresh();
    c.state.time.minute = DAY_END - 2;
    c.time.update(10);
    expect(c.state.time.day).toBe(2);
    expect(c.state.time.minute).toBe(DAY_START);
  });
  it('rain waters crops in the morning', () => {
    const c = fresh();
    c.farming.till(30, 30);
    c.state.weather.tomorrow = 'rain';
    c.time.sleep();
    expect(c.farming.plot(30, 30)!.watered).toBe(true);
  });
});

describe('quests', () => {
  it('story starts and progresses', () => {
    const c = fresh();
    expect(c.quests.story?.id).toBe('s0');
    c.npcs.talk('moss');
    expect(c.quests.story?.done).toBe(true);
    expect(c.quests.claim('s0')).toBe(true);
    expect(c.quests.story?.id).toBe('sh');
    expect(c.state.flags.houseRuined).toBe(true);
    c.progress('repair', 'house');
    expect(c.quests.story?.done).toBe(true);
    expect(c.quests.claim('sh')).toBe(true);
    expect(c.quests.story?.id).toBe('s1');
    for (let i = 0; i < 6; i++) {
      c.farming.till(10 + i, 30);
      c.farming.plant(10 + i, 30, 'seed_lettuce');
      c.farming.water(10 + i, 30);
    }
    expect(c.quests.story?.done).toBe(true);
  });
  it('dailies refresh each day', () => {
    const c = fresh();
    c.quests.refresh();
    const d1 = c.quests.active.filter((q) => q.id.startsWith('d1_')).length;
    expect(d1).toBe(3);
    c.time.sleep();
    expect(c.quests.active.some((q) => q.id.startsWith('d2_'))).toBe(true);
    expect(c.quests.active.some((q) => q.id.startsWith('d1_'))).toBe(false);
  });
  it('deliver quests consume items', () => {
    const c = fresh();
    c.state.quests.storyStep = STORY.findIndex((q) => q.id === 's9');
    c.state.quests.active = [];
    c.quests.ensureStory();
    expect(c.quests.story?.id).toBe('s9');
    c.inventory.add('plank', 30);
    expect(c.quests.deliver('s9')).toBe(true);
    expect(c.inventory.count('plank')).toBe(0);
    expect(c.quests.claim('s9')).toBe(true);
    expect(c.state.regions.woods.unlocked).toBe(true);
  });
});

describe('village, crafting, animals, shop', () => {
  it('restores a village building', () => {
    const c = fresh();
    c.inventory.add('wood', 30);
    c.inventory.add('stone', 10);
    c.state.player.coins = 1000;
    const r = c.village.contribute('shop');
    expect(r.restored).toBe(true);
    expect(c.village.isRestored('shop')).toBe(true);
  });
  it('crafts with a station', () => {
    const c = fresh();
    c.inventory.add('fiber', 10);
    expect(c.crafting.craft('rope')).toBe(true);
    expect(c.inventory.count('rope')).toBe(2);
    c.inventory.add('wood', 10);
    expect(c.crafting.craft('plank')).toBe(false); // no workbench yet
    c.state.farm.placed.push({ uid: 'w', kind: 'workshop', x: 30, z: 30, rot: 0 });
    expect(c.crafting.craft('plank')).toBe(true);
  });
  it('adopts animals that produce', () => {
    const c = fresh();
    c.state.player.coins = 5000;
    expect(c.animals.adopt('chicken')).toBeNull(); // no coop
    c.state.farm.placed.push({ uid: 'coop1', kind: 'coop', x: 30, z: 20, rot: 0 });
    const a = c.animals.adopt('chicken');
    expect(a).not.toBeNull();
    a!.hunger = 100;
    a!.happiness = 80;
    c.time.sleep();
    expect(a!.product).toBe('egg');
    expect(c.animals.collect(a!.uid)).toBe('egg');
    expect(c.inventory.count('egg')).toBe(1);
  });
  it('places and stores decorations', () => {
    const c = fresh();
    const o = c.building.place('fence_wood', 30, 30, 0, 'farm');
    expect(o).not.toBeNull();
    expect(c.building.canPlace('fence_wood', 30, 30, 0, 'farm').ok).toBe(false);
    expect(c.building.store(o!.uid)).toBe(true);
    expect(c.state.decorOwned.fence_wood).toBe(8);
  });
  it('shop sells seeds', () => {
    const c = fresh();
    const offer = c.shop.offers('general').find((o) => o.id === 'seed_carrot')!;
    const before = c.state.player.coins;
    expect(c.shop.buy(offer, 2)).toBe(true);
    expect(c.state.player.coins).toBe(before - offer.price * 2);
  });
});

describe('gathering & fishing & mining', () => {
  it('chops a tree with enough hits and it regrows', () => {
    const c = fresh();
    const n = { id: 't1', kind: 'tree_oak', region: 'farm' as const, x: 1, z: 1 };
    let res;
    let hits = 0;
    do {
      res = c.gathering.hit(n, 'axe');
      hits++;
    } while (!res.done && hits < 10);
    expect(res.done).toBe(true);
    expect(c.inventory.count('wood')).toBeGreaterThan(10);
    expect(c.gathering.available(n)).toBe(false);
    c.state.absMinute += 1440 * 3;
    expect(c.gathering.available(n)).toBe(true);
  });
  it('refuses wrong tool', () => {
    const c = fresh();
    const r = c.gathering.hit({ id: 'r', kind: 'rock', region: 'farm', x: 0, z: 0 }, 'axe');
    expect(r.ok).toBe(false);
  });
  it('rolls fish for a region', () => {
    const c = fresh();
    const r = c.fishing.roll('farm');
    expect(r).not.toBeNull();
    c.fishing.catch(r!.fish.id, r!.size);
    expect(c.collections.has('fish', r!.fish.id)).toBe(true);
  });
  it('mine floors have a ladder', () => {
    const c = fresh();
    for (let f = 1; f < 30; f++) {
      const fl = c.mining.generate(f);
      if (f % 5 !== 0) expect(fl.rocks.some((r) => r.ladder)).toBe(true);
    }
  });
});

describe('save system', () => {
  it('roundtrips state', async () => {
    const c = fresh();
    c.inventory.add('gold_bar', 3);
    const sm = new SaveManager(new MemoryAdapter());
    expect(await sm.save(c.state)).toBe(true);
    const loaded = await sm.load();
    expect(loaded).not.toBeNull();
    expect(new Ctx(loaded!).inventory.count('gold_bar')).toBe(3);
  });
  it('falls back to backup when corrupted', async () => {
    const c = fresh();
    const ad = new MemoryAdapter();
    const sm = new SaveManager(ad);
    await sm.save(c.state); // saves=0 -> rotation happens before, then main written
    c.state.player.coins = 777;
    for (let i = 0; i < 5; i++) await sm.save(c.state);
    ad.map.set('mm_save_0', ad.map.get('mm_save_0')!.replace('777', '778'));
    const loaded = await sm.load();
    expect(loaded).not.toBeNull();
  });
  it('migrates and repairs old saves', () => {
    const old = { version: 1, player: { name: 'Old', coins: 42 }, inventory: [{ id: 'wood', qty: 5 }] };
    const s = migrate(old);
    expect(s.player.name).toBe('Old');
    expect(s.player.coins).toBe(42);
    expect(s.weather.current).toBeDefined();
    expect(s.inventory.length).toBe(s.inventorySize);
  });
  it('v3 saves keep their story position after the house chapter was added', () => {
    const c = fresh();
    const raw = JSON.parse(JSON.stringify(c.state));
    raw.version = 3;
    raw.quests.storyStep = 3; // was on s3 (village)
    delete raw.flags.houseRuined;
    const s = migrate(raw);
    expect(STORY[s.quests.storyStep].id).toBe('s3');
    expect(s.flags.houseRuined).toBe(false);
    const fresh0 = JSON.parse(JSON.stringify(c.state));
    fresh0.version = 3;
    fresh0.quests.storyStep = 0;
    expect(migrate(fresh0).quests.storyStep).toBe(0);
  });
  it('export/import strings', () => {
    const c = fresh();
    const sm = new SaveManager(new MemoryAdapter());
    const code = sm.exportString(c.state);
    expect(sm.importString(code)?.player.name).toBe('Test');
    expect(sm.importString('garbage')).toBeNull();
  });
});

describe('hamlet (Clairefontaine)', () => {
  const rich = () => {
    const c = fresh();
    c.state.player.coins = 100000;
    for (const [id, q] of [['wood', 900], ['stone', 900], ['fiber', 300], ['thatch', 50], ['rope', 50], ['timber', 80], ['cut_stone', 80], ['glass', 40], ['brick', 60], ['plank', 60], ['iron_bar', 10], ['coal', 40], ['cloth', 10], ['copper_bar', 10], ['gold_bar', 4]] as [string, number][]) c.inventory.add(id, q, true);
    return c;
  };

  it('data references real items and decorations', async () => {
    const { HAMLET_BUILDINGS, HAMLET_GOALS, VILLAGER_TRAITS } = await import('../src/data/hamlet');
    const { DECOR_BY_ID } = await import('../src/data/decor');
    for (const b of HAMLET_BUILDINGS) {
      for (const [id] of b.items) expect(ITEMS[id], `${b.id} cost ${id}`).toBeDefined();
      for (const o of b.output ?? []) expect(ITEMS[o.id], `${b.id} output ${o.id}`).toBeDefined();
    }
    for (const g of HAMLET_GOALS) for (const [id] of g.reward.items ?? []) expect(ITEMS[id] ?? DECOR_BY_ID[id], `goal ${g.id} reward ${id}`).toBeDefined();
    for (const t of Object.values(VILLAGER_TRAITS)) for (const id of t.wishes) expect(ITEMS[id], `wish ${id}`).toBeDefined();
    for (const r of RECIPES) expect(ITEMS[r.out] ?? DECOR_BY_ID[r.out], `recipe out ${r.out}`).toBeDefined();
  });

  it('first home brings a villager immediately, workplaces produce every morning', () => {
    const c = rich();
    expect(c.state.regions.hamlet.unlocked).toBe(true);
    expect(c.building.place('h_hut', 10, 10, 0, 'hamlet')).not.toBeNull();
    expect(c.hamlet.population()).toBe(1);
    expect(c.state.hamlet.villagers[0].homeUid).toBe(c.state.hamlet.placed[0].uid);
    // hamlet buildings can't go on the farm, farm buildings can't go in the hamlet
    expect(c.building.canPlace('h_hut', 20, 20, 0, 'farm').ok).toBe(false);
    expect(c.building.canPlace('coop', 20, 20, 0, 'hamlet').ok).toBe(false);
    expect(c.building.canPlace('h_hut', 0, 0, 0, 'hamlet').ok).toBe(false); // outside the clearing
    expect(c.building.canPlace('h_hut', 10, 10, 0, 'hamlet').ok).toBe(false); // occupied
    const work = c.building.place('h_lumber', 14, 10, 0, 'hamlet')!;
    expect(c.hamlet.workers(work.uid).length).toBe(1);
    c.time.sleep();
    expect(c.state.hamlet.chest.find((s) => s.id === 'wood')!.qty).toBeGreaterThan(0);
    const before = c.inventory.count('wood');
    const got = c.hamlet.collect();
    expect(got.items.length).toBeGreaterThan(0);
    expect(c.inventory.count('wood')).toBeGreaterThan(before);
    expect(c.state.hamlet.chest.length).toBe(0);
    expect(c.state.hamlet.goals).toEqual(expect.arrayContaining(['g_home', 'g_villager', 'g_work', 'g_collect']));
  });

  it('free beds attract villagers each morning, levels unlock buildings', () => {
    const c = rich();
    c.building.place('h_cottage', 10, 10, 0, 'hamlet');
    c.building.place('h_cottage', 14, 10, 0, 'hamlet');
    c.building.place('h_well', 18, 10, 0, 'hamlet');
    expect(c.building.affordable('h_tavern').ok).toBe(false); // needs hamlet level 2
    for (let i = 0; i < 5; i++) c.time.sleep();
    expect(c.hamlet.population()).toBe(4);
    expect(c.state.hamlet.level).toBe(2);
    expect(c.building.affordable('h_tavern').ok).toBe(true);
    for (const v of c.state.hamlet.villagers) expect(v.homeUid).not.toBeNull();
  });

  it('wishes can be delivered for rewards; storing a home makes villagers homeless', () => {
    const c = rich();
    const home = c.building.place('h_hut', 10, 10, 0, 'hamlet')!;
    const v = c.state.hamlet.villagers[0];
    v.wish = { id: 'bread', qty: 1, until: c.state.time.day + 3 };
    const coins = c.state.player.coins;
    expect(c.hamlet.deliverWish(v.uid).ok).toBe(true); // starter kit has bread
    expect(c.state.player.coins).toBeGreaterThan(coins);
    expect(v.wish).toBeNull();
    expect(c.hamlet.gift(v.uid, 'wood').ok).toBe(true);
    expect(c.hamlet.gift(v.uid, 'wood').ok).toBe(false); // once a day
    expect(c.building.store(home.uid)).toBe(true);
    expect(v.homeUid).toBeNull();
    expect(c.hamlet.targetHappiness(v)).toBeLessThan(50);
  });

  it('old saves gain the hamlet on load', () => {
    const raw = JSON.parse(JSON.stringify(createNewGame('Old', 'F', undefined, 9)));
    delete raw.hamlet;
    delete raw.regions.hamlet;
    const s = migrate(raw);
    expect(s.hamlet.villagers).toEqual([]);
    expect(s.regions.hamlet.unlocked).toBe(true);
  });
});

describe('rewarded ads (always optional, capped per day)', () => {
  it('daily limits, free offers and doubled earnings', () => {
    const c = fresh();
    const gems = c.state.player.gems;
    for (let i = 0; i < 5; i++) expect(c.adRewards.grant('gems')).toBe('+3 💎');
    expect(c.adRewards.grant('gems')).toBeNull(); // 5 per day
    expect(c.state.player.gems).toBe(gems + 15);
    // doubled earnings need yesterday's sales
    expect(c.adRewards.can('double_earnings')).toBe(false);
    c.adRewards.setYesterdayEarnings(5000);
    expect(c.adRewards.doubleAmount()).toBe(2000);
    const coins = c.state.player.coins;
    c.adRewards.grant('double_earnings');
    expect(c.state.player.coins).toBe(coins + 2000);
    expect(c.adRewards.can('double_earnings')).toBe(false);
    // a cheap shop offer can be unlocked for free, expensive/animal ones cannot
    const all = ['general', 'florist', 'boutique'].flatMap((id) => c.shop.offers(id));
    const seeds = all.find((o) => o.id === 'seed_lettuce')!;
    expect(c.adRewards.grant('free_offer', seeds)).toBeNull(); // too cheap to be worth an ad
    const deco = all.find((o) => o.kind === 'decor' && o.currency === 'coins' && o.price >= 100 && !o.locked)!;
    const before = c.state.decorOwned[deco.id] ?? 0;
    expect(c.adRewards.grant('free_offer', deco)).not.toBeNull();
    expect(c.state.decorOwned[deco.id]).toBe(before + 1);
    // limits reset the next day
    c.time.sleep();
    expect(c.adRewards.left('gems')).toBe(5);
    expect(c.adRewards.can('hamlet_boost')).toBe(false); // no hamlet workers yet
  });
});

describe('local multiplayer', () => {
  it('only keeps safe appearance fields from the network', async () => {
    const { cleanLook } = await import('../src/net/LocalNet');
    const look = cleanLook({ skin: 3, top: 'x'.repeat(500), hairStyle: 'evil', cheeks: 'yes', height: 9, __proto__: { hack: 1 }, extra: { a: 1 } });
    expect(look.skin).toBe(3);
    expect(look.top.length).toBeLessThanOrEqual(24);
    expect(typeof look.hairStyle).toBe('number');
    expect(typeof look.cheeks).toBe('boolean');
    expect(look.height).toBe(1.08);
    expect((look as any).extra).toBeUndefined();
    expect(cleanLook(null).top).toBeTruthy();
  });
});
