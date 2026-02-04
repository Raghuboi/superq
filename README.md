# SuperQ

Queue-based hash computation service with LRU caching and request coalescing.

**Author:** Raghunath Prabhakar

## Quick Start

```bash
npm install && npm run dev
# Open http://localhost:3000/docs
```

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 22.0.0 | Required for native test runner |
| npm | >= 10.0.0 | Included with Node.js |
| Docker | >= 27.0.0 | Optional, for containerized deployment |

### Platform-Specific Installation

**macOS**
```bash
brew install node@22
# or use nvm: nvm install 22
brew install --cask docker
```

**Linux (Ubuntu/Debian)**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
# Docker: https://docs.docker.com/engine/install/ubuntu/
```

**Windows**
```powershell
winget install OpenJS.NodeJS
# Docker Desktop: https://docs.docker.com/desktop/install/windows-install/
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Process text → SHA-256 hash |
| `/health` | GET | Service health & queue/cache stats |
| `/docs` | GET | Swagger UI |

## Architecture

```
┌────────┐      ┌─────────┐      ┌───────┐
│ Client │─────▶│ Service │─────▶│ Cache │
└────────┘      └─────────┘      └───────┘
                                     │
                     ┌───────────────┼───────────────┐
                     │ HIT           │ MISS          │
                     ▼               ▼               │
               ┌──────────┐    ┌─────────┐           │
               │ Response │    │  Queue  │           │
               │ (instant)│    │ (FIFO)  │           │
               └──────────┘    └─────────┘           │
                                    │                │
                                    ▼                │
                              ┌───────────┐          │
                              │ Processor │──────────┘
                              │ (SHA-256) │   STORE
                              └───────────┘
```

### Request Flow

1. **Cache Check**: Service checks cache for existing result
2. **Cache Hit**: Return immediately (<1ms)
3. **Cache Miss**: Enqueue work item with coalesce key
4. **Coalescing**: Duplicate requests attach to existing promise
5. **Processing**: Worker computes SHA-256 after simulated delay
6. **Storage**: Result stored in cache
7. **Response**: All waiting clients receive result

## Concurrency Model

**Event Loop Atomicity**: Node.js single-threaded model means operations between `await` points are atomic—no mutex needed. The "check-then-act" pattern is safe in JavaScript unlike multi-threaded languages where race conditions occur in the gap between checking and acting.

**Request Coalescing** (Single-Flight): Prevents the **thundering herd** problem—when a popular cache key expires and floods of requests hit the backend simultaneously. When 100 clients request the same uncached value, only the first triggers computation—the other 99 attach to the in-flight promise.

Result: 100 concurrent identical requests → 1 computation, 99 coalesced.

## Caching Strategy

**Cache-Aside Pattern**: The default pattern used in most systems—check cache first, compute on miss, store result, return. Cache stays lean by only storing data actually requested.

**LRU Eviction**: O(1) implementation via JavaScript Map insertion-order guarantee. When cache exceeds `CACHE_MAX_SIZE`, the least recently accessed entry is evicted.

**No TTL Needed**: SHA-256 is a deterministic pure function—same input always produces same output. Results never become stale, eliminating the need for TTL or invalidation strategies entirely.

## Example Requests

### Cache Miss (First Request)

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world"}'
# Response after ~10s: {"hash":"b94d27b9...", "fromCache": false, "processingTimeMs": 10023}
```

### Cache Hit (Repeat Request)

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world"}'
# Response immediately: {"hash":"b94d27b9...", "fromCache": true, "processingTimeMs": 0.1}
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

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `PROCESSING_DELAY_MS` | 10000 | Simulated processing delay |
| `CACHE_MAX_SIZE` | 1000 | Max cache entries (LRU eviction) |
| `QUEUE_CONCURRENCY` | 1 | Concurrent queue workers |
| `CACHE_TYPE` | memory | Cache backend (`memory` / `redis`) |
| `QUEUE_TYPE` | memory | Queue backend (`memory` / `inngest`) |

## Extensibility

Registry pattern enables swappable backends without code changes:

| Adapter | Description |
|---------|-------------|
| **Redis Cache** | Distributed caching for horizontal scaling |
| **Inngest Queue** | Durable execution with exactly-once delivery |

```bash
# Enable Redis cache
CACHE_TYPE=redis docker compose up --build -d

# Enable Inngest queue (dev server at http://localhost:8288)
QUEUE_TYPE=inngest docker compose up --build

# Production setup (both)
CACHE_TYPE=redis QUEUE_TYPE=inngest docker compose up --build -d
```

**Adding Custom Adapters**: Implement `CacheAdapter` or `QueueAdapter` interface, add type to env schema, register in `src/lib/cache/registry.ts` or `src/lib/queue/registry.ts`.

## Scaling

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

| Aspect | Memory | Redis + Inngest |
|--------|--------|-----------------|
| Deployment | Single instance | Horizontal scaling |
| Cache sharing | None | Shared across nodes |
| Queue durability | Lost on crash | Persisted, exactly-once |
| Latency | Lowest | +1-2ms network |

## Docker

```bash
npm run docker:up        # Start services
npm run docker:watch     # Development with hot reload
npm run docker:down      # Stop services
npm run docker:logs      # Follow app container logs
npm run docker:health    # Check service health status
```

| Service | Port | Description |
|---------|------|-------------|
| `backend` | 3000 | Node.js API server |
| `redis` | 6379 | Redis cache (optional) |
| `inngest` | 8288 | Inngest dev server (optional) |

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run tests with coverage |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | TypeScript type checking |

## Developer Experience

| Feature | Description |
|---------|-------------|
| Swagger UI | Interactive API docs at `/docs` |
| Hot Reload | `npm run dev` with tsx watch |
| Linting | ESLint with TypeScript rules |
| Formatting | Prettier code formatting |
| Type Safety | Strict TypeScript with Zod validation |
| Structured Logging | Pino JSON logs with pretty-print dev mode |
| Test Coverage | Node.js native test runner (94%+ coverage) |

## Test Suite

```
tests 8 | pass 8 | fail 0
Line coverage: 91.34%
Branch coverage: 80.16%
```

See [`screenshots/test-results.md`](screenshots/test-results.md) for full output.

## Logging

| Event | Log Key |
|-------|---------|
| Queue enqueue | `queue.enqueue` |
| Cache hit | `cache.hit` |
| Cache miss | `cache.miss` |
| Request coalesced | `queue.coalesced` |
| Processing complete | `processing.complete` |
