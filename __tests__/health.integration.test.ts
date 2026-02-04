import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { createHealthController } from '../src/routes/health/health.controller.js'
import { createTestApp, resetState } from './helpers/app.js'
import { DELAY_MS, TEST_TIMEOUT_MS } from './helpers/constants.js'
import type { HealthResponse } from './helpers/types.js'

describe('[Batch 2] Health Integration', () => {
  let app: OpenAPIHono
  let shutdown: () => Promise<void>
  let service: ReturnType<typeof createTestApp>['service']

  beforeEach(() => {
    resetState()
    const setup = createTestApp({ delayMs: DELAY_MS })
    app = setup.app
    service = setup.service
    shutdown = setup.shutdown
    app.route('/health', createHealthController(service, Date.now()))
  })

  afterEach(async () => {
    await shutdown()
  })

  it(
    'returns queue and cache stats',
    { timeout: TEST_TIMEOUT_MS },
    async () => {
      await app.request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'health-check' }),
      })

      const response = await app.request('/health')
      assert.equal(response.status, 200)

      const body = (await response.json()) as HealthResponse
      assert.equal(body.success, true)
      assert.ok(body.data)

      // Status and uptime
      assert.equal(body.data.status, 'healthy')
      assert.ok(body.data.uptime >= 0)

      // Cache metrics
      assert.ok(typeof body.data.cache.hits === 'number')
      assert.ok(typeof body.data.cache.misses === 'number')
      assert.ok(typeof body.data.cache.size === 'number')
      assert.ok(body.data.cache.hits >= 0)
      assert.ok(body.data.cache.misses >= 0)
      assert.ok(body.data.cache.size >= 0)

      // Queue metrics
      assert.ok(typeof body.data.queue.pending === 'number')
      assert.ok(typeof body.data.queue.processing === 'number')
      assert.ok(typeof body.data.queue.completed === 'number')
      assert.ok(typeof body.data.queue.failed === 'number')
      assert.ok(typeof body.data.queue.coalesced === 'number')
      assert.ok(typeof body.data.queue.totalEnqueued === 'number')
      assert.ok(typeof body.data.queue.totalProcessed === 'number')
      assert.ok(body.data.queue.pending >= 0)
      assert.ok(body.data.queue.processing >= 0)
      assert.ok(body.data.queue.completed >= 0)
      assert.ok(body.data.queue.failed >= 0)
      assert.ok(body.data.queue.coalesced >= 0)
      assert.ok(body.data.queue.totalEnqueued >= 0)
      assert.ok(body.data.queue.totalProcessed >= 0)
    }
  )
})
