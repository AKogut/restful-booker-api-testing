import { describe, expect, it } from 'vitest'
import {
  backoffDelay,
  isIdempotent,
  isTransientStatus,
  NO_RETRY,
  sleep,
  type RetryPolicy,
} from '@client/retry-policy'

const policy: RetryPolicy = { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 800 }

describe('isIdempotent', () => {
  it.each(['GET', 'get', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])(
    'treats %s as idempotent',
    (method) => {
      expect(isIdempotent(method)).toBe(true)
    },
  )

  it.each(['POST', 'PATCH'])('treats %s as non-idempotent', (method) => {
    expect(isIdempotent(method)).toBe(false)
  })
})

describe('isTransientStatus', () => {
  it.each([408, 425, 429, 502, 503, 504])('retries on %i', (status) => {
    expect(isTransientStatus(status)).toBe(true)
  })

  it.each([200, 400, 401, 404, 409, 500])('does not retry on %i', (status) => {
    expect(isTransientStatus(status)).toBe(false)
  })
})

describe('backoffDelay', () => {
  it('grows exponentially across attempts', () => {
    expect(backoffDelay(policy, 1, () => 1)).toBe(100)
    expect(backoffDelay(policy, 2, () => 1)).toBe(200)
    expect(backoffDelay(policy, 3, () => 1)).toBe(400)
  })

  it('caps the delay at maxDelayMs', () => {
    expect(backoffDelay(policy, 10, () => 1)).toBe(800)
  })

  it('jitters between half and the full delay', () => {
    expect(backoffDelay(policy, 2, () => 0)).toBe(100)
    expect(backoffDelay(policy, 2, () => 0.5)).toBe(150)
  })

  it('never waits under the no-retry policy', () => {
    expect(backoffDelay(NO_RETRY, 1, () => 1)).toBe(0)
  })
})

describe('sleep', () => {
  it('resolves after the requested delay', async () => {
    const startedAt = performance.now()

    await sleep(20)

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(15)
  })
})
