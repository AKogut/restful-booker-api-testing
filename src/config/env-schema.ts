import { z } from 'zod'

const serviceUrl = z.string().url()

export const envSchema = z.object({
  TEST_MODE: z.enum(['live', 'local']).default('live'),
  TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  AUTH_URL: serviceUrl,
  ROOM_URL: serviceUrl,
  BOOKING_URL: serviceUrl,
  MESSAGE_URL: serviceUrl,
  BRANDING_URL: serviceUrl,
  REPORT_URL: serviceUrl,
  ADMIN_USER: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>
