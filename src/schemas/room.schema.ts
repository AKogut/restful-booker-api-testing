import { z } from 'zod'

export const roomSchema = z
  .object({
    roomid: z.number().int(),
    roomName: z.string(),
    type: z.string(),
    accessible: z.boolean(),
    image: z.string(),
    description: z.string(),
    features: z.array(z.string()),
    roomPrice: z.number(),
  })
  .strict()

export const roomListSchema = z.object({ rooms: z.array(roomSchema) }).strict()
