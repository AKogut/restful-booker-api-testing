import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@client/api-error'
import { HttpClient } from '@client/http-client'
import type { ExchangeLogEntry } from '@client/request-logger'
import type { RetryPolicy } from '@client/retry-policy'

const FAST_RETRY: RetryPolicy = { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 20 }

let server: Server
let baseUrl: string
let attempts = 0
let failuresLeft = 0
let transientStatus = 503

const startStubServer = async (): Promise<void> => {
  server = createServer((request, response) => {
    attempts += 1
    if (request.url?.startsWith('/unstable') && failuresLeft > 0) {
      failuresLeft -= 1
      response.writeHead(transientStatus, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'Service Unavailable' }))
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true }))
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${port}`
}

beforeAll(startStubServer)
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

beforeEach(() => {
  attempts = 0
  failuresLeft = 0
  transientStatus = 503
})

describe('HttpClient retry', () => {
  it('retries an idempotent call until it succeeds', async () => {
    failuresLeft = 2
    const client = new HttpClient({ baseUrl, timeoutMs: 2000, retry: FAST_RETRY })

    const response = await client.request<{ ok: boolean }>({ method: 'GET', path: '/unstable' })

    expect(response.status).toBe(200)
    expect(attempts).toBe(3)
  })

  it('returns the last transient response once attempts are exhausted', async () => {
    failuresLeft = 99
    const client = new HttpClient({ baseUrl, timeoutMs: 2000, retry: FAST_RETRY })

    const response = await client.request({ method: 'GET', path: '/unstable' })

    expect(response.status).toBe(503)
    expect(attempts).toBe(FAST_RETRY.maxAttempts)
  })

  it('never retries a non-idempotent call', async () => {
    failuresLeft = 99
    const client = new HttpClient({ baseUrl, timeoutMs: 2000, retry: FAST_RETRY })

    const response = await client.request({ method: 'POST', path: '/unstable' })

    expect(response.status).toBe(503)
    expect(attempts).toBe(1)
  })

  it('does not retry a client error', async () => {
    failuresLeft = 99
    transientStatus = 404
    const client = new HttpClient({ baseUrl, timeoutMs: 2000, retry: FAST_RETRY })

    const response = await client.request({ method: 'GET', path: '/unstable' })

    expect(response.status).toBe(404)
    expect(attempts).toBe(1)
  })

  it('retries transport failures and surfaces the error when they persist', async () => {
    const client = new HttpClient({
      baseUrl: 'http://127.0.0.1:1',
      timeoutMs: 200,
      retry: FAST_RETRY,
    })

    await expect(client.request({ method: 'GET', path: '/room' })).rejects.toBeInstanceOf(ApiError)
  })

  it('performs a single attempt without a retry policy', async () => {
    failuresLeft = 99
    const client = new HttpClient({ baseUrl, timeoutMs: 2000 })

    const response = await client.request({ method: 'GET', path: '/unstable' })

    expect(response.status).toBe(503)
    expect(attempts).toBe(1)
  })

  it('honours a per-request retry override', async () => {
    failuresLeft = 99
    const client = new HttpClient({ baseUrl, timeoutMs: 2000, retry: FAST_RETRY })

    const response = await client.request({
      method: 'GET',
      path: '/unstable',
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    })

    expect(response.status).toBe(503)
    expect(attempts).toBe(1)
  })

  it('surfaces the attempt number in the exchange log', async () => {
    failuresLeft = 1
    const entries: ExchangeLogEntry[] = []
    const client = new HttpClient({
      baseUrl,
      timeoutMs: 2000,
      retry: FAST_RETRY,
      logger: (entry) => entries.push(entry),
    })

    await client.request({ method: 'GET', path: '/unstable' })

    expect(entries.map((entry) => entry.attempt)).toEqual([1, 2])
    expect(entries.at(-1)?.status).toBe(200)
  })
})
