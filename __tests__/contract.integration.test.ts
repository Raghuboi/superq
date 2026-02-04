import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { OpenAPIHono } from '@hono/zod-openapi'
import { createTestApp, resetState } from './helpers/app.js'
import { assertErrResponse } from './helpers/assertions.js'
import { DELAY_MS, TEST_TIMEOUT_MS } from './helpers/constants.js'
import type { ErrorResponse } from './helpers/types.js'

describe('[Batch 1] Contract Integration', () => {
  let app: OpenAPIHono
  let shutdown: () => Promise<void>

  beforeEach(() => {
    resetState()
    const setup = createTestApp({ delayMs: DELAY_MS })
    app = setup.app
    shutdown = setup.shutdown
  })

  afterEach(async () => {
    await shutdown()
  })

  it('rejects invalid payloads with error envelope', { timeout: TEST_TIMEOUT_MS }, async () => {
    const response = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    assert.equal(response.status, 400)
    const body = (await response.json()) as ErrorResponse
    assertErrResponse(body)
    assert.equal(body.error?.code, 'BAD_REQUEST')
  })

  it('rejects empty text', { timeout: TEST_TIMEOUT_MS }, async () => {
    const response = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    })

    assert.equal(response.status, 400)
    const body = (await response.json()) as ErrorResponse
    assertErrResponse(body)
  })

  it('rejects text exceeding max length', { timeout: TEST_TIMEOUT_MS }, async () => {
    const response = await app.request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'x'.repeat(10_001) }),
    })

    assert.equal(response.status, 400)
    const body = (await response.json()) as ErrorResponse
    assertErrResponse(body)
  })
})
