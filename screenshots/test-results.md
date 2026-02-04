# Test Results

## Summary

```
tests 8 | suites 4 | pass 8 | fail 0
duration_ms 30399.617393
```

## Coverage

| Metric | Coverage |
|--------|----------|
| Line | 91.34% |
| Branch | 80.16% |
| Functions | 75.76% |

## Test Suites

| Suite | Tests | Duration |
|-------|-------|----------|
| Chat Integration | 3 | 30025ms |
| Contract Integration | 3 | 20ms |
| Health Integration | 1 | 10020ms |
| Stress Integration | 1 | 10028ms |

## Full Output

```
▶ [Batch 4] Chat Integration
  ✔ returns a hash and caches subsequent requests (10019.345527ms)
  ✔ coalesces concurrent requests for the same text (10003.439731ms)
  ✔ processes multiple unique texts concurrently (10002.102319ms)
✔ [Batch 4] Chat Integration (30025.793501ms)

▶ [Batch 1] Contract Integration
  ✔ rejects invalid payloads with error envelope (17.457459ms)
  ✔ rejects empty text (1.355706ms)
  ✔ rejects text exceeding max length (0.975495ms)
✔ [Batch 1] Contract Integration (20.447603ms)

▶ [Batch 2] Health Integration
  ✔ returns queue and cache stats (10020.269887ms)
✔ [Batch 2] Health Integration (10020.870439ms)

▶ [Batch 3] Stress Integration
  ✔ coalesces a large batch of identical inputs (10027.763394ms)
✔ [Batch 3] Stress Integration (10028.37014ms)
```

## Coverage Report

```
file                    | line % | branch % | funcs % | uncovered lines
-------------------------------------------------------------------------------------
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
   redis-cache.ts       |  72.88 |    75.00 |   22.22 | 9-27 29-33 35-38 40-41 44-45
   registry.ts          | 100.00 |    62.50 |  100.00 |
  constants.ts          | 100.00 |   100.00 |  100.00 |
  env.ts                |  89.19 |    28.57 |  100.00 | 13-14 27 29-33
  queue
   index.ts             | 100.00 |   100.00 |  100.00 |
   inngest-queue.ts     |  72.88 |    75.00 |   18.18 | 7-18 24-31 33-52 55-61 63
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
  response.ts           |  92.31 |    66.67 |  100.00 | 6-7
-------------------------------------------------------------------------------------
all files               |  91.34 |    80.16 |   75.76 |
```

## Running Tests

```bash
npm test                    # Run all tests with coverage
```
