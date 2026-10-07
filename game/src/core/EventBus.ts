/** Tiny typed-ish event bus used to decouple systems (logic) from views (render/UI/audio). */
export type Handler = (payload?: any) => void;

export class EventBus {
  private map = new Map<string, Set<Handler>>();

  on(evt: string, fn: Handler): () => void {
    let set = this.map.get(evt);
    if (!set) this.map.set(evt, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  once(evt: string, fn: Handler): void {
    const off = this.on(evt, (p) => {
      off();
      fn(p);
    });
  }

  emit(evt: string, payload?: any): void {
    const set = this.map.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[EventBus] handler for "${evt}" failed`, e);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}

export const bus = new EventBus();
