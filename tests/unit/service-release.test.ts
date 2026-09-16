import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { HttpClient } from '@client/http-client'
import { BookingService } from '@services/booking-service'
import { MessageService } from '@services/message-service'
import { RoomService } from '@services/room-service'
import { clearRegistry, readRegistry, track } from '@support/run-registry'

let server: Server
let client: HttpClient
let registry: string

beforeAll(async () => {
  server = createServer((request, response) => {
    const accepted = request.headers.cookie === 'token=admin'
    response.writeHead(accepted ? 202 : 403)
    response.end()
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  client = new HttpClient({ baseUrl: `http://127.0.0.1:${port}`, timeoutMs: 2000 })
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

beforeEach(() => {
  registry = join(mkdtempSync(join(tmpdir(), 'release-test-')), 'registry.jsonl')
  writeFileSync(registry, '')
  process.env.RUN_REGISTRY = registry
})

afterEach(() => {
  clearRegistry(registry)
  delete process.env.RUN_REGISTRY
})

describe('service deletes and the run registry', () => {
  it('releases every kind of resource the platform confirms deleted', async () => {
    track('room', 1)
    track('booking', 2)
    track('message', 3)

    await new RoomService(client).delete(1, 'admin')
    await new BookingService(client).delete(2, 'admin')
    await new MessageService(client).delete(3, 'admin')

    expect(readRegistry(registry)).toEqual([])
  })

  it('keeps a resource whose delete was rejected, so the sweep still removes it', async () => {
    track('room', 1)

    const response = await new RoomService(client).delete(1, 'not-admin')

    expect(response.status).toBe(403)
    expect(readRegistry(registry)).toEqual([{ kind: 'room', id: 1 }])
  })
})
