/** Queue item status. */
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** Internal queued work item. */
export type QueueItem<T, R> = {
  /** Unique identifier for this queue item */
  readonly id: string
  /** The work item data to process */
  readonly data: T
  /** Timestamp when item was added to queue */
  readonly enqueuedAt: number
  /** Current status of the item */
  status: QueueItemStatus
  /** Timestamp when processing started (set when status becomes 'processing') */
  startedAt?: number
  /** Timestamp when processing completed (set when status becomes 'completed' or 'failed') */
  completedAt?: number
  /** Function to resolve the enqueue promise with the result */
  resolve: (result: R) => void
  /** Function to reject the enqueue promise with an error */
  reject: (error: Error) => void
}

/** Queue statistics. */
export type QueueStats = {
  /** Number of items waiting to be processed */
  readonly pending: number
  /** Number of items currently being processed */
  readonly processing: number
  /** Number of items that completed successfully */
  readonly completed: number
  /** Number of items that failed processing */
  readonly failed: number
  /** Number of requests that were coalesced into existing work */
  readonly coalesced: number
  /** Total number of items ever enqueued */
  readonly totalEnqueued: number
  /** Total number of items that finished processing (completed + failed) */
  readonly totalProcessed: number
}

/** Queue adapter configuration. */
export type QueueConfig<T, R> = {
  /** Maximum concurrent processors (default: 1) */
  readonly concurrency?: number
  /** Function that processes work items and returns results */
  readonly processor: (data: T) => Promise<R>
  /** Optional function to generate coalesce keys for request deduplication */
  readonly getCoalesceKey?: (data: T) => string
}

/** Queue adapter interface. */
export type QueueAdapter<T, R> = {
  /**
   * Enqueues a work item for processing.
   *
   * @param data - The work item data to process
   * @returns Promise resolving to the processing result
   */
  enqueue(data: T): Promise<R>

  /**
   * Waits for all pending and in-progress items to complete.
   */
  drain(): Promise<void>

  /**
   * Clears all pending items and resets statistics.
   */
  clear(): void

  /** Current queue statistics */
  readonly stats: QueueStats

  /** Number of items waiting to be processed */
  readonly pendingCount: number

  /** Number of items currently being processed */
  readonly processingCount: number
}
