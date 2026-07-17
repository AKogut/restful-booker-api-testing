import { describe, expect, it } from 'vitest'
import { assertValid, bookingSchema, roomSchema } from '@schemas/index'

const validRoom = {
  roomid: 1,
  roomName: '101',
  type: 'Single',
  accessible: true,
  image: '/images/room1.jpg',
  description: 'A room',
  features: ['WiFi'],
  roomPrice: 100,
}

describe('assertValid', () => {
  it('returns the typed value for valid data', () => {
    const room = assertValid(roomSchema, validRoom)

    expect(room.roomid).toBe(1)
  })

  it('reports the offending path and value on failure', () => {
    const invalid = { ...validRoom, roomPrice: 'expensive' }

    expect(() => assertValid(roomSchema, invalid)).toThrowError(/roomPrice/)
  })

  it('rejects unexpected fields under strict schemas', () => {
    const drifted = { ...validRoom, surprise: true }

    expect(() => assertValid(roomSchema, drifted)).toThrowError(/surprise/)
  })

  it('rejects malformed ISO dates', () => {
    const booking = {
      bookingid: 1,
      roomid: 1,
      firstname: 'James',
      lastname: 'Dean',
      depositpaid: true,
      bookingdates: { checkin: '2026/02/01', checkout: '2026-02-05' },
    }

    expect(() => assertValid(bookingSchema, booking)).toThrowError(/checkin/)
  })
})
