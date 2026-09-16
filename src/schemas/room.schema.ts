import { z } from 'zod'
import { ROOM_TYPES } from '@models/room'

export const roomSchema = z.strictObject({
  roomid: z.number().int(),
  roomName: z.string(),
  type: z.enum(ROOM_TYPES),
  accessible: z.boolean(),
  image: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  roomPrice: z.number(),
})

export const roomListSchema = z.strictObject({ rooms: z.array(roomSchema) })
