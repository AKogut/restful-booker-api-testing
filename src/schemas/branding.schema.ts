import { z } from 'zod'

export const brandingSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    directions: z.string(),
    logoUrl: z.string(),
    map: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
      })
      .strict(),
    contact: z
      .object({
        name: z.string(),
        email: z.string(),
        phone: z.string(),
      })
      .strict(),
    address: z
      .object({
        line1: z.string(),
        line2: z.string(),
        postTown: z.string(),
        county: z.string(),
        postCode: z.string(),
      })
      .strict(),
  })
  .strict()
