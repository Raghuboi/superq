# SuperQ

**Full Stack Backend Assessment: Queue + Cache Service**

A backend service that:
1. Processes text requests through a **queue**
2. Computes **SHA-256 hashes** with a simulated **10-second delay**
3. Caches results in an **LRU cache** for instant repeat responses
4. Handles **concurrent clients** via request coalescing (100 requests → 1 computation)

| Requirement | Implementation |
|-------------|----------------|
| Queue for processing | `MemoryQueue` (FIFO, 198 lines) |
| Cache for repeats | `MemoryCache` (LRU, 74 lines) |
| SHA-256 + 10s delay | `node:crypto` + `node:timers/promises` |
| Concurrent handling | Request coalescing via Map deduplication |
| Extensibility | Registry pattern for Redis/Inngest swap |

See [`screenshots/`](screenshots/) for visual verification.

## Quick Start

```bash
npm install && npm run dev
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

Swagger UI documentation (also accessible via `/`).

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

## Caching Policies

### Available Policies

| Policy | Description | Fit for This Service |
|--------|-------------|---------------------|
| **LRU** | Evicts least recently used | ✅ Chosen |
| LFU | Evicts least frequently used | Complex tracking |
| FIFO | Evicts oldest items | Ignores access patterns |
| TTL | Expires after time | Not needed (immutable) |

### Why LRU?

1. **Spec alignment**: "Serve repeat requests instantly" → O(1) Map lookup
2. **Immutability**: SHA-256 is deterministic—`hash("hello")` always equals `hash("hello")`
3. **No TTL needed**: Data never goes stale
4. **Bounded memory**: Controlled via `CACHE_MAX_SIZE`

### Native Map Implementation

LRU uses JavaScript's `Map` insertion-order guarantee:

```typescript
// O(1) LRU via delete + re-insert
this.data.delete(key)     // Remove from current position
this.data.set(key, entry) // Re-insert at end (most recent)
```

### Redis Extensibility

```bash
# Enable via environment
CACHE_TYPE=redis REDIS_URL=redis://... npm run dev
```

**Docker Verification:**

```bash
CACHE_TYPE=redis REDIS_URL=redis://:stub-redis-password@redis:6379 \
  docker compose up --build -d

curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"redis-test"}'

docker exec superq-redis-1 redis-cli -a stub-redis-password KEYS '*'
docker compose down
```

## Queue System

### Current Implementation

Map-based in-memory queue (198 lines):

| Feature | Implementation |
|---------|----------------|
| FIFO ordering | `queue.shift()` |
| Concurrency control | `processing.size >= concurrency` |
| Request coalescing | `coalescing.get(key)` |

### Competitors Comparison

| Criteria | fastq | BullMQ | Inngest |
|----------|-------|--------|---------|
| Type | In-memory | Redis-based | Postgres + Redis |
| Performance | 866K ops/sec | High throughput | Optimized for reliability |
| Persistence | ❌ | ✅ Redis | ✅ Postgres |
| Deduplication | Manual | At-least-once | Exactly-once |
| TypeScript | ✅ | ✅ | First-class |
| Concurrency keys | ❌ | Global | Per-key limits |
| Setup | Zero deps | Redis required | Higher (Postgres) |

### Why Inngest for Production

- **Per-key concurrency limits** for multi-tenant scenarios
- **Exactly-once semantics** via event ID deduplication
- **Durable execution** with automatic retries
- **Full TypeScript SDK** with type inference

**Docker Verification:**

```bash
QUEUE_TYPE=inngest INNGEST_EVENT_KEY=key INNGEST_SIGNING_KEY=key \
  docker compose up --build
# Inngest dev server: http://localhost:8288
```

## Concurrency & Invalidation

### Node.js Event Loop Model

Operations between `await` points are atomic—no mutex needed:

```typescript
// SAFE in Node.js (single-threaded):
const cached = await cache.get(key)  // Atomic lookup
if (cached) return cached            // No interleaving
```

### Three Categories (HelloInterview Framework)

| Category | Problem | Our Solution |
|----------|---------|--------------|
| Correctness | Check-then-act races | Single-threaded event loop |
| Coordination | Work flowing between threads | Request coalescing |
| Scarcity | Limited resource access | Semaphore-style `processing.size` |

### Request Coalescing (Thundering Herd Prevention)

```typescript
if (coalesceKey) {
  const existing = this.coalescing.get(coalesceKey)
  if (existing) {
    // Attach to existing promise instead of new work
    return new Promise((resolve) => {
      existing.resolve = chainResolvers(existing.resolve, resolve)
    })
  }
}
```

Result: 100 concurrent identical requests → 1 computation, 99 coalesced

### Comparison with Multi-threaded Languages

| Concern | Node.js | Java/Go |
|---------|---------|---------|
| Shared state | Atomic between awaits | Requires mutex |
| Race conditions | Only async gaps | Any concurrent access |
| Cache consistency | Map ops atomic | ConcurrentHashMap |
| Deadlock risk | None | Lock ordering issues |

### Trade-offs

| Aspect | Node.js Advantage | Limitation |
|--------|-------------------|------------|
| Simplicity | No sync primitives | Single CPU |
| Correctness | Easy to reason | Blocking freezes all |
| Scaling | Horizontal (multi-process) | Not vertical |

## Registry System

### Design Pattern: Singleton + Factory

1. **Lazy initialization** on first access
2. **Environment-based** adapter selection
3. **Test reset capability** for isolation

### Cache Registry (74 lines total)

```typescript
// src/lib/cache/registry.ts
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

### Queue Registry (198 lines total)

```typescript
// src/lib/queue/registry.ts
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
