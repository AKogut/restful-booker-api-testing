import { z } from 'zod'

export const brandingSchema = z.strictObject({
  name: z.string(),
  description: z.string(),
  directions: z.string(),
  logoUrl: z.string(),
  map: z.strictObject({
    latitude: z.number(),
    longitude: z.number(),
  }),
  contact: z.strictObject({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
  }),
  address: z.strictObject({
    line1: z.string(),
    line2: z.string(),
    postTown: z.string(),
    county: z.string(),
    postCode: z.string(),
  }),
})
