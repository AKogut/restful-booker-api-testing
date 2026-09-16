import { z } from 'zod'
import { bookingDatesSchema } from './primitives'

export const bookingSchema = z.strictObject({
  bookingid: z.number().int(),
  roomid: z.number().int(),
  firstname: z.string(),
  lastname: z.string(),
  depositpaid: z.boolean(),
  bookingdates: bookingDatesSchema,
})

export const bookingListSchema = z.strictObject({ bookings: z.array(bookingSchema) })

export const updatedBookingSchema = z.strictObject({
  bookingid: z.number().int(),
  booking: bookingSchema,
})

export const bookingSummarySchema = z.strictObject({
  bookings: z.array(z.strictObject({ bookingDates: bookingDatesSchema })),
})
