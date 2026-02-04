import type { QueueAdapter, QueueConfig, QueueStats } from './types.js'

/** Inngest queue adapter stub. */
export class InngestQueue<T, R> implements QueueAdapter<T, R> {
  constructor(_name: string, _config: QueueConfig<T, R>) {
    throw new Error('Inngest queue adapter is not implemented yet')
  }

  enqueue(_data: T): Promise<R> {
    throw new Error('Inngest queue adapter is not implemented yet')
  }

  drain(): Promise<void> {
    throw new Error('Inngest queue adapter is not implemented yet')
  }

  clear(): void {
    throw new Error('Inngest queue adapter is not implemented yet')
  }

  get stats(): QueueStats {
    throw new Error('Inngest queue adapter is not implemented yet')
  }

  get pendingCount(): number {
    throw new Error('Inngest queue adapter is not implemented yet')
  }

  get processingCount(): number {
    throw new Error('Inngest queue adapter is not implemented yet')
  }
}
