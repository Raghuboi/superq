# Test Results

## Summary

```
tests 8 | suites 4 | pass 8 | fail 0
duration_ms 30278.226537
```

## Coverage

| Metric | Coverage |
|--------|----------|
| Line | 94.49% |
| Branch | 81.45% |
| Functions | 78.95% |

## Test Suites

| Suite | Tests | Duration |
|-------|-------|----------|
| Chat Integration | 3 | 30027ms |
| Contract Integration | 3 | 25ms |
| Health Integration | 1 | 10025ms |
| Stress Integration | 1 | 10032ms |

## Full Output

```
▶ [Batch 4] Chat Integration
  ✔ returns a hash and caches subsequent requests (10021.601858ms)
  ✔ coalesces concurrent requests for the same text (10002.783723ms)
  ✔ processes multiple unique texts concurrently (10001.978778ms)
✔ [Batch 4] Chat Integration (30027.260646ms)

▶ [Batch 1] Contract Integration
  ✔ rejects invalid payloads with error envelope (21.227161ms)
  ✔ rejects empty text (1.39008ms)
  ✔ rejects text exceeding max length (1.976779ms)
✔ [Batch 1] Contract Integration (25.317844ms)

▶ [Batch 2] Health Integration
  ✔ returns queue and cache stats (10025.245865ms)
✔ [Batch 2] Health Integration (10025.97565ms)

▶ [Batch 3] Stress Integration
  ✔ coalesces a large batch of identical inputs (10031.129843ms)
✔ [Batch 3] Stress Integration (10032.865369ms)
```

## Coverage Report

```
file                    | line % | branch % | funcs % | uncovered lines
-----------------------------------------------------------------------------------
__tests__
 helpers
  app.ts                | 100.00 |   100.00 |  100.00 |
  assertions.ts         |  97.14 |    66.67 |  100.00 | 9
  constants.ts          | 100.00 |   100.00 |  100.00 |
src
 lib
  cache
   index.ts             | 100.00 |   100.00 |  100.00 |
   memory-cache.ts      |  94.59 |    91.67 |  100.00 | 21-24
   redis-cache.ts       |  62.50 |   100.00 |   28.57 | 6-9 11-12 15-17
   registry.ts          | 100.00 |    62.50 |  100.00 |
  constants.ts          | 100.00 |   100.00 |  100.00 |
  env.ts                |  88.89 |    28.57 |  100.00 | 13-14 27 29-33
  queue
   index.ts             | 100.00 |   100.00 |  100.00 |
   inngest-queue.ts     |  50.00 |   100.00 |   22.22 | 5 7-13 15-17 19-21 23-24
   memory-queue.ts      |  92.93 |    81.82 |   73.68 | 14 28-29 56-62 76-77 83 86
   registry.ts          |  96.30 |    62.50 |   80.00 | 12 16
 routes
  chat
   chat.controller.ts   | 100.00 |   100.00 |  100.00 |
   chat.repository.ts   | 100.00 |    92.86 |   92.31 |
   chat.service.ts      | 100.00 |   100.00 |   88.89 |
  health
   health.controller.ts | 100.00 |   100.00 |  100.00 |
 utils
  logger.ts             |  93.55 |    60.00 |  100.00 | 10 21
  response.ts           |  91.30 |    66.67 |  100.00 | 6-7
-----------------------------------------------------------------------------------
all files               |  94.49 |    81.45 |   78.95 |
```

## Running Tests

```bash
npm test                    # Run all tests with coverage
```
