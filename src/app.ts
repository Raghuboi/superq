import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { logger as honoLogger } from 'hono/logger'
import { ChatService } from './routes/chat/chat.service.js'
import { createChatController } from './routes/chat/chat.controller.js'
import { createHealthController } from './routes/health/health.controller.js'
import { clearCache } from './lib/cache/index.js'
import { drainAllQueues } from './lib/queue/index.js'
import { API_METADATA } from './lib/constants.js'
import { env } from './lib/env.js'
import { logger } from './utils/logger.js'
import { createInngestHandler } from './routes/inngest/index.js'

/**
 * Create the application instance with all routes and middleware.
 *
 * @returns The Hono app and a shutdown function for graceful cleanup.
 */
export function createApp(): { app: OpenAPIHono; shutdown: () => Promise<void> } {
  const app = new OpenAPIHono()
  const startTime = Date.now()

  const chatService = new ChatService()

  logger.info(
    {
      port: env.port,
      host: env.host,
      nodeEnv: env.nodeEnv,
      processingDelayMs: env.processingDelayMs,
      queueConcurrency: env.queueConcurrency,
      cacheType: env.cacheType,
      queueType: env.queueType,
    },
    'app.startup'
  )

  app.use(honoLogger())

  app.get('/', (c) => c.redirect('/docs'))

  app.route('/chat', createChatController(chatService))
  app.route('/health', createHealthController(chatService, startTime))

  // Inngest webhook handler (only registered when QUEUE_TYPE=inngest)
  if (env.queueType === 'inngest') {
    const inngestHandler = createInngestHandler()
    app.on(['GET', 'POST', 'PUT'], '/api/inngest', (c) => inngestHandler(c))
    logger.info('inngest.route_registered')
  }

  app.doc(API_METADATA.OPENAPI_PATH, {
    openapi: API_METADATA.OPENAPI_VERSION,
    info: {
      title: API_METADATA.TITLE,
      version: API_METADATA.VERSION,
      description: API_METADATA.DESCRIPTION,
    },
  })
  app.get(API_METADATA.DOCS_PATH, swaggerUI({ url: API_METADATA.OPENAPI_PATH }))

  const shutdown = async (): Promise<void> => {
    await drainAllQueues()
    await clearCache()
  }

  return { app, shutdown }
}
