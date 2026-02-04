/** Cache statistics. */
export type CacheStats = {
  /** Number of successful cache lookups */
  readonly hits: number
  /** Number of cache lookups that returned null */
  readonly misses: number
  /** Current number of entries in the cache */
  readonly size: number
}

/** Cache adapter configuration. */
export type CacheConfig = {
  /** Maximum number of entries before LRU eviction */
  readonly maxSize: number
}

/** Cache adapter interface. */
export type CacheAdapter = {
  /**
   * Retrieves a value from the cache.
   *
   * @param key - Cache key to retrieve
   * @returns Promise resolving to cached value or null if not found
   */
  get(key: string): Promise<string | null>

  /**
   * Stores a value in the cache.
   *
   * @param key - Cache key
   * @param value - Value to store
   */
  set(key: string, value: string): Promise<void>

  /**
   * Clears all entries from the cache.
   */
  clear(): Promise<void>

  /** Current cache statistics */
  readonly stats: CacheStats
}
