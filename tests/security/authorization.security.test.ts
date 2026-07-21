import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bookingPayload } from '@factories/booking-factory'
import { nextRoomName, roomPayload } from '@factories/room-factory'
import type { Branding } from '@models/branding'
import { getConfig } from '@config/app-config'
import { createServicesWithoutRetry } from '@services/service-factory'
import { sweepRoomsByPrefix } from '../support/room-sweep'
import { sharedToken } from '../support/session'

const { room, booking, message, branding } = createServicesWithoutRetry(getConfig())

const ANY_ID = 1
const INVALID_TOKEN = 'garbage-not-a-real-token'
const MARKER = 'SEC-AUTHZ-'

let token: string
let currentBranding: Branding

beforeAll(async () => {
  token = sharedToken()
  currentBranding = (await branding.get()).data
})

afterAll(async () => {
  await sweepRoomsByPrefix(room, token, MARKER)
})

const OBJECT_KEYS = ['roomid', 'bookingid', 'firstname', 'lastname', 'email', 'phone']

const leaksObjectData = (data: unknown): boolean =>
  typeof data === 'object' && data !== null && OBJECT_KEYS.some((key) => key in data)

const markedRoom = () => roomPayload({ roomName: `${MARKER}${nextRoomName()}` })

type Invoke = () => Promise<{ status: number; data: unknown }>

const mutations = (credential?: string): [string, Invoke][] => [
  ['room.create', () => room.create(markedRoom(), credential)],
  ['room.update', () => room.update(ANY_ID, roomPayload(), credential)],
  ['room.delete', () => room.delete(ANY_ID, credential)],
  ['booking.update', () => booking.update(ANY_ID, bookingPayload(ANY_ID), credential)],
  ['booking.delete', () => booking.delete(ANY_ID, credential)],
  ['message.markRead', () => message.markRead(ANY_ID, credential)],
  ['message.delete', () => message.delete(ANY_ID, credential)],
  ['branding.update', () => branding.update(currentBranding, credential)],
]

const cleanlyDenied = (status: number): void => {
  expect(status).toBeGreaterThanOrEqual(400)
  expect(status).toBeLessThan(500)
}

describe('function-level authorization (BFLA) @security', () => {
  it.each(mutations())(
    'denies %s to an anonymous caller, with a 4xx and no object data',
    async (_name, invoke) => {
      const response = await invoke()

      cleanlyDenied(response.status)
      expect(leaksObjectData(response.data)).toBe(false)
    },
  )

  it.each(mutations(INVALID_TOKEN).filter(([name]) => name !== 'room.create'))(
    'denies %s to a caller with an invalid token, with a 4xx and no object data',
    async (_name, invoke) => {
      const response = await invoke()

      cleanlyDenied(response.status)
      expect(leaksObjectData(response.data)).toBe(false)
    },
  )
})

describe('object-level authorization (IDOR) @security', () => {
  it('does not serve a booking by id to an anonymous caller', async () => {
    const response = await booking.getById(ANY_ID)

    cleanlyDenied(response.status)
    expect(leaksObjectData(response.data)).toBe(false)
  })

  it('does not list a room’s bookings for an anonymous caller', async () => {
    const response = await booking.list(ANY_ID)

    cleanlyDenied(response.status)
    expect(leaksObjectData(response.data)).toBe(false)
  })
})
