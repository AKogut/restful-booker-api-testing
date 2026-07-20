import fc from 'fast-check'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { guestArbitrary, stayLengthArbitrary } from '@factories/arbitraries'
import { nextStayWindow } from '@factories/booking-factory'
import type { BookingPayload } from '@models/booking'
import type { Room } from '@models/room'
import { createServices } from '@services/service-factory'
import { createdBooking } from '@support/bookings'
import { provisionRoom } from '@support/rooms'
import { sharedToken } from '../support/session'

const { booking, room } = createServices()

const RUNS = 8

let token: string
let testRoom: Room
const createdBookingIds = new Set<number>()

type Guest = Omit<BookingPayload, 'roomid' | 'bookingdates'>

const bookingFor = (guest: Guest, nights: number): BookingPayload => ({
  ...guest,
  roomid: testRoom.roomid,
  bookingdates: nextStayWindow(nights),
})

const register = (data: unknown): void => {
  const created = createdBooking(data)
  if (created !== undefined) {
    createdBookingIds.add(created.bookingid)
  }
}

beforeAll(async () => {
  token = sharedToken()
  testRoom = await provisionRoom(room, token)
})

afterAll(async () => {
  for (const bookingid of createdBookingIds) {
    await booking.delete(bookingid, token)
  }
  await room.delete(testRoom.roomid, token)
})

describe('booking properties @property', () => {
  it('round-trips any valid guest payload', async () => {
    await fc.assert(
      fc.asyncProperty(guestArbitrary, stayLengthArbitrary, async (guest, nights) => {
        const payload = bookingFor(guest, nights)

        const response = await booking.create(payload)
        register(response.data)
        const created = createdBooking(response.data)
        if (created === undefined) {
          throw new Error(
            `Create failed with ${response.status}: ${JSON.stringify(response.data)} for ${JSON.stringify(payload)}`,
          )
        }

        const fetched = await booking.getById(created.bookingid, token)

        expect(fetched.status).toBe(200)
        expect(createdBooking(fetched.data)).toEqual({
          bookingid: created.bookingid,
          roomid: payload.roomid,
          firstname: payload.firstname,
          lastname: payload.lastname,
          depositpaid: payload.depositpaid,
          bookingdates: payload.bookingdates,
        })
      }),
      { numRuns: RUNS, verbose: true },
    )
  })

  it('rejects any second booking overlapping the same window', async () => {
    await fc.assert(
      fc.asyncProperty(
        guestArbitrary,
        guestArbitrary,
        stayLengthArbitrary,
        async (first, second, nights) => {
          const payload = bookingFor(first, nights)

          const initial = await booking.create(payload)
          register(initial.data)
          if (createdBooking(initial.data) === undefined) {
            throw new Error(`Setup booking failed with ${initial.status}`)
          }

          const overlapping = await booking.create({
            ...second,
            roomid: payload.roomid,
            bookingdates: payload.bookingdates,
          })
          register(overlapping.data)

          expect(overlapping.status).toBe(409)
        },
      ),
      { numRuns: RUNS, verbose: true },
    )
  })

  it('reflects every accepted booking in the room summary', async () => {
    await fc.assert(
      fc.asyncProperty(guestArbitrary, stayLengthArbitrary, async (guest, nights) => {
        const payload = bookingFor(guest, nights)

        const response = await booking.create(payload)
        register(response.data)
        if (createdBooking(response.data) === undefined) {
          throw new Error(`Create failed with ${response.status}`)
        }

        const summary = await booking.summary(testRoom.roomid, token)
        if (!('bookings' in summary.data)) {
          throw new Error('Expected a booking summary')
        }

        expect(summary.data.bookings).toContainEqual({ bookingDates: payload.bookingdates })
      }),
      { numRuns: RUNS, verbose: true },
    )
  })
})
