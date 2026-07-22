import { MatchersV3 } from '@pact-foundation/pact'
import { describe, expect, it } from 'vitest'
import type { RoomPayload } from '@models/room'
import { expectedStatus } from '@profiles/target-profile'
import { assertValid } from '@schemas/assert'
import { roomListSchema, roomSchema } from '@schemas/room.schema'
import { RoomService } from '@services/room-service'
import { CONTRACT_TARGET, PROVIDER, clientFor, contractWith } from './support/contract'
import { PROVIDER_STATE } from './support/provider-states'

const { boolean, eachLike, fromProviderState, integer, like, string } = MatchersV3

const roomTemplate = {
  roomid: integer(1),
  roomName: string('101'),
  type: string('Single'),
  accessible: boolean(true),
  image: string('/images/room1.jpg'),
  description: string('A quiet room overlooking the garden'),
  features: eachLike('WiFi'),
  roomPrice: integer(100),
}

const roomPayload: RoomPayload = {
  roomName: '901',
  type: 'Double',
  accessible: true,
  image: '/images/room2.jpg',
  description: 'A room created by the contract suite',
  features: ['WiFi'],
  roomPrice: 123,
}

describe('rbp-room contract', () => {
  it('lists the rooms the suite provisions against', async () => {
    const contract = contractWith(PROVIDER.room)
      .given(PROVIDER_STATE.roomExists)
      .uponReceiving('a request for every room')
      .withRequest({ method: 'GET', path: '/' })
      .willRespondWith({
        status: 200,
        contentType: 'application/json',
        body: { rooms: eachLike(roomTemplate) },
      })

    await contract.executeTest(async (server) => {
      const response = await new RoomService(clientFor(server)).list()

      expect(response.status).toBe(200)
      expect(assertValid(roomListSchema, response.data).rooms).not.toHaveLength(0)
    })
  })

  it('returns a single room by its identifier', async () => {
    const contract = contractWith(PROVIDER.room)
      .given(PROVIDER_STATE.roomExists)
      .uponReceiving('a request for one room')
      .withRequest({ method: 'GET', path: fromProviderState('/${roomid}', '/1') })
      .willRespondWith({
        status: 200,
        contentType: 'application/json',
        body: like(roomTemplate),
      })

    await contract.executeTest(async (server) => {
      const response = await new RoomService(clientFor(server)).getById(1)

      expect(response.status).toBe(200)
      expect(assertValid(roomSchema, response.data).roomid).toBe(1)
    })
  })

  it('creates a room for an authenticated caller', async () => {
    const contract = contractWith(PROVIDER.room)
      .given(PROVIDER_STATE.activeSession)
      .uponReceiving('a room creation from an authenticated caller')
      .withRequest({
        method: 'POST',
        path: '/',
        contentType: 'application/json',
        headers: { Cookie: fromProviderState('token=${token}', 'token=aBcD1234eFgH5678') },
        body: roomPayload,
      })
      .willRespondWith({
        status: expectedStatus('resource.created', CONTRACT_TARGET),
        contentType: 'application/json',
        body: like({ ...roomTemplate, ...roomPayload, roomid: integer(4) }),
      })

    await contract.executeTest(async (server) => {
      const response = await new RoomService(clientFor(server)).create(
        roomPayload,
        'aBcD1234eFgH5678',
      )

      expect(response.status).toBe(expectedStatus('resource.created', CONTRACT_TARGET))
      expect(assertValid(roomSchema, response.data).roomName).toBe(roomPayload.roomName)
    })
  })
})
