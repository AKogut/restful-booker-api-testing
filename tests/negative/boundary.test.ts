import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bookingPayload } from '@factories/booking-factory'
import { roomPayload } from '@factories/room-factory'
import type { BookingPayload } from '@models/booking'
import type { RoomType } from '@models/room'
import type { Room } from '@models/room'
import { supports } from '@profiles/target-profile'
import { createServicesWithoutRetry } from '@services/service-factory'
import { validationMessages } from '@support/validation'
import { provisionRoom } from '@support/rooms'
import { sharedToken } from '../support/session'
import { CreatedResources } from '@support/created-resources'
import { itWhenSupported } from '../support/target'
import { createdBooking } from '@support/bookings'

const { room, booking } = createServicesWithoutRetry()

let token: string
let testRoom: Room
const createdBookingIds = new CreatedResources('booking')

beforeAll(async () => {
  token = sharedToken()
  testRoom = await provisionRoom(room, token)
})

afterAll(async () => {
  for (const bookingid of createdBookingIds.all()) {
    await booking.delete(bookingid, token)
  }
  await room.delete(testRoom.roomid, token)
})

describe('booking boundary @negative', () => {
  it('rejects a too-short firstname', async () => {
    const response = await booking.create(bookingPayload(testRoom.roomid, { firstname: 'X' }))

    expect(response.status).toBe(400)
    expect(validationMessages(response.data)).toEqual(['size must be between 3 and 18'])
  })

  it('rejects a missing lastname', async () => {
    const { lastname: _lastname, ...withoutLastname } = bookingPayload(testRoom.roomid)

    const response = await booking.create(withoutLastname as BookingPayload)

    expect(response.status).toBe(400)
    const messages = validationMessages(response.data)
    if (messages === undefined) {
      throw new Error('Expected a validation error body')
    }
    expect(messages).toContain('Lastname should not be blank')
  })

  it('rejects an inverted date range', async () => {
    const response = await booking.create(
      bookingPayload(testRoom.roomid, {
        bookingdates: { checkin: '2028-06-10', checkout: '2028-06-05' },
      }),
    )

    expect(response.status).toBe(409)
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ error: 'Failed to create booking' })
    }
  })

  itWhenSupported('defects.documented').fails(
    'rejects a booking for a non-existent room (known RBP defect: creates an orphan)',
    async () => {
      const response = await booking.create(bookingPayload(999_999))

      const created = createdBooking(response.data)
      if (created !== undefined) {
        createdBookingIds.add(created.bookingid)
      }
      expect(response.status).toBe(404)
    },
  )
})

describe('room boundary @negative', () => {
  it('rejects an empty room name', async () => {
    const response = await room.create(roomPayload({ roomName: '' }), token)

    expect(response.status).toBe(400)
    expect(validationMessages(response.data)).toEqual(['Room name must be set'])
  })

  it('rejects a non-positive price', async () => {
    const response = await room.create(roomPayload({ roomPrice: -5 }), token)

    expect(response.status).toBe(400)
    expect(validationMessages(response.data)).toEqual(['must be greater than or equal to 1'])
  })

  it('rejects an unknown room type', async () => {
    const response = await room.create(roomPayload({ type: 'Palace' as RoomType }), token)

    expect(response.status).toBe(400)
    const messages = validationMessages(response.data)
    if (messages === undefined) {
      throw new Error('Expected a validation error body')
    }
    expect(messages[0]).toContain('Type can only contain')
  })
})
