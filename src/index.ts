import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { env } from './lib/env.js'
import { logger } from './utils/logger.js'
import { API_METADATA } from './lib/constants.js'

const { app, shutdown } = createApp()

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutdown.start')
  await shutdown()
  logger.info({ signal }, 'shutdown.complete')
  process.exit(0)
}

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT')
})
process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM')
})

serve({ fetch: app.fetch, port: env.port, hostname: env.host }, (info) => {
  logger.info(
    {
      port: info.port,
      host: env.host,
      nodeEnv: env.nodeEnv,
      docs: `http://${env.host}:${String(info.port)}${API_METADATA.DOCS_PATH}`,
      openapi: `http://${env.host}:${String(info.port)}${API_METADATA.OPENAPI_PATH}`,
      cache: {
        type: env.cacheType,
        maxSize: env.cacheMaxSize,
      },

      queue: {
        type: env.queueType,
        concurrency: env.queueConcurrency,
        delayMs: env.processingDelayMs,
      },
    },
    'server.started'
  )
})
