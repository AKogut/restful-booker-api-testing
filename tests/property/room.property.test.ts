import fc from 'fast-check'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { roomFieldsArbitrary } from '@factories/arbitraries'
import { nextRoomName } from '@factories/room-factory'
import type { RoomPayload } from '@models/room'
import { createServices } from '@services/service-factory'
import { expectedStatus } from '@profiles/target-profile'
import { sharedToken } from '../support/session'
import { CreatedResources } from '@support/created-resources'

const { room } = createServices()

const RUNS = 6

let token: string
const createdRoomIds = new CreatedResources('room')

beforeAll(() => {
  token = sharedToken()
})

afterAll(async () => {
  for (const roomid of createdRoomIds.all()) {
    await room.delete(roomid, token)
  }
})

describe('room properties @property', () => {
  it('round-trips any valid room payload', async () => {
    await fc.assert(
      fc.asyncProperty(roomFieldsArbitrary, async (fields) => {
        const payload: RoomPayload = {
          ...fields,
          roomName: nextRoomName(),
          image: '/images/room2.jpg',
        }

        const created = await room.create(payload, token)
        if (created.status !== expectedStatus('resource.created')) {
          throw new Error(
            `Create failed with ${created.status}: ${JSON.stringify(created.data)} for ${JSON.stringify(payload)}`,
          )
        }

        const listing = await room.list()
        const match = listing.data.rooms.find((entry) => entry.roomName === payload.roomName)
        if (match === undefined) {
          throw new Error(`Created room ${payload.roomName} not found in the listing`)
        }
        createdRoomIds.add(match.roomid)

        expect(match).toMatchObject(payload)
      }),
      { numRuns: RUNS, verbose: true },
    )
  })
})
