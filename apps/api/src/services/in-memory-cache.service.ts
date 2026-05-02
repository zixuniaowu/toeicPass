/**
 * InMemoryCacheService
 *
 * A lightweight TTL-based in-memory cache for NestJS.
 * Avoids adding `@nestjs/cache-manager` / Redis dependencies for environments
 * that don't need distributed caching.
 *
 * For production with multiple instances, swap this out for Redis-backed cache.
 *
 * Usage:
 *   @Injectable()
 *   class MyService {
 *     constructor(private readonly cache: InMemoryCacheService) {}
 *
 *     async getExpensiveData(tenantId: string) {
 *       const key = `my-data:${tenantId}`;
 *       const cached = this.cache.get<MyData>(key);
 *       if (cached !== undefined) return cached;
 *       const result = await this.computeExpensiveData(tenantId);
 *       this.cache.set(key, result, 60); // 60-second TTL
 *       return result;
 *     }
 *   }
 */
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";

interface CacheEntry<T> {
  value: T;
  expiresAtMs: number; // 0 = never expires
}

@Injectable()
export class InMemoryCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(InMemoryCacheService.name);
  private readonly store = new Map<string, CacheEntry<unknown>>();

  /** Evict expired entries every 5 minutes. */
  private readonly evictInterval = setInterval(() => this.evictExpired(), 5 * 60 * 1000);

  /**
   * Retrieve a cached value.
   * Returns `undefined` if the key does not exist or has expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (entry.expiresAtMs > 0 && Date.now() > entry.expiresAtMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Store a value.
   * @param key   Cache key
   * @param value Value to store (must be JSON-serialisable for persistence)
   * @param ttlSec TTL in seconds (default: 300). Pass 0 for no expiry.
   */
  set<T>(key: string, value: T, ttlSec = 300): void {
    const expiresAtMs = ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0;
    this.store.set(key, { value, expiresAtMs });
  }

  /** Delete a specific key. */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Delete all keys that match a prefix.
   * Useful for cache invalidation when a group of related resources changes.
   */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Clear the entire cache. */
  clear(): void {
    this.store.clear();
  }

  /** Number of entries currently in cache (including potentially-expired ones). */
  get size(): number {
    return this.store.size;
  }

  /**
   * Get-or-set pattern: returns cached value if present, otherwise calls
   * the factory, stores the result, and returns it.
   */
  async wrap<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSec = 300,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttlSec);
    return value;
  }

  private evictExpired(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAtMs > 0 && now > entry.expiresAtMs) {
        this.store.delete(key);
        evicted += 1;
      }
    }
    if (evicted > 0) {
      this.logger.debug(`Evicted ${evicted} expired cache entries`);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.evictInterval);
  }
}
