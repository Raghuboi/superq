import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import type { QueueItem, QueueStats, QueueConfig, QueueAdapter } from './types.js'
import { logger } from '../../utils/logger.js'
import { QUEUE_DEFAULTS } from '../constants.js'

/**
 * In-memory queue with concurrency control and request coalescing.
 *
 * Features:
 * - FIFO ordering with configurable concurrency (semaphore pattern)
 * - Request coalescing to deduplicate concurrent identical requests
 * - Promise-based async processing with proper error propagation
 *
 * @template T - Work item data type.
 * @template R - Result type returned by the processor.
 */
export class MemoryQueue<T, R> implements QueueAdapter<T, R> {
  private queue: QueueItem<T, R>[] = []
  private processing = new Map<string, QueueItem<T, R>>()
  private coalescing = new Map<string, QueueItem<T, R>>()

  private readonly concurrency: number
  private readonly processor: (data: T) => Promise<R>
  private readonly getCoalesceKey: ((data: T) => string) | undefined

  private _stats = {
    completed: 0,
    failed: 0,
    coalesced: 0,
    totalEnqueued: 0,
    totalProcessed: 0,
  }

  /**
   * Create a new MemoryQueue.
   *
   * @param config - Queue configuration.
   * @param config.concurrency - Maximum concurrent workers (default: 1).
   * @param config.processor - Async function to process each work item.
   * @param config.getCoalesceKey - Optional function to derive coalescing key from data.
   */
  constructor(config: QueueConfig<T, R>) {
    this.concurrency = config.concurrency ?? QUEUE_DEFAULTS.CONCURRENCY
    this.processor = config.processor
    this.getCoalesceKey = config.getCoalesceKey
  }

  /**
   * Enqueue a work item with optional coalescing.
   *
   * If a coalesce key is configured and a matching item is already in-flight,
   * the caller's promise will be chained to the existing item's result.
   *
   * @param data - The work item to enqueue.
   * @returns A promise that resolves with the processor result.
   */
  async enqueue(data: T): Promise<R> {
    const coalesceKey = this.getCoalesceKey?.(data)

    // Request coalescing
    if (coalesceKey) {
      const existing = this.coalescing.get(coalesceKey)
      if (existing) {
        this._stats.coalesced++
        logger.info({ coalesceKey }, 'queue.coalesced')
        return new Promise((resolve, reject) => {
          const originalResolve = existing.resolve
          const originalReject = existing.reject
          existing.resolve = (result: R): void => {
            originalResolve(result)
            resolve(result)
          }
          existing.reject = (error: Error): void => {
            originalReject(error)
            reject(error)
          }
        })
      }
    }

    return new Promise((resolve, reject) => {
      const item: QueueItem<T, R> = {
        id: randomUUID(),
        data,
        enqueuedAt: Date.now(),
        status: 'pending',
        resolve,
        reject,
      }

      this._stats.totalEnqueued++
      this.queue.push(item)

      if (coalesceKey) {
        this.coalescing.set(coalesceKey, item)
      }

      logger.info({ id: item.id, pending: this.queue.length }, 'queue.enqueue')
      this.processNext()
    })
  }

  private processNext(): void {
    if (this.processing.size >= this.concurrency) return

    const item = this.queue.shift()
    if (!item) return

    item.status = 'processing'
    item.startedAt = Date.now()
    this.processing.set(item.id, item)

    const queueWaitMs = item.startedAt - item.enqueuedAt
    logger.info({ id: item.id, queueWaitMs }, 'queue.processing.start')

    this.processor(item.data)
      .then((result) => {
        item.status = 'completed'
        item.completedAt = Date.now()
        this._stats.completed++
        this._stats.totalProcessed++

        const processingTimeMs = item.completedAt - (item.startedAt ?? item.enqueuedAt)
        logger.info({ id: item.id, processingTimeMs }, 'queue.dequeue')

        item.resolve(result)
      })
      .catch((error: unknown) => {
        item.status = 'failed'
        item.completedAt = Date.now()
        this._stats.failed++
        this._stats.totalProcessed++

        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error({ id: item.id, error: errorMessage }, 'queue.failed')

        item.reject(error instanceof Error ? error : new Error(String(error)))
      })
      .finally(() => {
        this.processing.delete(item.id)

        const coalesceKey = this.getCoalesceKey?.(item.data)
        if (coalesceKey) {
          this.coalescing.delete(coalesceKey)
        }

        this.processNext()
      })
  }

  /**
   * Queue statistics including pending, processing, and completed counts.
   */
  get stats(): QueueStats {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this._stats.completed,
      failed: this._stats.failed,
      coalesced: this._stats.coalesced,
      totalEnqueued: this._stats.totalEnqueued,
      totalProcessed: this._stats.totalProcessed,
    }
  }

  get pendingCount(): number {
    return this.queue.length
  }

  get processingCount(): number {
    return this.processing.size
  }

  /**
   * Drain pending work.
   *
   * Waits until both the pending queue and in-progress work are empty.
   * Used for graceful shutdown.
   */
  async drain(): Promise<void> {
    while (this.queue.length > 0 || this.processing.size > 0) {
      await setTimeout(QUEUE_DEFAULTS.DRAIN_POLL_MS)
    }
  }

  /**
   * Clear pending items and reset stats.
   *
   * All pending items will be rejected with a "Queue cleared" error.
   * In-progress items will complete normally.
   */
  clear(): void {
    this.queue.forEach((item) => {
      item.reject(new Error('Queue cleared'))
    })
    this.queue = []
    this.coalescing.clear()
    this._stats = { completed: 0, failed: 0, coalesced: 0, totalEnqueued: 0, totalProcessed: 0 }
  }
}
