export type TtlCacheOptions = {
  defaultTtlMs: number;
  now?: () => number;
};

export type TtlCacheStats = {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
};

type CacheEntry<V> = {
  expiresAt: number;
  value: V;
};

export class TtlCache<K, V> {
  private readonly map = new Map<K, CacheEntry<V>>();
  private readonly now: () => number;
  private readonly defaultTtlMs: number;
  public readonly stats: TtlCacheStats = { hits: 0, misses: 0, sets: 0, evictions: 0 };

  constructor({ defaultTtlMs, now }: TtlCacheOptions) {
    this.defaultTtlMs = defaultTtlMs;
    this.now = now ?? (() => Date.now());
  }

  get size(): number {
    return this.map.size;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.stats.misses += 1;
      return undefined;
    }

    if (this.now() >= entry.expiresAt) {
      this.map.delete(key);
      this.stats.evictions += 1;
      this.stats.misses += 1;
      return undefined;
    }

    this.stats.hits += 1;
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const effectiveTtlMs = typeof ttlMs === "number" ? ttlMs : this.defaultTtlMs;
    this.map.set(key, { value, expiresAt: this.now() + Math.max(0, effectiveTtlMs) });
    this.stats.sets += 1;
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

