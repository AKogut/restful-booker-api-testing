export type RoomType = 'Single' | 'Twin' | 'Double' | 'Family' | 'Suite'

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
