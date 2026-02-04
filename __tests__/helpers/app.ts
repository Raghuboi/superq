import { OpenAPIHono } from '@hono/zod-openapi'
import { ChatService } from '../../src/routes/chat/chat.service.js'
import { resetCache, clearCache } from '../../src/lib/cache/index.js'
import { clearAllQueues } from '../../src/lib/queue/index.js'
import { createChatController } from '../../src/routes/chat/chat.controller.js'

/**
 * Reset all shared state (cache and queues) for clean tests.
 */
export function resetState(): void {
  resetCache()
  clearAllQueues()
}

/**
 * Clean up resources after tests.
 */
export async function cleanupState(): Promise<void> {
  await clearCache()
}

/**
 * Create a test app with ChatService.
 *
 * @param options - Optional ChatService configuration
 * @returns OpenAPIHono instance with ChatController attached
 *
 * @example
 * ```ts
 * const { app } = createTestApp({ delayMs: 10000 })
 * const response = await app.request('/chat', { method: 'POST', body: JSON.stringify({ text: 'hi' }) })
 * ```
 */
export function createTestApp(options?: { delayMs?: number; concurrency?: number }): {
  readonly app: OpenAPIHono
  readonly service: ChatService
  readonly shutdown: () => Promise<void>
} {
  const service = new ChatService(options)
  const chatController = createChatController(service)

  const app = new OpenAPIHono()
  app.route('/chat', chatController)

  const shutdown = async (): Promise<void> => {
    await service.shutdown()
    await cleanupState()
  }

  return { app, service, shutdown }
}
