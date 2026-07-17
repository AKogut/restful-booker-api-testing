import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AppConfig } from '@config/app-config'
import { assertPlatformHealthy, checkHealth } from '@health/health-check'

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

const configWith = (report: string): AppConfig => ({
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
})

beforeAll(async () => {
  upUrl = await startServer('UP')
  downUrl = await startServer('DOWN')
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
