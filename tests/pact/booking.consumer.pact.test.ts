import { MatchersV3 } from '@pact-foundation/pact'
import { describe, expect, it } from 'vitest'
import { expectedStatus } from '@profiles/target-profile'
import { assertValid } from '@schemas/assert'
import { bookingListSchema, bookingSchema } from '@schemas/booking.schema'
import { BookingService } from '@services/booking-service'
import { createdBooking } from '@support/bookings'
import { CONTRACT_TARGET, PROVIDER, clientFor, contractWith } from './support/contract'
import { PROVIDER_STATE } from './support/provider-states'

const { boolean, date, eachLike, fromProviderState, integer, like, string } = MatchersV3

const bookingDates = {
  checkin: date('yyyy-MM-dd', '2026-02-01'),
  checkout: date('yyyy-MM-dd', '2026-02-05'),
}

const bookingTemplate = {
  bookingid: integer(1),
  roomid: integer(1),
  firstname: string('James'),
  lastname: string('Dean'),
  depositpaid: boolean(true),
  bookingdates: bookingDates,
}

const bookingPayload = {
  firstname: 'Ada',
  lastname: 'Lovelace',
  depositpaid: true,
  email: 'ada@example.com',
  phone: '01234567890',
  bookingdates: { checkin: '2027-01-01', checkout: '2027-01-05' },
}

const token = 'aBcD1234eFgH5678'
const sessionCookie = fromProviderState('token=${token}', `token=${token}`)

describe('rbp-booking contract', () => {
  it('lists the bookings held against a room', async () => {
    const contract = contractWith(PROVIDER.booking)
      .given(PROVIDER_STATE.bookedRoom)
      .uponReceiving('a request for the bookings of one room')
      .withRequest({
        method: 'GET',
        path: '/',
        query: { roomid: fromProviderState('${roomid}', '1') },
        headers: { Cookie: sessionCookie },
      })
      .willRespondWith({
        status: 200,
        contentType: 'application/json',
        body: { bookings: eachLike(bookingTemplate) },
      })

    await contract.executeTest(async (server) => {
      const response = await new BookingService(clientFor(server)).list(1, token)

      expect(response.status).toBe(200)
      expect(assertValid(bookingListSchema, response.data).bookings).not.toHaveLength(0)
    })
  })

  it('returns a single booking by its identifier', async () => {
    const contract = contractWith(PROVIDER.booking)
      .given(PROVIDER_STATE.bookedRoom)
      .uponReceiving('a request for one booking')
      .withRequest({
        method: 'GET',
        path: fromProviderState('/${bookingid}', '/1'),
        headers: { Cookie: sessionCookie },
      })
      .willRespondWith({
        status: 200,
        contentType: 'application/json',
        body: like(bookingTemplate),
      })

    await contract.executeTest(async (server) => {
      const response = await new BookingService(clientFor(server)).getById(1, token)

      expect(response.status).toBe(200)
      expect(assertValid(bookingSchema, response.data).bookingid).toBe(1)
    })
  })

  it('creates a booking against an existing room', async () => {
    const contract = contractWith(PROVIDER.booking)
      .given(PROVIDER_STATE.roomExists)
      .uponReceiving('a booking creation for an existing room')
      .withRequest({
        method: 'POST',
        path: '/',
        contentType: 'application/json',
        body: { ...bookingPayload, roomid: fromProviderState('${roomid}', 1) },
      })
      .willRespondWith({
        status: expectedStatus('booking.created', CONTRACT_TARGET),
        contentType: 'application/json',
        body: {
          bookingid: integer(4),
          booking: like({
            ...bookingTemplate,
            firstname: string(bookingPayload.firstname),
            lastname: string(bookingPayload.lastname),
          }),
        },
      })

    await contract.executeTest(async (server) => {
      const response = await new BookingService(clientFor(server)).create({
        ...bookingPayload,
        roomid: 1,
      })

      expect(response.status).toBe(expectedStatus('booking.created', CONTRACT_TARGET))
      expect(assertValid(bookingSchema, createdBooking(response.data)).firstname).toBe(
        bookingPayload.firstname,
      )
    })
  })
})
