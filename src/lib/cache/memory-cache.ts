import type { CacheAdapter, CacheStats } from './types.js'
import { logger } from '../../utils/logger.js'

/**
 * In-memory LRU (Least Recently Used) cache.
 *
 * Uses JavaScript's Map insertion-order guarantee for O(1) LRU operations.
 * When the cache exceeds maxSize, the least recently accessed entry is evicted.
 */
export class MemoryCache implements CacheAdapter {
  private data = new Map<string, string>()
  private _hits = 0
  private _misses = 0

  /**
   * Create a new MemoryCache.
   *
   * @param maxSize - Maximum number of entries before LRU eviction.
   */
  constructor(private readonly maxSize: number) {}

  /**
   * Get a value and update LRU order.
   *
   * @param key - The cache key.
   * @returns The cached value, or null if not found.
   */
  get(key: string): Promise<string | null> {
    const entry = this.data.get(key)
    if (!entry) {
      this._misses++
      logger.info({ key }, 'cache.miss')
      return Promise.resolve(null)
    }
    this._hits++
    logger.info({ key }, 'cache.hit')
    this.data.delete(key)
    this.data.set(key, entry)
    return Promise.resolve(entry)
  }

  /**
   * Store a value with LRU eviction.
   *
   * @param key - The cache key.
   * @param value - The value to store.
   */
  set(key: string, value: string): Promise<void> {
    this.data.delete(key)
    this.data.set(key, value)
    if (this.data.size > this.maxSize) {
      const oldest = this.data.keys().next().value
      if (oldest) this.data.delete(oldest)
    }
    return Promise.resolve()
  }

  /**
   * Clear all entries and reset stats.
   */
  clear(): Promise<void> {
    this.data.clear()
    this._hits = 0
    this._misses = 0
    return Promise.resolve()
  }

  /**
   * Cache statistics including hits, misses, and current size.
   */
  get stats(): CacheStats {
    return { hits: this._hits, misses: this._misses, size: this.data.size }
  }
}
