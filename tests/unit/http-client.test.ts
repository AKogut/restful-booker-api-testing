import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ApiError } from '@client/api-error'
import { HttpClient } from '@client/http-client'
import type { ExchangeLogEntry } from '@client/request-logger'

interface RecordedRequest {
  method: string
  url: string
  headers: IncomingMessage['headers']
  body: string
}

const recorded: RecordedRequest[] = []
let server: Server
let baseUrl: string

const startStubServer = async (): Promise<void> => {
  server = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk: Buffer) => (body += chunk.toString()))
    request.on('end', () => {
      recorded.push({
        method: request.method ?? '',
        url: request.url ?? '',
        headers: request.headers,
        body,
      })
      if (request.url?.startsWith('/slow')) {
        setTimeout(() => {
          response.writeHead(200, { 'content-type': 'application/json' })
          response.end('{}')
        }, 500)
        return
      }
      if (request.url?.startsWith('/forbidden')) {
        response.writeHead(403, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: 'Forbidden' }))
        return
      }
      response.writeHead(201, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ created: true }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${port}`
}

beforeAll(startStubServer)
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

describe('HttpClient', () => {
  it('returns status, headers and parsed data', async () => {
    const client = new HttpClient({ baseUrl, timeoutMs: 2000 })

    const response = await client.request<{ created: boolean }>({
      method: 'POST',
      path: '/booking',
      body: { firstname: 'James' },
    })

    expect(response.status).toBe(201)
    expect(response.data).toEqual({ created: true })
    expect(response.headers['content-type']).toBe('application/json')
  })

  it('resolves non-2xx responses instead of throwing', async () => {
    const client = new HttpClient({ baseUrl, timeoutMs: 2000 })

    const response = await client.request<{ error: string }>({
      method: 'GET',
      path: '/forbidden',
    })

    expect(response.status).toBe(403)
    expect(response.data).toEqual({ error: 'Forbidden' })
  })

  it('attaches a correlation id to every request', async () => {
    const client = new HttpClient({ baseUrl, timeoutMs: 2000 })

    await client.request({ method: 'GET', path: '/room' })

    const lastRequest = recorded.at(-1)
    expect(lastRequest?.headers['x-correlation-id']).toMatch(/[0-9a-f-]{36}/)
  })

  it('passes query parameters through', async () => {
    const client = new HttpClient({ baseUrl, timeoutMs: 2000 })

    await client.request({ method: 'GET', path: '/booking', query: { roomid: 1 } })

    expect(recorded.at(-1)?.url).toBe('/booking?roomid=1')
  })

  it('invokes the exchange logger with timing metadata', async () => {
    const entries: ExchangeLogEntry[] = []
    const client = new HttpClient({
      baseUrl,
      timeoutMs: 2000,
      logger: (entry) => entries.push(entry),
    })

    await client.request({ method: 'GET', path: '/room' })

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ method: 'GET', status: 201 })
    expect(entries[0]?.correlationId).toMatch(/[0-9a-f-]{36}/)
    expect(entries[0]?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('redacts secrets before any logger sees the exchange', async () => {
    const entries: ExchangeLogEntry[] = []
    const client = new HttpClient({
      baseUrl,
      timeoutMs: 2000,
      logger: (entry) => entries.push(entry),
    })

    await client.request({
      method: 'POST',
      path: '/auth/login',
      headers: { Cookie: 'token=s3cr3t-token' },
      body: { username: 'admin', password: 's3cr3t-pass' },
    })

    const serialized = JSON.stringify(entries[0])
    expect(serialized).not.toContain('s3cr3t-pass')
    expect(serialized).not.toContain('s3cr3t-token')
    expect(entries[0]?.requestBody).toEqual({ username: 'admin', password: '***' })
    expect(entries[0]?.requestHeaders).toMatchObject({ Cookie: '***' })
  })

  it('logs failed exchanges with the normalized error', async () => {
    const entries: ExchangeLogEntry[] = []
    const client = new HttpClient({
      baseUrl,
      timeoutMs: 50,
      logger: (entry) => entries.push(entry),
    })

    await expect(client.request({ method: 'GET', path: '/slow' })).rejects.toBeInstanceOf(ApiError)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ method: 'GET', url: `${baseUrl}/slow` })
    expect(entries[0]?.error).toMatch(/timed out/)
  })

  it('normalizes timeouts into ApiError', async () => {
    const client = new HttpClient({ baseUrl, timeoutMs: 50 })

    const attempt = client.request({ method: 'GET', path: '/slow' })

    await expect(attempt).rejects.toBeInstanceOf(ApiError)
    await expect(attempt).rejects.toMatchObject({
      method: 'GET',
      url: `${baseUrl}/slow`,
      code: 'ECONNABORTED',
    })
  })

  it('normalizes connection failures into ApiError', async () => {
    const client = new HttpClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 500 })

    await expect(client.request({ method: 'GET', path: '/room' })).rejects.toBeInstanceOf(ApiError)
  })
})
