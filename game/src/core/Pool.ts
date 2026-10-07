/** Generic object pool to avoid GC spikes on mobile (particles, popups, projectiles). */
export class Pool<T> {
  private free: T[] = [];
  constructor(private factory: () => T, private reset?: (t: T) => void, prewarm = 0) {
    for (let i = 0; i < prewarm; i++) this.free.push(factory());
  }
  get(): T {
    return this.free.pop() ?? this.factory();
  }
  release(t: T): void {
    this.reset?.(t);
    this.free.push(t);
  }
  get size(): number {
    return this.free.length;
  }
}
