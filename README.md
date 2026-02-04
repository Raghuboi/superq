# SuperQ

A queue-based hash computation service with LRU caching and request coalescing.

Author: **Raghunath Prabhakar**

---

## Prerequisites

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | >= 25.0.0 | [nodejs.org](https://nodejs.org/) or see below |
| npm | >= 10.0.0 | Included with Node.js |
| Docker | >= 27.0.0 | [docker.com](https://www.docker.com/get-started/) (optional) |
| Docker Compose | >= 2.30.0 | Included with Docker Desktop |

### Platform-Specific Installation

**macOS**
```bash
brew install node@25
# or use nvm: nvm install 25
brew install --cask docker
```

**Linux (Ubuntu/Debian)**
```bash
curl -fsSL https://deb.nodesource.com/setup_25.x | sudo -E bash -
sudo apt-get install -y nodejs
# Docker: https://docs.docker.com/engine/install/ubuntu/
```

**Windows**
```powershell
# Using winget
winget install OpenJS.NodeJS
# Docker Desktop: https://docs.docker.com/desktop/install/windows-install/
```

> **Note**: This project uses the [Node.js native test runner](https://nodejs.org/api/test.html) (`node --test`), available in Node.js 20+.

---

## Quick Start

```bash
npm install && npm run dev
# Open http://localhost:3000/docs
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm test` | Run tests with coverage |
| `npm run docker:up` | Start Docker services |
| `npm run docker:watch` | Docker with hot reload |
| `npm run docker:down` | Stop Docker services |
| `npm run docker:logs` | Follow app container logs |
| `npm run docker:health` | Check service health status |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run typecheck` | Run TypeScript type checking |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Redirects to Swagger UI |
| `/docs` | GET | Swagger UI documentation |
| `/chat` | POST | Process text -> SHA-256 hash |
| `/health` | GET | Service health & statistics |

---

## Features

| Feature | Description |
|---------|-------------|
| Queue Processing | FIFO queue with configurable concurrency |
| LRU Caching | O(1) cache lookups with bounded memory |
| Request Coalescing | Thundering herd prevention (100 requests -> 1 computation) |
| SHA-256 Hashing | Deterministic hash with configurable delay |
| Structured Logging | Pino-based JSON logs |
| Swagger UI | Interactive API docs at `/docs` |
| Docker Support | Containerized with Redis and Inngest |

---

## Extensibility

The service uses a registry pattern for swappable backends:

| Adapter | Description |
|---------|-------------|
| **Redis Cache** | Distributed caching for horizontal scaling |
| **Inngest Queue** | Durable execution with exactly-once delivery |

### Adding Custom Adapters

1. Implement `CacheAdapter` or `QueueAdapter` interface
2. Register in `src/lib/cache/registry.ts` or `src/lib/queue/registry.ts`
3. Add type to env schema: `z.enum(['memory', 'redis', 'your-adapter'])`

See `src/lib/cache/redis-cache.ts` for reference implementation.

---

## Example Requests

### Cache Miss (First Request)

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world"}'
# Response after ~10s: {"fromCache": false, "processingTimeMs": 10023}
```

### Cache Hit (Repeat Request)

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world"}'
# Response immediately: {"fromCache": true, "processingTimeMs": 0.1}
```

### Request Coalescing

```bash
for i in {1..10}; do
  curl -s -X POST http://localhost:3000/chat \
    -H "Content-Type: application/json" \
    -d '{"text":"coalesce-test"}' &
done
wait
# All 10 complete in ~10s (not 100s) - only 1 computation
```

---

## Architecture

### Request Flow

```
Cache Hit:  Client → Service → Cache → Response (instant)
Cache Miss: Client → Service → Cache (miss) → Queue → Processor → Cache → Response
```

### Module Structure

```
src/
  lib/
    cache/          # LRU cache + Redis adapter
    queue/          # Memory queue + Inngest adapter
    env.ts          # Environment configuration
  routes/
    chat/           # POST /chat endpoint
    health/         # GET /health endpoint
  app.ts            # Hono application setup
```

### Layer Responsibilities

- **Controller** - HTTP handling, Zod validation, response envelopes
- **Service** - Business logic, request IDs, cache vs queue routing
- **Repository** - Data access, cache-aside pattern, SHA-256 computation

---

## Caching Strategy

### Why LRU?

| Reason | Explanation |
|--------|-------------|
| Immutability | SHA-256 is deterministic |
| No TTL needed | Hash results never go stale |
| Bounded memory | `CACHE_MAX_SIZE` limit |

### LRU Implementation

```typescript
// O(1) via JavaScript Map insertion-order guarantee
this.data.delete(key)      // Remove from current position
this.data.set(key, entry)  // Re-insert at end (most recent)
```

---

## Concurrency Model

### Node.js Event Loop

Operations between `await` points are atomic—no mutex needed:

```typescript
const cached = await cache.get(key)  // Atomic lookup
if (cached) return cached            // No interleaving possible
```

> **Event Loop Atomicity**: Node.js runs on a single-threaded event loop. Operations between `await` points execute atomically—similar to holding a lock, but without explicit synchronization. This prevents race conditions in the cache check-then-update flow.

### Request Coalescing

Request coalescing (also called "single-flight") prevents the **thundering herd** problem. When 100 concurrent clients request the same uncached value, only the first triggers computation—the other 99 attach to the in-flight promise.

When multiple clients request the same computation:
1. First request creates work item and starts processing
2. Subsequent identical requests attach to existing promise
3. All callers receive same result from single computation

Result: 100 concurrent identical requests -> 1 computation, 99 coalesced

---

## Extensibility Examples

### Redis Cache (Docker)

Enable Redis cache for distributed caching across multiple instances:

```bash
# Start with Redis cache enabled
CACHE_TYPE=redis docker compose up --build -d

# Test it works
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"redis-test"}'

# Verify key stored in Redis
docker exec redis redis-cli -a superq-redis-password KEYS '*'
```

### Inngest Queue (Docker)

Enable Inngest for durable execution with exactly-once semantics:

```bash
# Start with Inngest queue enabled
QUEUE_TYPE=inngest docker compose up --build

# Inngest Dev Server: http://localhost:8288
# View events, functions, and run history in the dashboard
```

### Full Production Setup (Redis + Inngest)

```bash
# Enable both Redis cache and Inngest queue
CACHE_TYPE=redis QUEUE_TYPE=inngest docker compose up --build -d
```

### Adding New Adapters (3 Steps)

1. Implement the interface (`CacheAdapter` or `QueueAdapter`)
2. Add to env schema: `z.enum(['memory', 'redis', 'new-adapter'])`
3. Add to registry switch statement

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| HOST | 0.0.0.0 | Server host |
| PROCESSING_DELAY_MS | 10000 | Simulated delay |
| CACHE_MAX_SIZE | 1000 | Max cache entries |
| CACHE_TYPE | memory | Cache backend (`memory` or `redis`) |
| QUEUE_TYPE | memory | Queue backend (`memory` or `inngest`) |
| QUEUE_CONCURRENCY | 1 | Concurrent workers |
| REDIS_URL | - | Redis connection URL (required when `CACHE_TYPE=redis`) |
| INNGEST_EVENT_KEY | - | Inngest event key (required when `QUEUE_TYPE=inngest`) |
| INNGEST_SIGNING_KEY | - | Inngest signing key (required when `QUEUE_TYPE=inngest`) |

---

## Docker

| Service | Port | Description |
|---------|------|-------------|
| `backend` | 3000 | Node.js API server |
| `redis` | 6379 | Redis cache (password: `superq-redis-password`) |
| `inngest` | 8288 | Inngest dev server dashboard |

> **Note**: By default, Docker starts all services but uses memory-based adapters. Set `CACHE_TYPE=redis` and/or `QUEUE_TYPE=inngest` to enable the external services.

---

## Logging

| Event | Log Message | Level |
|-------|-------------|-------|
| Startup | `app.startup` | info |
| Queue enqueue | `queue.enqueue` | info |
| Cache hit | `cache.hit` | info |
| Cache miss | `cache.miss` | info |
| Queue coalesced | `queue.coalesced` | info |

---

## Test Suite

```
tests 8 | pass 8 | fail 0
Line coverage: 94.49%
Branch coverage: 81.45%
```

See [`screenshots/test-results.md`](screenshots/test-results.md) for full output.

---

## Architecture Diagram

```
┌────────┐      ┌─────────┐      ┌───────┐
│ Client │─────▶│ Service │─────▶│ Cache │
└────────┘      └─────────┘      └───────┘
                                     │
                     ┌───────────────┼───────────────┐
                     │ HIT           │ MISS          │
                     ▼               ▼               │
               ┌──────────┐    ┌─────────┐           │
               │ Return   │    │  Queue  │           │
               │ Cached   │    │ (FIFO)  │           │
               └──────────┘    └─────────┘           │
                                    │                │
                                    ▼                │
                              ┌───────────┐          │
                              │ Processor │──────────┘
                              │ (SHA-256) │   STORE
                              └───────────┘
```

### Request Lifecycle

1. **Cache Check**: Service checks cache for existing result
2. **Cache Hit**: Return immediately (0ms processing)
3. **Cache Miss**: Enqueue work item with coalesce key
4. **Coalescing**: Duplicate requests attach to existing promise
5. **Processing**: Worker computes SHA-256 after simulated delay
6. **Storage**: Result stored in cache
7. **Response**: All waiting clients receive result

---

## Concurrency Handling

### Patterns Used

| Pattern | Purpose | Implementation |
|---------|---------|----------------|
| **Semaphore** | Limit concurrent workers | `processing.size >= concurrency` guard |
| **Request Coalescing** | Prevent duplicate work | Map of in-flight promises by key |
| **Promise Chaining** | Share results | Multiple callers attached to single computation |
| **Event Loop Atomicity** | Thread safety | JavaScript single-threaded model |

### How Request Coalescing Works

When 100 clients request the same hash simultaneously:

1. First request creates work item, starts processing
2. Requests 2-100 find existing work item by coalesce key
3. Their resolve functions chain to the original promise
4. Single SHA-256 computation completes
5. All 100 clients receive the same result

**Result**: 100 requests → 1 computation, 99 coalesced

### Concurrency Configuration

```bash
# Default: sequential processing
QUEUE_CONCURRENCY=1

# Parallel processing (recommended for production)
QUEUE_CONCURRENCY=5
```

---

## Caching Strategy

### Why LRU (Least Recently Used)?

| Reason | Explanation |
|--------|-------------|
| **Deterministic** | SHA-256 always produces same output for same input |
| **No TTL Needed** | Hash results never expire or become stale |
| **Bounded Memory** | `CACHE_MAX_SIZE` prevents unbounded growth |
| **O(1) Operations** | JavaScript Map guarantees insertion-order iteration |

> **Why no invalidation?** SHA-256 is a pure function—the same input always produces the same output. Results never become stale, eliminating the need for TTL or invalidation strategies.

### Cache Backends

| Backend | Use Case | Trade-offs |
|---------|----------|------------|
| **Memory** | Single instance, development | Fast, no network; lost on restart |
| **Redis** | Horizontal scaling, production | Shared state; network latency |

---

## Scaling & Performance

### Single Instance Performance

| Metric | Value |
|--------|-------|
| Cache hit latency | < 1ms |
| Coalesced request overhead | ~0.1ms |
| Memory footprint per entry | ~200 bytes |

### Horizontal Scaling

```
                    ┌──────────────┐
                    │ Load Balancer│
                    └──────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │ Node 1  │       │ Node 2  │       │ Node 3  │
    └─────────┘       └─────────┘       └─────────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           ▼
                    ┌─────────────┐
                    │    Redis    │
                    └─────────────┘
```

### Backend Comparison

| Aspect | Memory | Redis + Inngest |
|--------|--------|-----------------|
| Deployment | Single instance | Horizontal scaling |
| Cache sharing | None | Shared across nodes |
| Queue durability | Lost on crash | Persisted, exactly-once |
| Latency | Lowest | +1-2ms network |
