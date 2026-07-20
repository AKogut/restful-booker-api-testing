import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AppConfig } from '@config/app-config'
import {
  assertPlatformHealthy,
  checkHealth,
  consoleReadinessReporter,
  waitForPlatformReady,
  type ServiceHealth,
} from '@health/health-check'

const servers: Server[] = []

const startServer = async (status: 'UP' | 'DOWN'): Promise<string> => {
  const server = createServer((_request, response) => {
    response.writeHead(status === 'UP' ? 200 : 503, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status }))
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}`
}

let upUrl: string
let downUrl: string
let flakyUrl: string
let flakyProbesLeft = 0

const startFlakyServer = async (): Promise<string> => {
  const server = createServer((_request, response) => {
    const down = flakyProbesLeft > 0
    flakyProbesLeft -= 1
    response.writeHead(down ? 503 : 200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: down ? 'DOWN' : 'UP' }))
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}`
}

const configWith = (report: string, readinessTimeoutMs = 0): AppConfig => ({
  mode: 'local',
  timeoutMs: 2000,
  services: {
    auth: upUrl,
    room: upUrl,
    booking: upUrl,
    message: upUrl,
    branding: upUrl,
    report,
  },
  credentials: { username: 'admin', password: 'password' },
  retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
  readiness: { timeoutMs: readinessTimeoutMs, intervalMs: 20 },
})

beforeAll(async () => {
  upUrl = await startServer('UP')
  downUrl = await startServer('DOWN')
  flakyUrl = await startFlakyServer()
})

afterAll(async () => {
  await Promise.all(
    servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  )
})

describe('checkHealth', () => {
  it('reports every service as healthy when all return UP', async () => {
    const results = await checkHealth(configWith(upUrl))

    expect(results).toHaveLength(6)
    expect(results.every((result) => result.healthy)).toBe(true)
    expect(results.map((result) => result.service)).toContain('report')
  })

  it('flags an unhealthy service', async () => {
    const results = await checkHealth(configWith(downUrl))

    const report = results.find((result) => result.service === 'report')
    expect(report).toEqual({ service: 'report', status: 'DOWN', healthy: false })
  })

  it('marks an unreachable service as UNREACHABLE', async () => {
    const results = await checkHealth(configWith('http://127.0.0.1:1'))

    const report = results.find((result) => result.service === 'report')
    expect(report?.status).toBe('UNREACHABLE')
    expect(report?.healthy).toBe(false)
  })
})

describe('assertPlatformHealthy', () => {
  it('resolves when all services are UP', async () => {
    await expect(assertPlatformHealthy(configWith(upUrl))).resolves.toBeUndefined()
  })

  it('throws naming the unhealthy service', async () => {
    await expect(assertPlatformHealthy(configWith(downUrl))).rejects.toThrowError(/report=DOWN/)
  })
})

describe('waitForPlatformReady', () => {
  it('returns immediately when the platform is already up', async () => {
    await expect(waitForPlatformReady(configWith(upUrl), () => {})).resolves.toBeUndefined()
  })

  it('keeps polling until a cold-starting service comes up', async () => {
    flakyProbesLeft = 3
    const observed: number[] = []

    await waitForPlatformReady(configWith(flakyUrl, 5000), (attempt) => observed.push(attempt))

    expect(observed).toEqual([1, 2, 3])
  })

  it('reports the unhealthy services on every poll', async () => {
    flakyProbesLeft = 1
    const unhealthy: ServiceHealth[][] = []

    await waitForPlatformReady(configWith(flakyUrl, 5000), (_attempt, services) =>
      unhealthy.push(services),
    )

    expect(unhealthy[0]).toEqual([{ service: 'report', status: 'DOWN', healthy: false }])
  })

  it('names the attempt and every unhealthy service in the default report', () => {
    const written: string[] = []
    const info = console.info
    console.info = (message: string) => written.push(message)

    try {
      consoleReadinessReporter(2, [
        { service: 'auth', status: 'UNREACHABLE', healthy: false },
        { service: 'report', status: 'DOWN', healthy: false },
      ])
    } finally {
      console.info = info
    }

    expect(written).toEqual(['Waiting for the platform — attempt 2, auth=UNREACHABLE, report=DOWN'])
  })

  it('gives up with the attempt count once the deadline passes', async () => {
    await expect(waitForPlatformReady(configWith(downUrl, 60), () => {})).rejects.toThrowError(
      /not ready after \d+ attempts within 60 ms — report=DOWN/,
    )
  })
})
