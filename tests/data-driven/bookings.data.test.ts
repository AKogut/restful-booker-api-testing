import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bookingPayload } from '@factories/booking-factory'
import type { BookingPayload } from '@models/booking'
import type { Room } from '@models/room'
import { createServices } from '@services/service-factory'
import { provisionRoom } from '@support/rooms'
import { adminToken } from '@support/session'
import bookingCases from '../data/booking-cases.json'

interface BookingCase {
  name: string
  overrides?: Partial<BookingPayload>
  omit?: (keyof BookingPayload)[]
  invertDates?: boolean
  expected: { status: number; errors?: string[]; error?: string }
}

const { booking, room } = createServices()
const cases = bookingCases as BookingCase[]

let token: string
let testRoom: Room
const createdBookingIds = new Set<number>()

const buildPayload = (testCase: BookingCase): BookingPayload => {
  const payload = bookingPayload(testRoom.roomid, testCase.overrides ?? {})

  if (testCase.invertDates === true) {
    const { checkin, checkout } = payload.bookingdates
    payload.bookingdates = { checkin: checkout, checkout: checkin }
  }

  for (const field of testCase.omit ?? []) {
    delete payload[field]
  }

  return payload
}

beforeAll(async () => {
  token = await adminToken()
  testRoom = await provisionRoom(room, token)
})

afterAll(async () => {
  for (const bookingid of createdBookingIds) {
    await booking.delete(bookingid, token)
  }
  await room.delete(testRoom.roomid, token)
})

describe('booking creation dataset @data-driven', () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))(
    'booking case: %s',
    async (_name, testCase) => {
      const payload = buildPayload(testCase)

      const response = await booking.create(payload)

      expect(response.status).toBe(testCase.expected.status)

      if ('bookingid' in response.data) {
        createdBookingIds.add(response.data.bookingid)
        expect(response.data).toMatchObject({
          roomid: payload.roomid,
          firstname: payload.firstname,
          bookingdates: payload.bookingdates,
        })
        return
      }

      if (testCase.expected.errors !== undefined) {
        if (!('errors' in response.data)) {
          throw new Error(
            `Expected a validation error body, received ${JSON.stringify(response.data)}`,
          )
        }
        expect(response.data.errors).toEqual(testCase.expected.errors)
      }

      if (testCase.expected.error !== undefined) {
        expect(response.data).toEqual({ error: testCase.expected.error })
      }
    },
  )
})
