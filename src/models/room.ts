export const ROOM_TYPES = ['Single', 'Twin', 'Double', 'Family', 'Suite'] as const

export type RoomType = (typeof ROOM_TYPES)[number]

export const ROOM_FEATURES = ['TV', 'WiFi', 'Safe', 'Radio', 'Views'] as const

export interface Room {
  roomid: number
  roomName: string
  type: RoomType
  accessible: boolean
  image: string
  description: string
  features: string[]
  roomPrice: number
}

export type RoomPayload = Omit<Room, 'roomid'>

export interface RoomList {
  rooms: Room[]
}
