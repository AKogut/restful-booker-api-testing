import fc from 'fast-check'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { guestArbitrary, stayLengthArbitrary } from '@factories/arbitraries'
import { nextStayWindow } from '@factories/booking-factory'
import type { BookingPayload } from '@models/booking'
import type { Room } from '@models/room'
import { createServices } from '@services/service-factory'
import { provisionRoom } from '@support/rooms'
import { adminToken } from '@support/session'

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
  if (typeof data === 'object' && data !== null && 'bookingid' in data) {
    createdBookingIds.add((data as { bookingid: number }).bookingid)
  }
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

describe('booking properties @property', () => {
  it('round-trips any valid guest payload', async () => {
    await fc.assert(
      fc.asyncProperty(guestArbitrary, stayLengthArbitrary, async (guest, nights) => {
        const payload = bookingFor(guest, nights)

        const created = await booking.create(payload)
        register(created.data)
        if (!('bookingid' in created.data)) {
          throw new Error(
            `Create failed with ${created.status}: ${JSON.stringify(created.data)} for ${JSON.stringify(payload)}`,
          )
        }

        const fetched = await booking.getById(created.data.bookingid, token)

        expect(fetched.status).toBe(200)
        expect(fetched.data).toEqual({
          bookingid: created.data.bookingid,
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
          if (!('bookingid' in initial.data)) {
            throw new Error(`Setup booking failed with ${initial.status}`)
          }

          const overlapping = await booking.create({
            ...second,
            roomid: payload.roomid,
            bookingdates: payload.bookingdates,
          })
          register(overlapping.data)

          expect(overlapping.status).toBe(409)
          expect(overlapping.data).toEqual({ error: 'Failed to create booking' })
        },
      ),
      { numRuns: RUNS, verbose: true },
    )
  })

  it('reflects every accepted booking in the room summary', async () => {
    await fc.assert(
      fc.asyncProperty(guestArbitrary, stayLengthArbitrary, async (guest, nights) => {
        const payload = bookingFor(guest, nights)

        const created = await booking.create(payload)
        register(created.data)
        if (!('bookingid' in created.data)) {
          throw new Error(`Create failed with ${created.status}`)
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
