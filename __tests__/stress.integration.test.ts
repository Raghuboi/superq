import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { createTestApp, resetState } from './helpers/app.js'
import { assertOkResponse } from './helpers/assertions.js'
import {
  DELAY_MS,
  TEST_TIMEOUT_MS,
  STRESS_BATCH_SIZE,
  STRESS_CONCURRENCY,
} from './helpers/constants.js'
import type { ChatResponse } from './helpers/types.js'
import { logger } from '../src/utils/logger.js'

const sendChat = async (app: OpenAPIHono, text: string): Promise<unknown> => {
  const response = await app.request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return response.json()
}

describe('[Batch 3] Stress Integration', () => {
  let app: OpenAPIHono
  let service: ReturnType<typeof createTestApp>['service']
  let shutdown: () => Promise<void>

  beforeEach(() => {
    resetState()
    const setup = createTestApp({ delayMs: DELAY_MS, concurrency: STRESS_CONCURRENCY })
    app = setup.app
    service = setup.service
    shutdown = setup.shutdown
  })

  afterEach(async () => {
    await shutdown()
  })

  it(
    'coalesces a large batch of identical inputs',
    { timeout: TEST_TIMEOUT_MS },
    async () => {
      const text = 'stress-coalesce'

      logger.debug({ batchSize: STRESS_BATCH_SIZE, text }, 'test.coalesce.start')
      const responses = await Promise.all(
        Array.from({ length: STRESS_BATCH_SIZE }, () => sendChat(app, text))
      )
      logger.debug({ batchSize: STRESS_BATCH_SIZE, text }, 'test.coalesce.complete')

      const expectedHash = createHash('sha256').update(text).digest('hex')
      responses.forEach((body) => {
        const response = body as ChatResponse
        assertOkResponse(response)
        assert.equal(response.data?.hash, expectedHash)
        assert.ok(response.data?.processingTimeMs && response.data.processingTimeMs >= DELAY_MS)
      })

      assert.equal(service.stats.totalEnqueued, 1)
      assert.equal(service.stats.coalesced, STRESS_BATCH_SIZE - 1)
    }
  )
})
