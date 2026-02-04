/**
 * Centralized test suite constants for timing, buffers, and configuration.
 * All timing values in milliseconds.
 */

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/** Simulated processing delay (matches production PROCESSING_DELAY_MS) */
export const DELAY_MS = 10000

/** Maximum response time for cache hits */
export const CACHE_HIT_MS = 50

/** Buffer for timer imprecision under concurrent load */
export const TIMER_TOLERANCE_MS = 50

/** Test timeout (must exceed DELAY_MS + buffer for safety) */
export const TEST_TIMEOUT_MS = 20000

// ============================================================================
// BATCH & CONCURRENCY CONSTANTS
// ============================================================================

/** Concurrent requests in chat coalesce test */
export const COALESCE_BATCH_SIZE = 5

/** Concurrent requests in stress coalesce test */
export const STRESS_BATCH_SIZE = 100

/** Queue concurrency for chat tests */
export const CHAT_CONCURRENCY = 5

/** Queue concurrency for stress tests */
export const STRESS_CONCURRENCY = 10
