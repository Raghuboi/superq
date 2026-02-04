export const QUEUE_DEFAULTS = {
  CONCURRENCY: 1,
  DRAIN_POLL_MS: 50,
} as const

export const CACHE_DEFAULTS = {
  MAX_SIZE: 1000,
} as const

export const SERVER_DEFAULTS = {
  PORT: 3000,
  HOST: '0.0.0.0',
  PROCESSING_DELAY_MS: 10_000,
} as const

export const VALIDATION = {
  TEXT_MAX_LENGTH: 10_000,
  TEXT_MIN_LENGTH: 1,
} as const

export const API_METADATA = {
  TITLE: 'SuperQ',
  VERSION: '1.0.0',
  DESCRIPTION: 'Queue-based SHA-256 hash service with caching and request coalescing',
  OPENAPI_VERSION: '3.1.0',
  DOCS_PATH: '/docs',
  OPENAPI_PATH: '/openapi.json',
} as const
