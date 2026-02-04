import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'
import { QUEUE_DEFAULTS, CACHE_DEFAULTS, SERVER_DEFAULTS } from './constants.js'

/** Environment configuration validated with Zod. */
const parsedEnv = createEnv({
  server: {
    PORT: z.coerce.number().default(SERVER_DEFAULTS.PORT),
    HOST: z.string().default(SERVER_DEFAULTS.HOST),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .optional()
      .transform((val) => {
        if (val) return val
        const nodeEnv = process.env.NODE_ENV ?? 'development'
        if (nodeEnv === 'test') return 'silent'
        if (nodeEnv === 'production') return 'info'
        return 'debug'
      }),
    PROCESSING_DELAY_MS: z.coerce.number().default(SERVER_DEFAULTS.PROCESSING_DELAY_MS),
    CACHE_MAX_SIZE: z.coerce.number().default(CACHE_DEFAULTS.MAX_SIZE),
    CACHE_TYPE: z.enum(['memory', 'redis']).default('memory'),
    QUEUE_TYPE: z.enum(['memory', 'inngest']).default('memory'),
    REDIS_URL: z.string().optional(),
    INNGEST_EVENT_KEY: z.string().optional(),
    INNGEST_SIGNING_KEY: z.string().optional(),
    QUEUE_CONCURRENCY: z.coerce.number().min(1).default(QUEUE_DEFAULTS.CONCURRENCY),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

if (parsedEnv.CACHE_TYPE === 'redis' && !parsedEnv.REDIS_URL) {
  throw new Error('REDIS_URL is required when CACHE_TYPE=redis')
}

if (parsedEnv.QUEUE_TYPE === 'inngest') {
  if (!parsedEnv.INNGEST_EVENT_KEY || !parsedEnv.INNGEST_SIGNING_KEY) {
    throw new Error(
      'INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY are required when QUEUE_TYPE=inngest'
    )
  }
}

/** Validated environment configuration. */
export const env = {
  /** Server port (default: 3000) */
  port: parsedEnv.PORT,
  /** Server host (default: '0.0.0.0') */
  host: parsedEnv.HOST,
  /** Node environment: 'development' | 'production' | 'test' */
  nodeEnv: parsedEnv.NODE_ENV,
  /** Log level, auto-configured based on NODE_ENV if not set */
  logLevel: parsedEnv.LOG_LEVEL,
  /** Simulated processing delay in milliseconds (default: 10000) */
  processingDelayMs: parsedEnv.PROCESSING_DELAY_MS,
  /** Maximum cache entries (default: 1000) */
  cacheMaxSize: parsedEnv.CACHE_MAX_SIZE,
  /** Cache backend type: 'memory' | 'redis' */
  cacheType: parsedEnv.CACHE_TYPE,
  /** Queue backend type: 'memory' | 'inngest' */
  queueType: parsedEnv.QUEUE_TYPE,
  /** Redis connection URL (optional) */
  redisUrl: parsedEnv.REDIS_URL,
  /** Inngest event key for authentication (optional) */
  inngestEventKey: parsedEnv.INNGEST_EVENT_KEY,
  /** Inngest signing key for webhook verification (optional) */
  inngestSigningKey: parsedEnv.INNGEST_SIGNING_KEY,
  /** Maximum concurrent queue workers (default: 1) */
  queueConcurrency: parsedEnv.QUEUE_CONCURRENCY,
}

export type Env = typeof env
