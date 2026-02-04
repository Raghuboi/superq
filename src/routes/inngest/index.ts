import { serve } from 'inngest/hono'
import { getInngestClient } from '../../lib/queue/inngest-queue.js'
import { getInngestFunctions } from './functions.js'

/**
 * Inngest HTTP handler for Hono.
 *
 * This handler serves the Inngest webhook endpoint at /api/inngest.
 * It receives events from the Inngest platform and executes the
 * registered functions.
 */
export function createInngestHandler(): ReturnType<typeof serve> {
  return serve({
    client: getInngestClient(),
    functions: getInngestFunctions(),
  })
}
