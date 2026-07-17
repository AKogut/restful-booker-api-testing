import { z } from 'zod'

export const messageSchema = z
  .object({
    messageid: z.number().int(),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    subject: z.string(),
    description: z.string(),
  })
  .strict()

export const messageSummarySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    subject: z.string(),
    read: z.boolean(),
  })
  .strict()

export const messageListSchema = z.object({ messages: z.array(messageSummarySchema) }).strict()

export const unreadCountSchema = z.object({ count: z.number().int() }).strict()
