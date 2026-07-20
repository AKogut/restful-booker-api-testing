export interface RetryPolicy {
  readonly maxAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
}

export const NO_RETRY: RetryPolicy = { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 }

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])

const TRANSIENT_STATUSES = new Set([408, 425, 429, 502, 503, 504])

export const isIdempotent = (method: string): boolean =>
  IDEMPOTENT_METHODS.has(method.toUpperCase())

export const isTransientStatus = (status: number): boolean => TRANSIENT_STATUSES.has(status)

export const backoffDelay = (
  policy: RetryPolicy,
  attempt: number,
  random: () => number = Math.random,
): number => {
  const exponential = policy.baseDelayMs * 2 ** (attempt - 1)
  const capped = Math.min(exponential, policy.maxDelayMs)
  return Math.round(capped / 2 + (capped / 2) * random())
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
