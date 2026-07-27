import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bookingPayload } from '@factories/booking-factory'
import { messagePayload } from '@factories/message-factory'
import { roomPayload } from '@factories/room-factory'
import type { BookingPayload } from '@models/booking'
import type { MessagePayload } from '@models/message'
import type { RoomType } from '@models/room'
import type { Room } from '@models/room'
import { supports } from '@profiles/target-profile'
import { createServicesWithoutRetry } from '@services/service-factory'
import { validationMessages } from '@support/validation'
import { provisionRoom } from '@support/rooms'
import { sharedToken } from '../support/session'
import { CreatedResources } from '@support/created-resources'
import { guardsDefect } from '../support/defect-guard'
import { createdBooking } from '@support/bookings'

const { room, booking, message } = createServicesWithoutRetry()

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

  guardsDefect('BUG-005', 'rejects a booking for a non-existent room', async () => {
    const response = await booking.create(bookingPayload(999_999))

    const created = createdBooking(response.data)
    if (created !== undefined) {
      createdBookingIds.add(created.bookingid)
    }
    expect(response.status).toBe(404)
  })
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

describe('message boundary @negative', () => {
  it('rejects a blank name', async () => {
    const response = await message.create(messagePayload({ name: '' }))

    expect(response.status).toBe(400)
    expect(validationMessages(response.data)).toEqual(['Name may not be blank'])
  })

  it('rejects a malformed email', async () => {
    const response = await message.create(messagePayload({ email: 'not-an-email' }))

    expect(response.status).toBe(400)
    expect(validationMessages(response.data)).toEqual(['must be a well-formed email address'])
  })

  it('rejects a too-short subject', async () => {
    const response = await message.create(messagePayload({ subject: 'Hi' }))

    expect(response.status).toBe(400)
    expect(validationMessages(response.data)).toEqual([
      'Subject must be between 5 and 100 characters.',
    ])
  })

  it('rejects a missing description', async () => {
    const { description: _description, ...withoutDescription } = messagePayload()

    const response = await message.create(withoutDescription as MessagePayload)

    expect(response.status).toBe(400)
    const messages = validationMessages(response.data)
    if (messages === undefined) {
      throw new Error('Expected a validation error body')
    }
    expect(messages).toContain('Message must be set')
  })
})
