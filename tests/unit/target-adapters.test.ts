import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@client/http-client'
import type { AuthToken } from '@models/auth'
import type { ErrorResponse } from '@models/common'
import { createdBooking } from '@support/bookings'
import { extractToken } from '@support/session'
import { validationMessages } from '@support/validation'

const response = (
  data: unknown,
  headers: Record<string, string> = {},
): ApiResponse<AuthToken | ErrorResponse> =>
  ({ status: 200, headers, data }) as ApiResponse<AuthToken | ErrorResponse>

describe('extractToken', () => {
  it('reads the token from a JSON body', () => {
    expect(extractToken(response({ token: 'abc123' }))).toBe('abc123')
  })

  it('reads the token from a Set-Cookie header when the body is empty', () => {
    expect(extractToken(response('', { 'set-cookie': 'token=cookie-token; Path=/' }))).toBe(
      'cookie-token',
    )
  })

  it('picks the token cookie out of several cookies', () => {
    const headers = { 'set-cookie': 'session=x; Path=/,token=wanted; Path=/; HttpOnly' }

    expect(extractToken(response('', headers))).toBe('wanted')
  })

  it('returns undefined when neither source carries a token', () => {
    expect(extractToken(response({ error: 'Invalid credentials' }))).toBeUndefined()
    expect(extractToken(response(''))).toBeUndefined()
  })

  it('does not throw on a non-object body', () => {
    expect(() => extractToken(response(''))).not.toThrow()
  })
})

describe('createdBooking', () => {
  const booking = {
    bookingid: 7,
    roomid: 1,
    firstname: 'Ann',
    lastname: 'Lee',
    depositpaid: true,
    bookingdates: { checkin: '2027-01-01', checkout: '2027-01-03' },
  }

  it('returns a flat creation response unchanged', () => {
    expect(createdBooking(booking)).toEqual(booking)
  })

  it('unwraps a nested creation response', () => {
    expect(createdBooking({ bookingid: 7, booking })).toEqual(booking)
  })

  it('returns undefined when creation failed', () => {
    expect(createdBooking({ error: 'Failed to create booking' })).toBeUndefined()
    expect(createdBooking('')).toBeUndefined()
    expect(createdBooking(null)).toBeUndefined()
  })
})

describe('validationMessages', () => {
  it('reads the flat errors array', () => {
    expect(validationMessages({ errors: ['Room name must be set'] })).toEqual([
      'Room name must be set',
    ])
  })

  it('reads fieldErrors when the envelope wraps them', () => {
    const body = {
      error: 'BAD_REQUEST',
      errorCode: 400,
      errorMessage: 'org.springframework… internals',
      fieldErrors: ['must be greater than or equal to 1'],
    }

    expect(validationMessages(body)).toEqual(['must be greater than or equal to 1'])
  })

  it('returns undefined for a body carrying no validation messages', () => {
    expect(validationMessages({ error: 'Authentication required' })).toBeUndefined()
    expect(validationMessages('')).toBeUndefined()
    expect(validationMessages(null)).toBeUndefined()
  })

  it('rejects a non-string array', () => {
    expect(validationMessages({ errors: [1, 2] })).toBeUndefined()
  })
})
