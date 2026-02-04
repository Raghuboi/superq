import assert from 'node:assert/strict'

/**
 * Assert that a response has the correct success envelope format.
 */
export function assertOkResponse(body: unknown): asserts body is {
  readonly success: true
  readonly data: unknown
} {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Response body is not an object')
  }
  assert.ok('success' in body, 'Response must have success property')
  assert.equal((body as { success: unknown }).success, true, 'Response success must be true')
  assert.ok('data' in body, 'Response must have data property')
}

/**
 * Assert that a response has the correct error envelope format.
 */
export function assertErrResponse(body: unknown): asserts body is {
  readonly success: false
  readonly error: { readonly code: string; readonly message: string }
} {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Response body is not an object')
  }
  assert.ok('success' in body, 'Response must have success property')
  assert.equal((body as { success: unknown }).success, false, 'Response success must be false')
  assert.ok('error' in body, 'Response must have error property')
  const error = (body as { error: unknown }).error
  assert.ok(typeof error === 'object' && error !== null, 'Error must be an object')
  assert.ok('code' in error, 'Error must have code property')
  assert.ok('message' in error, 'Error must have message property')
}
