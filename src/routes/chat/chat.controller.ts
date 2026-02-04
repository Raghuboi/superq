import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import type { ChatService } from './chat.service.js'
import { VALIDATION } from '../../lib/constants.js'
import { err, ok } from '../../utils/response.js'

/**
 * Create the chat controller with POST /chat endpoint.
 *
 * @param service - The chat service for processing messages.
 * @returns Configured Hono router with OpenAPI documentation.
 */
export function createChatController(service: ChatService): OpenAPIHono {
  const app = new OpenAPIHono()

  const ChatRequestSchema = z
    .object({
      text: z
        .string()
        .min(VALIDATION.TEXT_MIN_LENGTH)
        .max(VALIDATION.TEXT_MAX_LENGTH)
        .openapi({ example: 'hello world' }),
    })
    .openapi('ChatRequest')

  const ChatResponseSchema = z
    .object({
      success: z.literal(true),
      data: z.object({
        id: z.uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
        text: z.string().openapi({ example: 'hello world' }),
        hash: z
          .string()
          .openapi({ example: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9' }),
        processingTimeMs: z.number().openapi({ example: 10023.5 }),
        fromCache: z.boolean().openapi({ example: false }),
      }),
    })
    .openapi('ChatResponse')

  const ErrorSchema = z
    .object({
      success: z.literal(false),
      error: z.object({
        code: z.string(),
        message: z.string(),
      }),
    })
    .openapi('ErrorResponse')

  const chatRoute = createRoute({
    method: 'post',
    path: '/',
    tags: ['Chat'],
    summary: 'Process message and compute SHA-256 hash',
    description: 'Processes a message, computing SHA-256 hash with caching and request coalescing',
    request: {
      body: { content: { 'application/json': { schema: ChatRequestSchema } }, required: true },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: ChatResponseSchema } },
        description: 'Message processed',
      },
      400: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Invalid request',
      },
      500: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Server error',
      },
    },
  })

  app.openapi(
    chatRoute,
    async (c) => {
      const { text } = c.req.valid('json')
      const result = await service.processMessage(text)

      return c.json(
        ok({
          id: result.id,
          text,
          hash: result.hash,
          processingTimeMs: result.processingTimeMs,
          fromCache: result.fromCache,
        }),
        200
      )
    },
    (result, c) => {
      if (!result.success) {
        throw new HTTPException(400, {
          res: c.json(err({ code: 'BAD_REQUEST', message: 'Invalid request body' }), 400),
        })
      }

      return undefined
    }
  )

  return app
}
