/**
 * Shared response types for integration tests.
 */

export type ChatResponse = {
  readonly success: boolean
  readonly data?: {
    readonly id: string
    readonly text: string
    readonly hash: string
    readonly processingTimeMs: number
    readonly fromCache: boolean
  }
  readonly error?: {
    readonly code: string
    readonly message: string
  }
}

export type HealthResponse = {
  readonly success: boolean
  readonly data?: {
    readonly status: string
    readonly uptime: number
    readonly cache: {
      readonly hits: number
      readonly misses: number
      readonly size: number
    }
    readonly queue: {
      readonly pending: number
      readonly processing: number
      readonly completed: number
      readonly failed: number
      readonly coalesced: number
      readonly totalEnqueued: number
      readonly totalProcessed: number
    }
  }
}

export type ErrorResponse = {
  readonly success: boolean
  readonly error?: {
    readonly code: string
    readonly message: string
  }
}
