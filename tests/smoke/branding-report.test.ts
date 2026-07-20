import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bookingPayload } from '@factories/booking-factory'
import type { Booking } from '@models/booking'
import type { Room } from '@models/room'
import { createServices } from '@services/service-factory'
import { provisionRoom } from '@support/rooms'
import { adminToken } from '@support/session'

const { branding, report, booking, room } = createServices()

let token: string
let testRoom: Room
let testBooking: Booking

beforeAll(async () => {
  token = await adminToken()
  testRoom = await provisionRoom(room, token)
  const payload = bookingPayload(testRoom.roomid)
  const created = await booking.create(payload)
  if (!('bookingid' in created.data)) {
    throw new Error(`Booking setup failed with status ${created.status}`)
  }
  testBooking = created.data
})

afterAll(async () => {
  await booking.delete(testBooking.bookingid, token)
  await room.delete(testRoom.roomid, token)
})

describe('branding service @smoke', () => {
  it('returns the public branding profile', async () => {
    const response = await branding.get()

    expect(response.status).toBe(200)
    expect(response.data).toMatchObject({
      name: expect.any(String) as string,
      map: { latitude: expect.any(Number) as number, longitude: expect.any(Number) as number },
      contact: { email: expect.any(String) as string },
    })
  })

  it('rejects a branding update without a token', async () => {
    const current = await branding.get()

    const response = await branding.update(current.data)

    expect(response.status).toBe(401)
  })

  it.fails(
    'accepts its own payload back on update (known RBP defect: relative logoUrl fails @URL)',
    async () => {
      const current = await branding.get()

      const response = await branding.update(current.data, token)

      expect(response.status).toBe(202)
    },
  )
})

describe('report service @smoke', () => {
  it('rejects the report without a token', async () => {
    const response = await report.get()

    expect(response.status).toBe(401)
  })

  it('reflects a booking created via the booking service (cross-service)', async () => {
    const response = await report.getByRoom(testRoom.roomid, token)

    expect(response.status).toBe(200)
    if (!('report' in response.data)) {
      throw new Error('Expected a report body')
    }
    expect(response.data.report).toContainEqual({
      start: testBooking.bookingdates.checkin,
      end: testBooking.bookingdates.checkout,
      title: 'Unavailable',
    })
  })
})
