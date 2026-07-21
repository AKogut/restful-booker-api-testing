import type { RoomService } from '@services/room-service'

export const sweepRoomsByPrefix = async (
  room: RoomService,
  token: string,
  prefix: string,
): Promise<void> => {
  const listing = await room.list()
  for (const entry of listing.data.rooms) {
    if (entry.roomName.startsWith(prefix)) {
      await room.delete(entry.roomid, token)
    }
  }
}
