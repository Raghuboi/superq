import type { CacheAdapter, CacheConfig } from './types.js'
import { MemoryCache } from './memory-cache.js'
import { RedisCache } from './redis-cache.js'
import { env } from '../env.js'

let instance: CacheAdapter | null = null

/**
 * Return the singleton cache adapter.
 *
 * Creates the adapter on first call based on env.cacheType.
 * Subsequent calls return the same instance.
 *
 * @param options - Optional configuration (used only on first call).
 * @returns The cache adapter instance.
 */
export function getCache(options?: CacheConfig): CacheAdapter {
  if (instance) return instance

  switch (env.cacheType) {
    case 'redis':
      instance = new RedisCache(env.redisUrl ?? '')
      break
    default:
      instance = new MemoryCache(options?.maxSize ?? env.cacheMaxSize)
  }

  return instance
}

/**
 * Reset cache instance for tests.
 *
 * Sets the singleton to null so the next getCache() call creates a fresh instance.
 */
export function resetCache(): void {
  instance = null
}

/**
 * Clear cache entries.
 *
 * Clears all entries and resets statistics without destroying the instance.
 */
export async function clearCache(): Promise<void> {
  if (instance) await instance.clear()
}
