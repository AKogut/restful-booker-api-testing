import { z } from 'zod'
import { bookingDatesSchema } from './primitives'

export const bookingSchema = z
  .object({
    bookingid: z.number().int(),
    roomid: z.number().int(),
    firstname: z.string(),
    lastname: z.string(),
    depositpaid: z.boolean(),
    bookingdates: bookingDatesSchema,
  })
  .strict()

export const bookingListSchema = z.object({ bookings: z.array(bookingSchema) }).strict()

export const updatedBookingSchema = z
  .object({
    bookingid: z.number().int(),
    booking: bookingSchema,
  })
  .strict()

export const bookingSummarySchema = z
  .object({
    bookings: z.array(z.object({ bookingDates: bookingDatesSchema }).strict()),
  })
  .strict()
