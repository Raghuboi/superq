import pino from 'pino'
import { env } from '../lib/env.js'

function getLoggerOptions(): pino.LoggerOptions {
  if (env.logLevel === 'silent') {
    return { level: 'silent' }
  }

  const base = { service: 'superq', env: env.nodeEnv }

  if (env.nodeEnv !== 'production') {
    return {
      level: env.logLevel,
      base,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'hostname,pid',
          levelFirst: true,
          singleLine: false,
        },
      },
    }
  }

  return { level: env.logLevel, base }
}

export const logger = pino(getLoggerOptions())
