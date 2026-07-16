import { faker } from '@faker-js/faker'
import type { BookingPayload } from '@models/booking'

const DAY_MS = 86_400_000
const runStart = Date.UTC(2027, 0, 1) + faker.number.int({ min: 0, max: 300 }) * DAY_MS
let windowIndex = 0

const isoDate = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10)

const personName = (candidate: string): string => candidate.padEnd(3, 'x').slice(0, 18)

export const nextStayWindow = (nights = 2): { checkin: string; checkout: string } => {
  const checkin = runStart + windowIndex * 7 * DAY_MS
  windowIndex += 1
  return { checkin: isoDate(checkin), checkout: isoDate(checkin + nights * DAY_MS) }
}

export const bookingPayload = (
  roomid: number,
  overrides: Partial<BookingPayload> = {},
): BookingPayload => ({
  roomid,
  firstname: personName(faker.person.firstName()),
  lastname: personName(faker.person.lastName()),
  depositpaid: faker.datatype.boolean(),
  email: faker.internet.email(),
  phone: faker.string.numeric(11),
  bookingdates: nextStayWindow(),
  ...overrides,
})
