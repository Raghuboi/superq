# SuperQ

Queue-based SHA-256 hash service with caching and request coalescing.

## Quick Start

```bash
npm install && npm run dev
```

## Test Suite

### Summary

```
tests 8 | suites 4 | pass 8 | fail 0
duration_ms 30266.689714
```

### Coverage

| Metric | Coverage |
|--------|----------|
| Line | 94.49% |
| Branch | 81.45% |
| Functions | 78.95% |

### Test Batches

| Suite | Tests | Duration |
|-------|-------|----------|
| Chat Integration | 3 | 30031ms |
| Contract Integration | 3 | 25ms |
| Health Integration | 1 | 10026ms |
| Stress Integration | 1 | 10032ms |

### Running Tests

```bash
npm test                    # Run all tests with coverage
npm run test:watch          # Watch mode (if configured)
```

## API Endpoints

### POST /chat

Process a message and compute SHA-256 hash with caching and request coalescing.

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "text": "hello world",
    "hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    "processingTimeMs": 10023.5,
    "fromCache": false
  }
}
```

### GET /health

Service health and statistics.

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 12345,
    "queue": {
      "pending": 0,
      "processing": 0,
      "completed": 42,
      "failed": 0,
      "coalesced": 15,
      "totalEnqueued": 42,
      "totalProcessed": 42
    },
    "cache": {
      "hits": 30,
      "misses": 12,
      "size": 12
    }
  }
}
```

### GET /docs

Swagger UI documentation.

## Architecture

### Request Flow

```
Client → Controller → Service → Repository → Queue → Cache
```

### Module Structure

```
src/
  lib/
    cache/
      memory-cache.ts   # LRU implementation (default)
      redis-cache.ts    # Redis adapter (opt-in)
      registry.ts       # getCache(), resetCache(), clearCache()
      types.ts          # CacheAdapter interface

    queue/
      memory-queue.ts   # In-memory queue with coalescing (default)
      inngest-queue.ts  # Inngest adapter (opt-in)
      registry.ts       # getQueue(), drainAllQueues(), clearAllQueues()
      types.ts          # QueueAdapter interface

    env.ts              # Environment configuration
    constants.ts        # Default values

  routes/
    chat/
      chat.controller.ts  # HTTP request/response handling
      chat.service.ts     # Business logic orchestration
      chat.repository.ts  # Data access (cache + queue)
    health/
      health.controller.ts
```

### Layer Responsibilities

**Controller** - HTTP handling, Zod validation, envelope responses
**Service** - Business logic, request IDs, cache vs queue routing
**Repository** - Data access, cache-aside pattern, SHA-256 computation

## Registry System

### Design Pattern: Singleton + Factory

Both registries follow the same pattern:
1. **Lazy initialization** - Adapters created on first access
2. **Environment-based selection** - `CACHE_TYPE` and `QUEUE_TYPE` env vars
3. **Test reset capability** - Clear instances between test runs

### Cache Registry (Singleton)

```typescript
import { getCache, resetCache, clearCache } from './lib/cache'

// Get or create the cache instance
const cache = getCache()

// Optional: pass config for memory cache
const cache = getCache({ maxSize: 500 })

// Clear all cached data (preserves instance)
await clearCache()

// Reset instance (for tests)
resetCache()
```

**Internals:**

```typescript
let instance: CacheAdapter | null = null

export function getCache(options?: CacheConfig): CacheAdapter {
  if (instance) return instance

  switch (env.cacheType) {
    case 'redis':
      instance = new RedisCache(env.redisUrl ?? '')
      break
    default:
      instance = new MemoryCache(options?.maxSize ?? env.cacheMaxSize)
  }
  return instance
}
```

### Queue Registry (Named Instances)

```typescript
import { getQueue, drainAllQueues, clearAllQueues } from './lib/queue'

// Get or create a named queue
const hashQueue = getQueue('hash', {
  processor: async (text) => computeHash(text),
  concurrency: 2
})

// Wait for all queues to finish processing
await drainAllQueues()

// Clear all queue instances (for tests)
clearAllQueues()
```

**Internals:**

```typescript
const instances = new Map<string, QueueAdapter<unknown, unknown>>()

export function getQueue<T, R>(name: string, config: QueueConfig<T, R>): QueueAdapter<T, R> {
  const existing = instances.get(name)
  if (existing) return existing as QueueAdapter<T, R>

  const queue = env.queueType === 'inngest'
    ? new InngestQueue(name, config)
    : new MemoryQueue({ ...config, concurrency: config.concurrency ?? env.queueConcurrency })

  instances.set(name, queue)
  return queue
}
```

### Adding New Adapters

**Step 1:** Implement the interface

```typescript
// src/lib/cache/my-cache.ts
export class MyCacheAdapter implements CacheAdapter {
  async get(key: string): Promise<string | null> { /* ... */ }
  async set(key: string, value: string): Promise<void> { /* ... */ }
  async clear(): Promise<void> { /* ... */ }
  get stats(): CacheStats { /* ... */ }
}
```

