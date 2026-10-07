import type { Ctx } from './Context';
import type { ItemStack } from '../state/types';
import { MAX_STACK } from '../data/constants';
import { DECOR_BY_ID } from '../data/decor';
import { item } from '../data/items';

export class InventorySystem {
  constructor(private ctx: Ctx) {}

  get slots(): (ItemStack | null)[] {
    return this.ctx.state.inventory;
  }

  count(id: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.qty;
    return n;
  }

  has(id: string, qty = 1): boolean {
    return this.count(id) >= qty;
  }

  hasAll(list: [string, number][]): boolean {
    return list.every(([id, q]) => this.count(id) >= q);
  }

  /**
   * Adds items. Decorations go to the build bag. When the backpack is full the
   * overflow is sent to farm storage (never lost — no pressure).
   */
  add(id: string, qty = 1, silent = false): number {
    if (qty <= 0) return 0;
    const st = this.ctx.state;
    if (DECOR_BY_ID[id]) {
      st.decorOwned[id] = (st.decorOwned[id] ?? 0) + qty;
      this.ctx.bus.emit('decor:changed');
      if (!silent) this.ctx.bus.emit('item:gained', { id, qty });
      return 0;
    }
    let left = qty;
    for (const s of this.slots) {
      if (left <= 0) break;
      if (s && s.id === id && s.qty < MAX_STACK) {
        const add = Math.min(left, MAX_STACK - s.qty);
        s.qty += add;
        left -= add;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(left, MAX_STACK);
        this.slots[i] = { id, qty: add };
        left -= add;
      }
    }
    if (left > 0) {
      this.addToStorage(id, left);
      if (!silent) this.ctx.toast(`Sac plein : ${left}× ${item(id).name} envoyé(s) à la remise`, '📦', 'warn');
    }
    this.ctx.bus.emit('inv:changed');
    if (!silent) this.ctx.bus.emit('item:gained', { id, qty });
    this.ctx.progress('collect', id, qty);
    return 0;
  }

  addToStorage(id: string, qty: number): void {
    const st = this.ctx.state.storage;
    const s = st.find((x) => x.id === id);
    if (s) s.qty += qty;
    else st.push({ id, qty });
  }

  takeFromStorage(id: string, qty: number): number {
    const st = this.ctx.state.storage;
    const s = st.find((x) => x.id === id);
    if (!s) return 0;
    const n = Math.min(qty, s.qty, this.freeCapacityFor(id));
    if (n <= 0) return 0;
    s.qty -= n;
    if (s.qty <= 0) st.splice(st.indexOf(s), 1);
    this.addSilentNoProgress(id, n);
    return n;
  }

  /** Move a whole slot to storage. */
  storeSlot(index: number): void {
    const s = this.slots[index];
    if (!s) return;
    this.addToStorage(s.id, s.qty);
    this.slots[index] = null;
    this.ctx.bus.emit('inv:changed');
  }

  freeCapacityFor(id: string): number {
    let cap = 0;
    for (const s of this.slots) {
      if (!s) cap += MAX_STACK;
      else if (s.id === id) cap += MAX_STACK - s.qty;
    }
    return cap;
  }

  private addSilentNoProgress(id: string, qty: number): void {
    let left = qty;
    for (const s of this.slots) {
      if (left <= 0) break;
      if (s && s.id === id && s.qty < MAX_STACK) {
        const add = Math.min(left, MAX_STACK - s.qty);
        s.qty += add;
        left -= add;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(left, MAX_STACK);
        this.slots[i] = { id, qty: add };
        left -= add;
      }
    }
    this.ctx.bus.emit('inv:changed');
  }

  remove(id: string, qty = 1): boolean {
    if (this.count(id) < qty) return false;
    let left = qty;
    // remove from the last stacks first so the first slots stay stable
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(left, s.qty);
        s.qty -= take;
        left -= take;
        if (s.qty <= 0) this.slots[i] = null;
      }
    }
    this.ctx.bus.emit('inv:changed');
    return true;
  }

  removeAll(list: [string, number][]): boolean {
    if (!this.hasAll(list)) return false;
    for (const [id, q] of list) this.remove(id, q);
    return true;
  }

  swap(a: number, b: number): void {
    const s = this.slots;
    if (a === b || a < 0 || b < 0 || a >= s.length || b >= s.length) return;
    const A = s[a], B = s[b];
    if (A && B && A.id === B.id) {
      const room = MAX_STACK - B.qty;
      const mv = Math.min(room, A.qty);
      B.qty += mv;
      A.qty -= mv;
      if (A.qty <= 0) s[a] = null;
    } else {
      s[a] = B;
      s[b] = A;
    }
    this.ctx.bus.emit('inv:changed');
  }

  sort(): void {
    const order = ['seed', 'crop', 'flower', 'fruit', 'animal', 'dish', 'fish', 'insect', 'forage', 'material', 'mineral', 'artisan', 'sapling', 'misc'];
    const merged = new Map<string, number>();
    for (const s of this.slots) if (s) merged.set(s.id, (merged.get(s.id) ?? 0) + s.qty);
    const list = [...merged.entries()].sort((a, b) => {
      const ca = order.indexOf(item(a[0]).cat), cb = order.indexOf(item(b[0]).cat);
      return ca - cb || item(a[0]).name.localeCompare(item(b[0]).name);
    });
    const out: (ItemStack | null)[] = new Array(this.slots.length).fill(null);
    let i = 0;
    for (const [id, qty] of list) {
      let q = qty;
      while (q > 0 && i < out.length) {
        const take = Math.min(q, MAX_STACK);
        out[i++] = { id, qty: take };
        q -= take;
      }
      if (q > 0) this.addToStorage(id, q);
    }
    this.ctx.state.inventory = out;
    this.ctx.bus.emit('inv:changed');
  }

  resize(size: number): void {
    const st = this.ctx.state;
    while (st.inventory.length < size) st.inventory.push(null);
    st.inventorySize = size;
    this.ctx.bus.emit('inv:changed');
  }

  /** All seeds the player is carrying, for the quick seed picker. */
  seeds(): ItemStack[] {
    return this.slots.filter((s): s is ItemStack => !!s && (s.id.startsWith('seed_') || s.id.startsWith('sapling_')));
  }
}
