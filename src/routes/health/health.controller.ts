import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { ChatService } from '../chat/chat.service.js'
import { ok } from '../../utils/response.js'

/**
 * Create the health controller with GET /health endpoint.
 *
 * @param service - The chat service for queue/cache statistics.
 * @param startTime - Application start timestamp for uptime calculation.
 * @returns Configured Hono router with OpenAPI documentation.
 */
export function createHealthController(service: ChatService, startTime: number): OpenAPIHono {
  const app = new OpenAPIHono()

  const HealthResponseSchema = z
    .object({
      success: z.literal(true),
      data: z.object({
        status: z.enum(['healthy', 'degraded', 'unhealthy']),
        uptime: z.number(),
        cache: z.object({ hits: z.number(), misses: z.number(), size: z.number() }),
        queue: z.object({
          pending: z.number(),
          processing: z.number(),
          completed: z.number(),
          failed: z.number(),
          coalesced: z.number(),
          totalEnqueued: z.number(),
          totalProcessed: z.number(),
        }),
      }),
    })
    .openapi('HealthResponse')

  const healthRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Health'],
    summary: 'Health check',
    responses: {
      200: {
        content: { 'application/json': { schema: HealthResponseSchema } },
        description: 'OK',
      },
    },
  })

  app.openapi(healthRoute, (c) => {
    return c.json(
      ok({
        status: 'healthy' as const,
        uptime: Date.now() - startTime,
        cache: service.cacheStats,
        queue: service.stats,
      }),
      200
    )
  })

  return app
}
