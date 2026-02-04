import { createHash } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import type { InngestFunction } from 'inngest'
import { getInngestClient } from '../../lib/queue/inngest-queue.js'
import { getCache } from '../../lib/cache/index.js'
import { env } from '../../lib/env.js'
import { logger } from '../../utils/logger.js'

type HashEventData = {
  text: string
  requestId: string
}

let _hashFunction: InngestFunction.Any | null = null

/**
 * Get or create the hash function.
 *
 * Lazily initializes the Inngest function to avoid errors
 * when INNGEST_EVENT_KEY is not set.
 */
function getHashFunction(): InngestFunction.Any {
  if (_hashFunction) return _hashFunction

  _hashFunction = getInngestClient().createFunction(
    {
      id: 'compute-hash',
      name: 'Compute SHA-256 Hash',
      concurrency: {
        limit: env.queueConcurrency,
      },
      retries: 3,
    },
    { event: 'superq/chat' },
    async ({ event, step: _step }) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const data = event.data as HashEventData
      const { text, requestId } = data
      const start = performance.now()

      logger.info({ requestId, text, delayMs: env.processingDelayMs }, 'inngest_function.started')

      // Simulate processing delay
      await setTimeout(env.processingDelayMs)

      // Compute hash
      const hash = createHash('sha256').update(text).digest('hex')

      // Store in cache
      const cache = getCache()
      await cache.set(text, hash)

      const processingTimeMs = performance.now() - start

      logger.info({ requestId, processingTimeMs, text, hash }, 'inngest_function.completed')

      return { hash, processingTimeMs }
    }
  )

  return _hashFunction
}

/**
 * Get all Inngest functions for this application.
 *
 * Lazily initializes functions to avoid errors when Inngest
 * environment variables are not configured.
 */
export function getInngestFunctions(): InngestFunction.Any[] {
  return [getHashFunction()]
}
