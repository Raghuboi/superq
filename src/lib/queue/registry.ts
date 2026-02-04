import type { QueueConfig, QueueAdapter } from './types.js'
import { MemoryQueue } from './memory-queue.js'
import { InngestQueue } from './inngest-queue.js'
import { env } from '../env.js'

const instances = new Map<string, QueueAdapter<unknown, unknown>>()

/**
 * Return a named queue adapter instance.
 *
 * Uses singleton pattern per queue name. Adapter type is determined by env.queueType.
 *
 * @param name - Unique identifier for this queue.
 * @param queueConfig - Queue configuration including processor and concurrency.
 * @returns The queue adapter instance (existing or newly created).
 */
export function getQueue<T, R>(name: string, queueConfig: QueueConfig<T, R>): QueueAdapter<T, R> {
  const existing = instances.get(name)
  if (existing) return existing as QueueAdapter<T, R>

  const queue =
    env.queueType === 'inngest'
      ? new InngestQueue(name, queueConfig)
      : new MemoryQueue({
          ...queueConfig,
          concurrency: queueConfig.concurrency ?? env.queueConcurrency,
        })

  instances.set(name, queue as QueueAdapter<unknown, unknown>)
  return queue
}

/**
 * Drain all registered queues.
 *
 * Waits until all queues have completed their pending and in-progress work.
 * Used for graceful shutdown.
 */
export async function drainAllQueues(): Promise<void> {
  await Promise.all(Array.from(instances.values()).map((q) => q.drain()))
}

/**
 * Clear all registered queues.
 *
 * Clears pending items and resets stats for all queues, then removes
 * them from the registry. Used for test cleanup.
 */
export function clearAllQueues(): void {
  instances.forEach((q) => {
    q.clear()
  })
  instances.clear()
}
