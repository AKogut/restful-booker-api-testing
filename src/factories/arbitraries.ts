import fc from 'fast-check'
import type { RoomType } from '@models/room'

const ROOM_TYPES: RoomType[] = ['Single', 'Twin', 'Double', 'Family', 'Suite']
const ROOM_FEATURES = ['TV', 'WiFi', 'Safe', 'Radio', 'Views']

export const personNameArbitrary = fc
  .stringMatching(/^[A-Za-z]{3,18}$/)
  .filter((value) => value.length >= 3 && value.length <= 18)

export const guestArbitrary = fc.record({
  firstname: personNameArbitrary,
  lastname: personNameArbitrary,
  depositpaid: fc.boolean(),
  email: fc.emailAddress(),
  phone: fc.stringMatching(/^[0-9]{11,15}$/),
})

export const stayLengthArbitrary = fc.integer({ min: 1, max: 5 })

export const roomFieldsArbitrary = fc.record({
  type: fc.constantFrom(...ROOM_TYPES),
  accessible: fc.boolean(),
  description: fc.stringMatching(/^[A-Za-z0-9 ]{1,60}$/),
  features: fc.uniqueArray(fc.constantFrom(...ROOM_FEATURES), { minLength: 0, maxLength: 5 }),
  roomPrice: fc.integer({ min: 1, max: 999 }),
})
