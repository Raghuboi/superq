import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { createTestApp, resetState } from './helpers/app.js'
import { assertOkResponse } from './helpers/assertions.js'
import {
  DELAY_MS,
  CACHE_HIT_MS,
  TEST_TIMEOUT_MS,
  TIMER_TOLERANCE_MS,
  COALESCE_BATCH_SIZE,
  CHAT_CONCURRENCY,
} from './helpers/constants.js'
import type { ChatResponse } from './helpers/types.js'
import { logger } from '../src/utils/logger.js'

describe('[Batch 4] Chat Integration', () => {
  let app: OpenAPIHono
  let service: ReturnType<typeof createTestApp>['service']
  let shutdown: () => Promise<void>

  beforeEach(() => {
    resetState()
    const setup = createTestApp({ delayMs: DELAY_MS, concurrency: CHAT_CONCURRENCY })
    app = setup.app
    service = setup.service
    shutdown = setup.shutdown
  })

  afterEach(async () => {
    await shutdown()
  })

  it('returns a hash and caches subsequent requests', { timeout: TEST_TIMEOUT_MS }, async () => {
    const text = 'cache-test'

    logger.debug({ text }, 'test.cache.miss')
    const response = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    assert.equal(response.status, 200)
    const first = (await response.json()) as ChatResponse

    logger.debug({ text }, 'test.cache.hit')
    const cachedResponse = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    const cached = (await cachedResponse.json()) as ChatResponse
    assertOkResponse(first)
    assertOkResponse(cached)
    assert.equal(first.data?.fromCache, false)
    assert.equal(cached.data?.fromCache, true)
    assert.equal(first.data?.hash, cached.data?.hash)
    assert.ok(first.data?.processingTimeMs && first.data.processingTimeMs >= DELAY_MS)
    assert.ok(
      cached.data?.processingTimeMs !== undefined && cached.data.processingTimeMs <= CACHE_HIT_MS
    )
  })

  it('coalesces concurrent requests for the same text', { timeout: TEST_TIMEOUT_MS }, async () => {
    const text = 'coalesce-test'
    const expectedHash = createHash('sha256').update(text).digest('hex')

    logger.debug({ text, batchSize: COALESCE_BATCH_SIZE }, 'test.coalesce.start')
    const requests: Promise<Response>[] = Array.from({ length: COALESCE_BATCH_SIZE }, () =>
      Promise.resolve(
        app.request('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
      )
    )

    const responses = await Promise.all(requests)
    const bodies = (await Promise.all(responses.map((res) => res.json()))) as ChatResponse[]
    logger.debug({ text }, 'test.coalesce.complete')

    assert.ok(bodies.every((body) => body.data?.hash === expectedHash))
    const processingTimes = bodies.map((body) => body.data?.processingTimeMs ?? 0)
    const maxProcessingTime = Math.max(...processingTimes)
    assert.ok(maxProcessingTime >= DELAY_MS - TIMER_TOLERANCE_MS)
    assert.equal(service.stats.totalEnqueued, 1)
    assert.equal(service.stats.coalesced, COALESCE_BATCH_SIZE - 1)
  })

  it('processes multiple unique texts concurrently', { timeout: TEST_TIMEOUT_MS }, async () => {
    const texts = ['alpha', 'beta', 'gamma']
    logger.debug({ count: texts.length }, 'test.unique.start')
    const requests: Promise<Response>[] = texts.map((text) =>
      Promise.resolve(
        app.request('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
      )
    )

    const responses = await Promise.all(requests)
    const bodies = (await Promise.all(responses.map((res) => res.json()))) as ChatResponse[]
    logger.debug({ count: texts.length }, 'test.unique.complete')

    const hashes = bodies.map((body, index) => {
      const expected = createHash('sha256')
        .update(texts[index] ?? '')
        .digest('hex')
      return body.data?.hash === expected
    })

    assert.ok(hashes.every(Boolean))
    // Allow tolerance for timer imprecision under concurrent load
    assert.ok(
      bodies.every((body) => (body.data?.processingTimeMs ?? 0) >= DELAY_MS - TIMER_TOLERANCE_MS)
    )
    assert.equal(service.stats.totalEnqueued, texts.length)
  })
})
