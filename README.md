# SuperQ

A queue-based hash computation service with LRU caching and request coalescing.

Author: **Raghunath Prabhakar**

---

## Prerequisites

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | >= 25.0.0 | [nodejs.org](https://nodejs.org/) or `nvm install 25` |
| npm | >= 10.0.0 | Included with Node.js |
| Docker | >= 27.0.0 | [docker.com](https://www.docker.com/get-started/) (optional) |
| Docker Compose | >= 2.30.0 | Included with Docker Desktop |

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

| Adapter | Description |
|---------|-------------|
| **Redis Cache** | Distributed caching for multi-instance deployments |
| **Inngest Queue** | Durable execution with exactly-once semantics |

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
Client -> Controller -> Service -> Repository -> Queue -> Cache
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

### Request Coalescing

When multiple clients request the same computation:
1. First request creates work item and starts processing
2. Subsequent identical requests attach to existing promise
3. All callers receive same result from single computation

Result: 100 concurrent identical requests -> 1 computation, 99 coalesced

---

## Extensibility Examples

### Redis Cache (Docker)

```bash
CACHE_TYPE=redis REDIS_URL=redis://:stub-redis-password@redis:6379 \
  docker compose up --build -d

curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"redis-test"}'

docker exec superq-redis-1 redis-cli -a stub-redis-password KEYS '*'
```

### Inngest Queue (Docker)

```bash
QUEUE_TYPE=inngest INNGEST_EVENT_KEY=key INNGEST_SIGNING_KEY=key \
  docker compose up --build
# Dev server: http://localhost:8288
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
| CACHE_TYPE | memory | Cache backend |
| QUEUE_TYPE | memory | Queue backend |
| QUEUE_CONCURRENCY | 1 | Concurrent workers |

---

## Docker

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3000 | Node.js API server |
| `redis` | 6379 | Redis (optional cache) |
| `inngest` | 8288 | Inngest dev server |

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
