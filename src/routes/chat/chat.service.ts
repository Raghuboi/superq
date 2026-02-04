import { randomUUID } from 'node:crypto'
import { ChatRepository } from './chat.repository.js'
import type { QueueStats } from '../../lib/queue/types.js'
import type { CacheStats } from '../../lib/cache/types.js'

/** Result of message processing. */
export type ProcessResult = {
  readonly id: string
  readonly hash: string
  readonly processingTimeMs: number
  readonly fromCache: boolean
}

/** Service for processing chat messages. */
export class ChatService {
  private repository: ChatRepository

  constructor(options?: { delayMs?: number; concurrency?: number }) {
    this.repository = new ChatRepository(options)
  }

  /**
   * Process a message and return its hash.
   *
   * @example
   * ```ts
   * const service = new ChatService()
   * const result = await service.processMessage('hello world')
   * ```
   */
  async processMessage(text: string): Promise<ProcessResult> {
    const id = randomUUID()

    const cached = await this.repository.getCached(text)
    if (cached) {
      return { id, hash: cached, processingTimeMs: 0, fromCache: true }
    }

    const result = await this.repository.enqueueComputation(text, id)
    return { id, hash: result.hash, processingTimeMs: result.processingTimeMs, fromCache: false }
  }

  /** Queue statistics. */
  get stats(): QueueStats {
    return this.repository.queueStats
  }

  /** Cache statistics. */
  get cacheStats(): CacheStats {
    return this.repository.cacheStats
  }

  /** Drain pending work before shutdown. */
  async shutdown(): Promise<void> {
    await this.repository.drain()
  }

  /** Reset queue state for tests. */
  reset(): void {
    this.repository.reset()
  }
}
