import type { Room } from '@models/room'
import { expectedStatus } from '@profiles/target-profile'
import type { RoomService } from '@services/room-service'
import { roomPayload } from '@factories/room-factory'

export const provisionRoom = async (room: RoomService, token: string): Promise<Room> => {
  const payload = roomPayload()
  const creation = await room.create(payload, token)
  if (creation.status !== expectedStatus('resource.created')) {
    throw new Error(`Room provisioning failed with status ${creation.status}`)
  }
  const listing = await room.list()
  const created = listing.data.rooms.find((candidate) => candidate.roomName === payload.roomName)
  if (created === undefined) {
    throw new Error(`Provisioned room ${payload.roomName} not found in the listing`)
  }
  return created
}
