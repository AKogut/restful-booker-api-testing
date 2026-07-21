import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Room, RoomPayload } from '@models/room'
import { expectedStatus, supports } from '@profiles/target-profile'
import { createServices } from '@services/service-factory'
import { roomPayload } from '@factories/room-factory'
import { itWhenSupported } from '../support/target'
import { sharedToken } from '../support/session'
import { CreatedResources } from '@support/created-resources'

const { room } = createServices()

let token: string
const createdRoomIds = new CreatedResources('room')

const createRoom = async (payload: RoomPayload): Promise<Room> => {
  const creation = await room.create(payload, token)
  expect(creation.status).toBe(expectedStatus('resource.created'))
  if (supports('auth.describesOutcome')) {
    expect(creation.data).toEqual({ success: true })
  }

  const listing = await room.list()
  const created = listing.data.rooms.find((candidate) => candidate.roomName === payload.roomName)
  if (created === undefined) {
    throw new Error(`Created room ${payload.roomName} not found in the listing`)
  }
  createdRoomIds.add(created.roomid)
  return created
}

beforeAll(() => {
  token = sharedToken()
})

afterAll(async () => {
  for (const roomid of createdRoomIds.all()) {
    await room.delete(roomid, token)
  }
})

describe('room service @smoke', () => {
  it('lists rooms with well-formed entries', async () => {
    const response = await room.list()

    expect(response.status).toBe(200)
    expect(Array.isArray(response.data.rooms)).toBe(true)
    for (const entry of response.data.rooms) {
      expect(entry.roomid).toBeTypeOf('number')
      expect(entry.roomName).toBeTypeOf('string')
    }
  })

  it('creates a room and echoes the payload in the listing', async () => {
    const payload = roomPayload()

    const created = await createRoom(payload)

    expect(created).toMatchObject(payload)
  })

  it('returns a created room by id', async () => {
    const payload = roomPayload()
    const created = await createRoom(payload)

    const response = await room.getById(created.roomid)

    expect(response.status).toBe(200)
    expect(response.data).toMatchObject(payload)
  })

  it('updates a room and persists the changes', async () => {
    const created = await createRoom(roomPayload())
    const updatedPayload = roomPayload({ roomName: created.roomName, roomPrice: 777 })

    const update = await room.update(created.roomid, updatedPayload, token)

    expect(update.status).toBe(202)
    expect(update.data).toMatchObject(updatedPayload)

    const fetched = await room.getById(created.roomid)
    expect(fetched.data).toMatchObject(updatedPayload)
  })

  it('deletes a room and removes it from the listing', async () => {
    const created = await createRoom(roomPayload())

    const deletion = await room.delete(created.roomid, token)
    createdRoomIds.forget(created.roomid)

    expect(deletion.status).toBe(202)

    const listing = await room.list()
    expect(listing.data.rooms.map((entry) => entry.roomid)).not.toContain(created.roomid)
  })

  itWhenSupported('defects.documented').fails(
    'returns 404 for a deleted room (known RBP defect: responds 500)',
    async () => {
      const created = await createRoom(roomPayload())
      await room.delete(created.roomid, token)
      createdRoomIds.forget(created.roomid)

      const response = await room.getById(created.roomid)

      expect(response.status).toBe(404)
    },
  )

  it('rejects room creation without a token', async () => {
    const response = await room.create(roomPayload())

    expect(response.status).toBe(expectedStatus('authz.missingToken'))
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ errors: ['Authentication required'] })
    }
  })

  it('rejects room deletion without a token', async () => {
    const created = await createRoom(roomPayload())

    const response = await room.delete(created.roomid)

    expect(response.status).toBe(expectedStatus('authz.forbidden'))
  })
})