**Step 2:** Add to env schema

```typescript
// src/lib/env.ts
cacheType: z.enum(['memory', 'redis', 'my-cache']).default('memory')
```

**Step 3:** Add to registry switch

```typescript
// src/lib/cache/registry.ts
case 'my-cache':
  instance = new MyCacheAdapter(config)
  break
```

## Concurrency Model

### Request Coalescing

When multiple clients request the same computation simultaneously:
- First request creates a work item and starts processing
- Subsequent identical requests attach to the existing item's promise
- All callers receive the same result from a single computation

Result: 100 concurrent identical requests → 1 computation, 99 coalesced

### Semaphore-Style Concurrency Control

The `processing` Map limits concurrent workers:
```typescript
if (this.processing.size >= this.concurrency) return
```

### Node.js Event Loop Safety

Operations between `await` points are atomic—no mutex needed for Map operations.

## Cache Strategy

**LRU (Least Recently Used)** cache with bounded memory:
- O(1) lookup using JavaScript Map's insertion-order guarantee
- Evicts oldest/least-recently-accessed when full
- No TTL needed—SHA-256 results are immutable

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| HOST | 0.0.0.0 | Server host |
| NODE_ENV | development | Environment |
| LOG_LEVEL | (env-based) | Logging level |
| PROCESSING_DELAY_MS | 10000 | Simulated processing delay |
| CACHE_MAX_SIZE | 1000 | Maximum cache entries |
| CACHE_TYPE | memory | Cache backend (memory, redis) |
| QUEUE_TYPE | memory | Queue backend (memory, inngest) |
| QUEUE_CONCURRENCY | 1 | Concurrent queue workers |
| REDIS_URL | - | Redis connection URL |
| INNGEST_EVENT_KEY | - | Inngest event key |
| INNGEST_SIGNING_KEY | - | Inngest signing key |

**Log Level Defaults:** development=debug, production=info, test=silent

## Docker

### Services

| Service | Description |
|---------|-------------|
| `app` | Node.js API server |
| `redis` | Redis server (optional cache backend) |
| `inngest` | Inngest dev server (optional queue backend) |

### Quick Start

```bash
npm run docker:up       # Start services
npm run docker:watch    # Development with hot reload
npm run docker:down     # Stop services
```

### Watch Mode

Development with live reloading:

```bash
docker compose up --build --watch
```

Watch configuration:
- `develop.watch` syncs `src/` and `__tests__/` into the container
- Changes to `package.json`, `package-lock.json`, or `Dockerfile` trigger rebuilds
- `node_modules/` and `dist/` are ignored to avoid cross-platform conflicts

### Runtime Overrides

Enable Redis cache:

```bash
CACHE_TYPE=redis \
REDIS_URL=redis://:password@redis:6379 \
docker compose up --build
```

Enable Inngest queue:

```bash
QUEUE_TYPE=inngest \
INNGEST_EVENT_KEY=your-event-key \
INNGEST_SIGNING_KEY=your-signing-key \
docker compose up --build
```

### Verification

**Memory mode (default):**

```bash
npm run docker:up
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"docker-test"}'
curl http://localhost:3000/health
npm run docker:down
```

**Redis mode:**

```bash
CACHE_TYPE=redis REDIS_URL=redis://:stub-redis-password@redis:6379 \
  docker compose up --build -d

curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"redis-test"}'

# Verify Redis key was created
docker exec superq-redis-1 redis-cli -a stub-redis-password KEYS '*'

docker compose down
```

## Example Requests

### Cache Miss (First Request)

```bash
curl -w "\nTime: %{time_total}s\n" -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world"}'
# Response after ~10s: {"fromCache":false, "processingTimeMs":10023}
```

### Cache Hit (Repeat Request)

```bash
curl -w "\nTime: %{time_total}s\n" -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world"}'
# Response immediately: {"fromCache":true, "processingTimeMs":0.1}
```

### Request Coalescing

```bash
# Fire 10 concurrent requests for same text
for i in {1..10}; do
  curl -s -X POST http://localhost:3000/chat \
    -H "Content-Type: application/json" \
    -d '{"text":"coalesce-test"}' &
done
wait
# All 10 complete in ~10s (not 100s)
# Queue stats: coalesced: 9, totalEnqueued: 1
```

## Logging

| Event | Log Message | Level |
|-------|-------------|-------|
| Startup | `app.startup` | info |
| Queue enqueue | `queue.enqueue` | info |
| Queue dequeue | `queue.dequeue` | info |
| Queue coalesced | `queue.coalesced` | info |
| Queue failed | `queue.failed` | error |
| Cache hit | `cache.hit` | info |
| Cache miss | `cache.miss` | info |
| Processing complete | `processing.complete` | info |

## Scripts

```bash
npm run dev           # Development with hot reload
npm run build         # TypeScript compilation
npm run start         # Production server
npm run test          # Run tests with coverage
npm run docker:up     # Docker (app + redis + inngest)
npm run docker:watch  # Docker watch mode
npm run docker:down   # Stop Docker
```
