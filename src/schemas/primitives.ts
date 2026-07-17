import { z } from 'zod'

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO date (YYYY-MM-DD)')

export const bookingDatesSchema = z
  .object({
    checkin: isoDate,
    checkout: isoDate,
  })
  .strict()
