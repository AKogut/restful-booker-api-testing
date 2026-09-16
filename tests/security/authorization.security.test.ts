import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bookingPayload } from '@factories/booking-factory'
import { messagePayload } from '@factories/message-factory'
import { nextRoomName, roomPayload } from '@factories/room-factory'
import type { Booking } from '@models/booking'
import type { Branding } from '@models/branding'
import type { Room, RoomPayload } from '@models/room'
import { getConfig } from '@config/app-config'
import { createServicesWithoutRetry } from '@services/service-factory'
import { createdBooking } from '@support/bookings'
import { provisionRoom } from '@support/rooms'
import { track } from '@support/run-registry'
import { sweepRoomsByPrefix } from '../support/room-sweep'
import { sharedToken } from '../support/session'

const { room, booking, message, branding } = createServicesWithoutRetry(getConfig())

const INVALID_TOKEN = 'garbage-not-a-real-token'
const MARKER = 'SEC-AUTHZ-'

let token: string
let currentBranding: Branding
let targetRoom: Room
let targetBooking: Booking
let targetMessageId: number

const provisionBooking = async (roomid: number): Promise<Booking> => {
  const response = await booking.create(bookingPayload(roomid))
  const created = createdBooking(response.data)
  if (created === undefined) {
    throw new Error(`Booking provisioning failed with status ${response.status}`)
  }
  track('booking', created.bookingid)
  return created
}

const provisionMessage = async (): Promise<number> => {
  const payload = messagePayload()
  await message.create(payload)
  const listing = await message.list(token)
  const created = listing.data.messages.find((entry) => entry.subject === payload.subject)
  if (created === undefined) {
    throw new Error(`Provisioned message "${payload.subject}" not found in the inbox`)
  }
  track('message', created.id)
  return created.id
}

beforeAll(async () => {
  token = sharedToken()
  currentBranding = (await branding.get()).data
  targetRoom = await provisionRoom(room, token)
  targetBooking = await provisionBooking(targetRoom.roomid)
  targetMessageId = await provisionMessage()
})

afterAll(async () => {
  await message.delete(targetMessageId, token)
  await booking.delete(targetBooking.bookingid, token)
  await room.delete(targetRoom.roomid, token)
  await sweepRoomsByPrefix(room, token, MARKER)
})

const OBJECT_KEYS = ['roomid', 'bookingid', 'firstname', 'lastname', 'email', 'phone']

const leaksObjectData = (data: unknown): boolean =>
  typeof data === 'object' && data !== null && OBJECT_KEYS.some((key) => key in data)

const markedRoom = (): RoomPayload => roomPayload({ roomName: `${MARKER}${nextRoomName()}` })

const deniedWithoutDisclosure = (response: { status: number; data: unknown }): void => {
  expect(response.status).toBeGreaterThanOrEqual(400)
  expect(response.status).toBeLessThan(500)
  expect(leaksObjectData(response.data)).toBe(false)
}

const roomIsUnchanged = async (): Promise<void> => {
  const current = await room.getById(targetRoom.roomid)
  expect(current.status).toBe(200)
  expect(current.data).toMatchObject({
    roomName: targetRoom.roomName,
    roomPrice: targetRoom.roomPrice,
  })
}

const bookingIsUnchanged = async (): Promise<void> => {
  const current = await booking.getById(targetBooking.bookingid, token)
  expect(current.status).toBe(200)
  expect(createdBooking(current.data)).toEqual(targetBooking)
}

const messageIsUnread = async (): Promise<void> => {
  const listing = await message.list(token)
  const current = listing.data.messages.find((entry) => entry.id === targetMessageId)
  expect(current?.read).toBe(false)
}

interface Mutation {
  invoke: () => Promise<{ status: number; data: unknown }>
  isUnchanged?: () => Promise<void>
}

const roomCreation = (credential?: string): Mutation => {
  const payload = markedRoom()
  return {
    invoke: () => room.create(payload, credential),
    isUnchanged: async () => {
      const listing = await room.list()
      expect(listing.data.rooms.map((entry) => entry.roomName)).not.toContain(payload.roomName)
    },
  }
}

const mutations = (credential?: string): [string, Mutation][] => [
  ['room.create', roomCreation(credential)],
  [
    'room.update',
    {
      invoke: () => room.update(targetRoom.roomid, markedRoom(), credential),
      isUnchanged: roomIsUnchanged,
    },
  ],
  [
    'room.delete',
    { invoke: () => room.delete(targetRoom.roomid, credential), isUnchanged: roomIsUnchanged },
  ],
  [
    'booking.update',
    {
      invoke: () =>
        booking.update(
          targetBooking.bookingid,
          bookingPayload(targetRoom.roomid, { firstname: 'Intruder' }),
          credential,
        ),
      isUnchanged: bookingIsUnchanged,
    },
  ],
  [
    'booking.delete',
    {
      invoke: () => booking.delete(targetBooking.bookingid, credential),
      isUnchanged: bookingIsUnchanged,
    },
  ],
  [
    'message.markRead',
    {
      invoke: () => message.markRead(targetMessageId, credential),
      isUnchanged: messageIsUnread,
    },
  ],
  [
    'message.delete',
    { invoke: () => message.delete(targetMessageId, credential), isUnchanged: messageIsUnread },
  ],
  ['branding.update', { invoke: () => branding.update(currentBranding, credential) }],
]

describe('function-level authorization (BFLA) @security', () => {
  it.each(mutations())(
    'denies %s to an anonymous caller without changing the target',
    async (_name, mutation) => {
      const response = await mutation.invoke()

      deniedWithoutDisclosure(response)
      await mutation.isUnchanged?.()
    },
  )

  it.each(mutations(INVALID_TOKEN).filter(([name]) => name !== 'room.create'))(
    'denies %s to a caller with an invalid token without changing the target',
    async (_name, mutation) => {
      const response = await mutation.invoke()

      deniedWithoutDisclosure(response)
      await mutation.isUnchanged?.()
    },
  )
})

describe('object-level authorization (IDOR) @security', () => {
  it('does not serve an existing booking by id to an anonymous caller', async () => {
    const response = await booking.getById(targetBooking.bookingid)

    deniedWithoutDisclosure(response)
  })

  it('does not list an existing room’s bookings for an anonymous caller', async () => {
    const response = await booking.list(targetRoom.roomid)

    deniedWithoutDisclosure(response)
  })
})
