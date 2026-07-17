import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bookingPayload } from '@factories/booking-factory'
import { roomPayload } from '@factories/room-factory'
import type { BookingPayload } from '@models/booking'
import type { RoomType } from '@models/room'
import type { Room } from '@models/room'
import { createServices } from '@services/service-factory'
import { provisionRoom } from '@support/rooms'
import { adminToken } from '@support/session'

const { room, booking } = createServices()

let token: string
let testRoom: Room
const createdBookingIds = new Set<number>()

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

describe('booking boundary @negative', () => {
  it('rejects a too-short firstname', async () => {
    const response = await booking.create(bookingPayload(testRoom.roomid, { firstname: 'X' }))

    expect(response.status).toBe(400)
    expect(response.data).toEqual({ errors: ['size must be between 3 and 18'] })
  })

  it('rejects a missing lastname', async () => {
    const { lastname: _lastname, ...withoutLastname } = bookingPayload(testRoom.roomid)

    const response = await booking.create(withoutLastname as BookingPayload)

    expect(response.status).toBe(400)
    if (!('errors' in response.data)) {
      throw new Error('Expected a validation error body')
    }
    expect(response.data.errors).toContain('Lastname should not be blank')
  })

  it('rejects an inverted date range', async () => {
    const response = await booking.create(
      bookingPayload(testRoom.roomid, {
        bookingdates: { checkin: '2028-06-10', checkout: '2028-06-05' },
      }),
    )

    expect(response.status).toBe(409)
    expect(response.data).toEqual({ error: 'Failed to create booking' })
  })

  it.fails(
    'rejects a booking for a non-existent room (known RBP defect: creates an orphan)',
    async () => {
      const response = await booking.create(bookingPayload(999_999))

      if ('bookingid' in response.data) {
        createdBookingIds.add(response.data.bookingid)
      }
      expect(response.status).toBe(404)
    },
  )
})

describe('room boundary @negative', () => {
  it('rejects an empty room name', async () => {
    const response = await room.create(roomPayload({ roomName: '' }), token)

    expect(response.status).toBe(400)
    expect(response.data).toEqual({ errors: ['Room name must be set'] })
  })

  it('rejects a non-positive price', async () => {
    const response = await room.create(roomPayload({ roomPrice: -5 }), token)

    expect(response.status).toBe(400)
    expect(response.data).toEqual({ errors: ['must be greater than or equal to 1'] })
  })

  it('rejects an unknown room type', async () => {
    const response = await room.create(roomPayload({ type: 'Palace' as RoomType }), token)

    expect(response.status).toBe(400)
    if (!('errors' in response.data)) {
      throw new Error('Expected a validation error body')
    }
    expect(response.data.errors[0]).toContain('Type can only contain')
  })
})
