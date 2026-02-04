import { Redis } from 'ioredis'
import type { CacheAdapter, CacheStats } from './types.js'
import { logger } from '../../utils/logger.js'

/**
 * Redis-backed cache adapter for distributed caching.
 *
 * Uses ioredis for Redis connectivity with automatic reconnection
 * and lazy connection. Suitable for horizontal scaling scenarios
 * where cache state needs to be shared across multiple instances.
 */
export class RedisCache implements CacheAdapter {
  private client: Redis
  private _hits: number
  private _misses: number

  /**
   * Create a new Redis cache adapter.
   *
   * @param url - Redis connection URL (e.g., redis://:password@host:port)
   */
  constructor(url: string) {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number): number | null => {
        if (times > 3) {
          logger.error({ attempt: times }, 'redis.retry_exhausted')
          return null // Stop retrying
        }
        const delay = Math.min(times * 100, 3000)
        logger.warn({ attempt: times, delayMs: delay }, 'redis.retry')
        return delay
      },
      lazyConnect: true,
    })
    this._hits = 0
    this._misses = 0

    this.client.on('error', (err: Error) => {
      logger.error({ err: err.message }, 'redis.error')
    })
    this.client.on('connect', () => {
      logger.info('redis.connected')
    })
    this.client.on('ready', () => {
      logger.info('redis.ready')
    })
    this.client.on('close', () => {
      logger.warn('redis.closed')
    })
    this.client.on('reconnecting', () => {
      logger.info('redis.reconnecting')
    })
  }

  /**
   * Retrieves a value from Redis.
   *
   * @param key - Cache key to retrieve
   * @returns Promise resolving to cached value or null if not found
   */
  async get(key: string): Promise<string | null> {
    const value = await this.client.get(key)
    if (value !== null) {
      this._hits++
      logger.debug({ key }, 'cache.hit')
    } else {
      this._misses++
      logger.debug({ key }, 'cache.miss')
    }
    return value
  }

  /**
   * Stores a value in Redis.
   *
   * @param key - Cache key
   * @param value - Value to store
   */
  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value)
    logger.debug({ key }, 'cache.set')
  }

  /**
   * Clears all entries from the current Redis database.
   */
  async clear(): Promise<void> {
    await this.client.flushdb()
    this._hits = 0
    this._misses = 0
    logger.info('cache.cleared')
  }

  /**
   * Current cache statistics.
   *
   * Note: size is always 0 as tracking Redis key count
   * would require DBSIZE which has performance implications.
   */
  get stats(): CacheStats {
    return {
      hits: this._hits,
      misses: this._misses,
      size: 0, // Redis doesn't track size easily in-memory stats
    }
  }

  /**
   * Gracefully disconnect from Redis.
   *
   * Call this during application shutdown to ensure clean connection closure.
   */
  async disconnect(): Promise<void> {
    await this.client.quit()
    logger.info('redis.disconnected')
  }
}
