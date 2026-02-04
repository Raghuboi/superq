import { Inngest } from 'inngest'
import type { QueueAdapter, QueueConfig, QueueStats } from './types.js'
import { logger } from '../../utils/logger.js'
import { env } from '../env.js'

// Inngest client singleton - created lazily when needed
let inngestClient: Inngest | null = null

/**
 * Get the Inngest client singleton.
 *
 * Creates the client on first access using environment configuration.
 * Throws if required environment variables are not set.
 */
export function getInngestClient(): Inngest {
  if (inngestClient) return inngestClient

  if (!env.inngestEventKey) {
    throw new Error('INNGEST_EVENT_KEY is required for Inngest queue')
  }

  inngestClient = new Inngest({
    id: 'superq',
    eventKey: env.inngestEventKey,
    ...(env.inngestSigningKey && { signingKey: env.inngestSigningKey }),
  })

  logger.info('inngest.client_created')
  return inngestClient
}

/** Internal mutable stats for tracking. */
type MutableStats = {
  pending: number
  processing: number
  completed: number
  failed: number
  coalesced: number
  totalEnqueued: number
  totalProcessed: number
}

/**
 * Inngest-backed queue adapter for durable execution.
 *
 * Uses Inngest for background job processing with exactly-once semantics,
 * automatic retries, and observability. Suitable for production workloads
 * requiring reliability and horizontal scaling.
 *
 * Note: Unlike MemoryQueue, Inngest operates asynchronously via webhooks.
 * The enqueue() method sends an event and processes locally while waiting
 * for the Inngest platform to also execute the function. For true async
 * behavior, the processor is called immediately but Inngest provides
 * durability guarantees for the background execution.
 */
export class InngestQueue<T, R> implements QueueAdapter<T, R> {
  private name: string
  private config: QueueConfig<T, R>
  private _stats: MutableStats

  /**
   * Create a new Inngest queue adapter.
   *
   * @param name - Queue name used as event name prefix
   * @param config - Queue configuration including processor function
   */
  constructor(name: string, config: QueueConfig<T, R>) {
    this.name = name
    this.config = config
    this._stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      coalesced: 0,
      totalEnqueued: 0,
      totalProcessed: 0,
    }

    logger.info({ queue: this.name }, 'inngest_queue.created')
  }

  /**
   * Enqueue a work item for processing.
   *
   * Sends an event to Inngest and processes the item locally.
   * The Inngest function will also process the event for durability,
   * but the local processor ensures immediate response to the caller.
   *
   * @param data - Work item to process
   * @returns Promise resolving to the processing result
   */
  async enqueue(data: T): Promise<R> {
    this._stats.totalEnqueued++
    this._stats.pending++

    const requestId = (data as { requestId?: string }).requestId ?? 'unknown'
    logger.info({ queue: this.name, requestId }, 'inngest_queue.enqueue')

    try {
      // Send event to Inngest for durable background processing
      const client = getInngestClient()
      await client.send({
        name: `superq/${this.name}`,
        data: data as Record<string, unknown>,
      })

      this._stats.pending--
      this._stats.processing++

      // Process locally for immediate response
      // Inngest will also process via webhook for durability
      const result = await this.config.processor(data)

      this._stats.processing--
      this._stats.completed++
      this._stats.totalProcessed++

      logger.info({ queue: this.name, requestId }, 'inngest_queue.completed')

      return result
    } catch (error) {
      this._stats.pending--
      this._stats.failed++
      this._stats.totalProcessed++

      logger.error(
        { queue: this.name, requestId, err: (error as Error).message },
        'inngest_queue.failed'
      )

      throw error
    }
  }

  /**
   * Drain pending work.
   *
   * For Inngest, this is a no-op as work is processed externally.
   * The Inngest platform handles queuing and execution.
   */
  drain(): Promise<void> {
    logger.info({ queue: this.name }, 'inngest_queue.drain')
    return Promise.resolve()
  }

  /**
   * Clear queue state and reset statistics.
   */
  clear(): void {
    this._stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      coalesced: 0,
      totalEnqueued: 0,
      totalProcessed: 0,
    }
    logger.info({ queue: this.name }, 'inngest_queue.cleared')
  }

  /** Current queue statistics. */
  get stats(): QueueStats {
    return { ...this._stats }
  }

  /** Number of items waiting to be processed. */
  get pendingCount(): number {
    return this._stats.pending
  }

  /** Number of items currently being processed. */
  get processingCount(): number {
    return this._stats.processing
  }
}
