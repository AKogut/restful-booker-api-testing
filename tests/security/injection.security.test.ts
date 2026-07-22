import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nextRoomName, roomPayload } from '@factories/room-factory'
import type { RoomPayload } from '@models/room'
import { getConfig } from '@config/app-config'
import { expectedStatus } from '@profiles/target-profile'
import { createServicesWithoutRetry } from '@services/service-factory'
import { CreatedResources } from '@support/created-resources'
import { guardsDefect } from '../support/defect-guard'
import { sharedToken } from '../support/session'

const config = getConfig()
const { auth, room } = createServicesWithoutRetry(config)

const PATIENT_CLIENT_TIMEOUT_MS = 60_000
const PATIENT_TIMEOUT_MS = 70_000

const patient = createServicesWithoutRetry({ ...config, timeoutMs: PATIENT_CLIENT_TIMEOUT_MS })

const asPayload = (value: Record<string, unknown>): RoomPayload => value as unknown as RoomPayload

let token: string
const createdRoomIds = new CreatedResources('room')

const createNamed = async (
  name: string,
  marker: string,
  overrides: Record<string, unknown> = {},
) => {
  const payload = roomPayload({ roomName: name, ...overrides })
  const response = await room.create(payload, token)
  const listing = await room.list()
  const created = listing.data.rooms.find((entry) => entry.roomName.includes(marker))
  if (created !== undefined) {
    createdRoomIds.add(created.roomid)
  }
  return { response, created }
}

beforeAll(() => {
  token = sharedToken()
})

afterAll(async () => {
  for (const roomid of createdRoomIds.all()) {
    await room.delete(roomid, token)
  }
})

describe('injection is treated as data @security', () => {
  const INJECTION_PAYLOADS = ["robert'); DROP TABLE rooms;--", "1' OR '1'='1", '${7*7}', '{{7*7}}']

  it.each(INJECTION_PAYLOADS)('stores %s as a literal room name', async (payload) => {
    const marker = nextRoomName()
    const name = `${payload} ${marker}`

    const { response, created } = await createNamed(name, marker)

    expect(response.status).toBe(expectedStatus('resource.created'))
    expect(created?.roomName).toBe(name)
  })

  it('keeps the room listing intact after an injection attempt', async () => {
    const listing = await room.list()

    expect(listing.status).toBe(200)
    expect(Array.isArray(listing.data.rooms)).toBe(true)
    expect(listing.data.rooms.length).toBeGreaterThan(0)
  })

  it('rejects an injection payload in the login username', async () => {
    const response = await auth.login({ username: "admin'--", password: 'anything' })

    expect(response.status).toBe(expectedStatus('auth.rejected'))
  })
})

describe('mass assignment @security', () => {
  it('ignores a caller-supplied roomid and assigns its own', async () => {
    const marker = nextRoomName()
    const { created } = await createNamed(`MA-${marker}`, marker, { roomid: 88_888 })

    expect(created).toBeDefined()
    expect(created?.roomid).not.toBe(88_888)
  })

  it('ignores an unexpected privileged field', async () => {
    const marker = nextRoomName()
    const { response, created } = await createNamed(`AA-${marker}`, marker, {
      isAdmin: true,
      approved: true,
    })

    expect(response.status).toBe(expectedStatus('resource.created'))
    expect(created).toBeDefined()
  })
})

describe('input type validation @security', () => {
  it.each<[string, Record<string, unknown>]>([
    ['a non-numeric price', { roomPrice: 'NaN' }],
    ['a non-boolean accessible flag', { accessible: 'yes' }],
    ['a non-array features field', { features: 'WiFi' }],
  ])('rejects %s with a 4xx', async (_name, override) => {
    const response = await room.create(asPayload({ ...roomPayload(), ...override }), token)

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })
})

describe('oversized input @security', () => {
  guardsDefect(
    'BUG-012',
    'rejects an oversized description cleanly instead of crashing',
    async () => {
      const response = await patient.room.create(
        asPayload({ ...roomPayload(), description: 'A'.repeat(5000) }),
        token,
      )

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(response.status).toBeLessThan(500)
    },
    PATIENT_TIMEOUT_MS,
  )
})
