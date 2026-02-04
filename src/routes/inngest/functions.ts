import { createHash } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { getInngestClient } from '../../lib/queue/inngest-queue.js'
import { getCache } from '../../lib/cache/index.js'
import { env } from '../../lib/env.js'
import { logger } from '../../utils/logger.js'

type HashEventData = {
  text: string
  requestId: string
}

/**
 * Inngest function for computing SHA-256 hashes.
 *
 * This function runs in Inngest's durable execution environment,
 * providing exactly-once semantics and automatic retries.
 */
export const hashFunction = getInngestClient().createFunction(
  {
    id: 'compute-hash',
    name: 'Compute SHA-256 Hash',
    concurrency: {
      limit: env.queueConcurrency,
    },
    retries: 3,
  },
  { event: 'superq/chat' },
  async ({ event }) => {
    const { text, requestId } = event.data as HashEventData
    const start = performance.now()

    logger.info({ requestId, text }, 'inngest_function.started')

    // Simulate processing delay
    await setTimeout(env.processingDelayMs)

    // Compute hash
    const hash = createHash('sha256').update(text).digest('hex')

    // Store in cache
    const cache = getCache()
    await cache.set(text, hash)

    const processingTimeMs = performance.now() - start

    logger.info({ requestId, processingTimeMs }, 'inngest_function.completed')

    return { hash, processingTimeMs }
  }
)

/** All Inngest functions for this application. */
export const inngestFunctions = [hashFunction]
