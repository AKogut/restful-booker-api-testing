import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bookingPayload } from '@factories/booking-factory'
import { messagePayload } from '@factories/message-factory'
import type { Booking } from '@models/booking'
import type { Room } from '@models/room'
import {
  assertValid,
  authTokenSchema,
  bookingSchema,
  bookingSummarySchema,
  brandingSchema,
  messageListSchema,
  messageSchema,
  reportSchema,
  roomListSchema,
  roomSchema,
} from '@schemas/index'
import { getConfig } from '@config/app-config'
import { createServices } from '@services/service-factory'
import { provisionRoom } from '@support/rooms'
import { adminToken } from '@support/session'

const { auth, room, booking, message, branding, report } = createServices()
const { credentials } = getConfig()

let token: string
let testRoom: Room
let testBooking: Booking
const createdMessageIds = new Set<number>()

beforeAll(async () => {
  token = await adminToken()
  testRoom = await provisionRoom(room, token)
  const created = await booking.create(bookingPayload(testRoom.roomid))
  if (!('bookingid' in created.data)) {
    throw new Error(`Booking setup failed with status ${created.status}`)
  }
  testBooking = created.data
})

afterAll(async () => {
  for (const id of createdMessageIds) {
    await message.delete(id, token)
  }
  await booking.delete(testBooking.bookingid, token)
  await room.delete(testRoom.roomid, token)
})

describe('response contracts @contract', () => {
  it('auth login matches AuthToken', async () => {
    const response = await auth.login(credentials)
    assertValid(authTokenSchema, response.data)
  })

  it('room list and room detail match their schemas', async () => {
    const list = await room.list()
    assertValid(roomListSchema, list.data)

    const detail = await room.getById(testRoom.roomid)
    assertValid(roomSchema, detail.data)
  })

  it('booking creation and summary match their schemas', async () => {
    assertValid(bookingSchema, testBooking)

    const summary = await booking.summary(testRoom.roomid, token)
    assertValid(bookingSummarySchema, summary.data)
  })

  it('message list and detail match their schemas', async () => {
    const created = await message.create(messagePayload())
    expect(created.status).toBe(200)

    const list = await message.list()
    const validated = assertValid(messageListSchema, list.data)
    const mine = validated.messages.at(-1)
    if (mine !== undefined) {
      createdMessageIds.add(mine.id)
      const detail = await message.getById(mine.id)
      assertValid(messageSchema, detail.data)
    }
  })

  it('branding matches its schema', async () => {
    const response = await branding.get()
    assertValid(brandingSchema, response.data)
  })

  it('report matches its schema', async () => {
    const response = await report.getByRoom(testRoom.roomid, token)
    assertValid(reportSchema, response.data)
  })

  it('the authenticated global report matches its schema', async () => {
    const response = await report.get(token)

    expect(response.status).toBe(200)
    const validated = assertValid(reportSchema, response.data)
    expect(Array.isArray(validated.report)).toBe(true)
  })
})

describe('drift detection @contract', () => {
  it('rejects a room payload carrying an unexpected field', () => {
    const drifted = { ...testRoom, unexpectedField: true }

    expect(() => assertValid(roomSchema, drifted)).toThrowError(/unexpectedField/)
  })

  it('rejects a booking with a malformed date', () => {
    const drifted = {
      ...testBooking,
      bookingdates: { checkin: '10-11-2026', checkout: '2026-11-12' },
    }

    expect(() => assertValid(bookingSchema, drifted)).toThrowError(/checkin/)
  })
})

describe('cross-service consistency @contract', () => {
  it('a booking created via BookingService is reflected in the room report', async () => {
    const response = await report.getByRoom(testRoom.roomid, token)
    const validated = assertValid(reportSchema, response.data)

    expect(validated.report).toContainEqual({
      start: testBooking.bookingdates.checkin,
      end: testBooking.bookingdates.checkout,
      title: 'Unavailable',
    })
  })
})
