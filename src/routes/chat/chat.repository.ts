import { createHash } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import type { CacheAdapter, CacheStats } from '../../lib/cache/types.js'
import type { QueueAdapter, QueueStats } from '../../lib/queue/types.js'
import { getCache } from '../../lib/cache/index.js'
import { getQueue } from '../../lib/queue/index.js'
import { env } from '../../lib/env.js'
import { logger } from '../../utils/logger.js'

type WorkItem = { text: string; requestId: string }
type WorkResult = { hash: string; processingTimeMs: number }

/**
 * Repository for queue and cache operations.
 *
 * Implements the cache-aside pattern: check cache first, enqueue computation on miss.
 * Coordinates SHA-256 hash computation with configurable delay and concurrency.
 */
export class ChatRepository {
  private cache: CacheAdapter
  private queue: QueueAdapter<WorkItem, WorkResult>
  private delayMs: number

  /**
   * Create a new ChatRepository.
   *
   * @param options - Configuration options.
   * @param options.delayMs - Processing delay in milliseconds (default: env.processingDelayMs).
   * @param options.concurrency - Maximum concurrent queue workers (default: env.queueConcurrency).
   */
  constructor(options?: { delayMs?: number; concurrency?: number }) {
    this.delayMs = options?.delayMs ?? env.processingDelayMs

    this.cache = getCache()
    this.queue = getQueue<WorkItem, WorkResult>('chat', {
      concurrency: options?.concurrency ?? env.queueConcurrency,
      processor: (item) => this.computeAndStore(item),
      getCoalesceKey: (item) => item.text,
    })
  }

  /**
   * Get cached hash for text.
   *
   * @param key - The text to look up in cache.
   * @returns The cached SHA-256 hash, or null if not found.
   */
  async getCached(key: string): Promise<string | null> {
    return this.cache.get(key)
  }

  /**
   * Enqueue a hash computation with request coalescing.
   *
   * If an identical request is already in-flight, the caller will receive
   * the same result without triggering duplicate computation.
   *
   * @param text - The text to hash.
   * @param requestId - Unique identifier for logging and tracing.
   * @returns The computed hash and processing time.
   */
  async enqueueComputation(text: string, requestId: string): Promise<WorkResult> {
    return this.queue.enqueue({ text, requestId })
  }

  /**
   * Compute a SHA-256 hash after the configured delay and store it in cache.
   *
   * @param item - Work item with text and request id.
   * @example
   * ```ts
   * const result = await repository.enqueueComputation('hello', 'req-123')
   * ```
   */
  private async computeAndStore(item: WorkItem): Promise<WorkResult> {
    const start = performance.now()
    await setTimeout(this.delayMs)
    const hash = createHash('sha256').update(item.text).digest('hex')
    await this.cache.set(item.text, hash)
    const processingTimeMs = performance.now() - start
    logger.info({ requestId: item.requestId, processingTimeMs, text: item.text }, 'processing.complete')
    return { hash, processingTimeMs }
  }

  /**
   * Queue statistics including pending, processing, and completed counts.
   */
  get queueStats(): QueueStats {
    return this.queue.stats
  }

  /**
   * Cache statistics including hits, misses, and current size.
   */
  get cacheStats(): CacheStats {
    return this.cache.stats
  }

  /**
   * Drain pending work from the queue.
   *
   * Waits until all pending and in-progress items are processed.
   * Used for graceful shutdown.
   */
  async drain(): Promise<void> {
    await this.queue.drain()
  }

  /**
   * Reset queue state for tests.
   *
   * Clears all pending items and resets statistics.
   */
  reset(): void {
    this.queue.clear()
  }
}
