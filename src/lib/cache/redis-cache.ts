import type { CacheAdapter, CacheStats } from './types.js'

/** Redis cache adapter stub. */
export class RedisCache implements CacheAdapter {
  constructor(_url: string) {
    throw new Error('Redis cache adapter is not implemented yet')
  }

  get(_key: string): Promise<string | null> {
    throw new Error('Redis cache adapter is not implemented yet')
  }

  set(_key: string, _value: string): Promise<void> {
    throw new Error('Redis cache adapter is not implemented yet')
  }

  clear(): Promise<void> {
    throw new Error('Redis cache adapter is not implemented yet')
  }

  get stats(): CacheStats {
    throw new Error('Redis cache adapter is not implemented yet')
  }
}
