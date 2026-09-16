import { z } from 'zod'

export const messageSchema = z.strictObject({
  messageid: z.number().int(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  subject: z.string(),
  description: z.string(),
})

export const messageSummarySchema = z.strictObject({
  id: z.number().int(),
  name: z.string(),
  subject: z.string(),
  read: z.boolean(),
})

export const messageListSchema = z.strictObject({ messages: z.array(messageSummarySchema) })

export const unreadCountSchema = z.strictObject({ count: z.number().int() })
