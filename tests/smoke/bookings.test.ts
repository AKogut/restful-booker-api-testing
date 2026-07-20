import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Booking, BookingPayload } from '@models/booking'
import type { Room } from '@models/room'
import { createServices } from '@services/service-factory'
import { bookingPayload } from '@factories/booking-factory'
import { createdBooking } from '@support/bookings'
import { provisionRoom } from '@support/rooms'
import { expectedStatus, supports } from '@profiles/target-profile'
import { itWhenSupported } from '../support/target'
import { sharedToken } from '../support/session'

const { booking, room } = createServices()

let token: string
let testRoom: Room
const createdBookingIds = new Set<number>()

const createBooking = async (payload: BookingPayload): Promise<Booking> => {
  const response = await booking.create(payload)
  const created = createdBooking(response.data)
  if (created === undefined) {
    throw new Error(`Booking creation failed with status ${response.status}`)
  }
  createdBookingIds.add(created.bookingid)
  return created
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

describe('booking service @smoke', () => {
  it('creates a booking and echoes it without contact details', async () => {
    const payload = bookingPayload(testRoom.roomid)

    const response = await booking.create(payload)

    expect(response.status).toBe(201)
    const created = createdBooking(response.data)
    if (created === undefined) {
      throw new Error(`Booking creation failed with status ${response.status}`)
    }
    createdBookingIds.add(created.bookingid)
    expect(created).toEqual({
      bookingid: expect.any(Number) as number,
      roomid: payload.roomid,
      firstname: payload.firstname,
      lastname: payload.lastname,
      depositpaid: payload.depositpaid,
      bookingdates: payload.bookingdates,
    })
  })

  it('rejects an overlapping booking for the same dates', async () => {
    const payload = bookingPayload(testRoom.roomid)
    await createBooking(payload)

    const response = await booking.create(
      bookingPayload(testRoom.roomid, { bookingdates: payload.bookingdates }),
    )

    expect(response.status).toBe(409)
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ error: 'Failed to create booking' })
    }
  })

  it('lists bookings for a room when authenticated', async () => {
    const created = await createBooking(bookingPayload(testRoom.roomid))

    const response = await booking.list(testRoom.roomid, token)

    expect(response.status).toBe(200)
    if (!('bookings' in response.data)) {
      throw new Error('Expected a booking list')
    }
    expect(response.data.bookings.map((entry) => entry.bookingid)).toContain(created.bookingid)
  })

  it('rejects listing bookings without a token', async () => {
    const response = await booking.list(testRoom.roomid)

    expect(response.status).toBe(expectedStatus('authz.missingToken'))
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ error: 'Authentication required' })
    }
  })

  it('returns a booking by id when authenticated', async () => {
    const created = await createBooking(bookingPayload(testRoom.roomid))

    const response = await booking.getById(created.bookingid, token)

    expect(response.status).toBe(200)
    expect(createdBooking(response.data)).toEqual(created)
  })

  it('reports booked date ranges in the room summary', async () => {
    const created = await createBooking(bookingPayload(testRoom.roomid))

    const response = await booking.summary(testRoom.roomid, token)

    expect(response.status).toBe(200)
    if (!('bookings' in response.data)) {
      throw new Error('Expected a booking summary')
    }
    expect(response.data.bookings).toContainEqual({ bookingDates: created.bookingdates })
  })

  it('updates a booking and persists the changes', async () => {
    const created = await createBooking(bookingPayload(testRoom.roomid))
    const { email: _email, phone: _phone, ...base } = bookingPayload(testRoom.roomid)
    const updatePayload = { ...base, firstname: 'Updated' }

    const response = await booking.update(created.bookingid, updatePayload, token)

    expect(response.status).toBe(200)
    expect(response.data).toEqual({
      bookingid: created.bookingid,
      booking: { ...updatePayload, bookingid: created.bookingid },
    })

    const fetched = await booking.getById(created.bookingid, token)
    expect(fetched.data).toEqual({ ...updatePayload, bookingid: created.bookingid })
  })

  it('deletes a booking and returns 404 on subsequent reads', async () => {
    const created = await createBooking(bookingPayload(testRoom.roomid))

    const deletion = await booking.delete(created.bookingid, token)
    createdBookingIds.delete(created.bookingid)

    expect(deletion.status).toBe(202)

    const fetched = await booking.getById(created.bookingid, token)
    expect(fetched.status).toBe(404)
  })

  it('rejects an update without a token', async () => {
    const created = await createBooking(bookingPayload(testRoom.roomid))
    const { email: _email, phone: _phone, ...updatePayload } = bookingPayload(testRoom.roomid)

    const response = await booking.update(created.bookingid, updatePayload)

    expect(response.status).toBe(403)
  })

  it('rejects a deletion without a token', async () => {
    const created = await createBooking(bookingPayload(testRoom.roomid))

    const response = await booking.delete(created.bookingid)

    expect(response.status).toBe(403)
  })

  itWhenSupported('defects.documented').fails(
    'returns clean validation errors on update (known RBP defect: leaks internals)',
    async () => {
      const created = await createBooking(bookingPayload(testRoom.roomid))
      const { email: _email, phone: _phone, ...base } = bookingPayload(testRoom.roomid)

      const response = await booking.update(created.bookingid, { ...base, firstname: 'X' }, token)

      expect(response.status).toBe(400)
      if (!('errorMessage' in response.data)) {
        throw new Error('Expected a validation error body')
      }
      expect(response.data.errorMessage).not.toContain('org.springframework')
      expect(response.data.errorMessage).not.toContain('SQLException')
    },
  )
})
