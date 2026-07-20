import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { roomPayload } from '@factories/room-factory'
import type { RoomPayload } from '@models/room'
import { expectedStatus } from '@profiles/target-profile'
import { createServices } from '@services/service-factory'
import { validationMessages } from '@support/validation'
import roomCases from '../data/room-cases.json'
import { sharedToken } from '../support/session'

interface RoomCase {
  name: string
  overrides: Partial<RoomPayload>
  expected: { status: number; errors?: string[] }
}

const { room } = createServices()
const cases = roomCases as RoomCase[]

let token: string
const createdRoomIds = new Set<number>()

beforeAll(() => {
  token = sharedToken()
})

afterAll(async () => {
  for (const roomid of createdRoomIds) {
    await room.delete(roomid, token)
  }
})

describe('room creation dataset @data-driven', () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))(
    'room case: %s',
    async (_name, testCase) => {
      const payload = roomPayload(testCase.overrides)

      const response = await room.create(payload, token)

      const expected =
        testCase.expected.status === 200
          ? expectedStatus('resource.created')
          : testCase.expected.status
      expect(response.status).toBe(expected)

      if (testCase.expected.errors !== undefined) {
        const messages = validationMessages(response.data)
        if (messages === undefined) {
          throw new Error(
            `Expected a validation error body, received ${JSON.stringify(response.data)}`,
          )
        }
        expect(messages).toEqual(testCase.expected.errors)
        return
      }

      const listing = await room.list()
      const created = listing.data.rooms.find((entry) => entry.roomName === payload.roomName)
      if (created === undefined) {
        throw new Error(`Created room ${payload.roomName} not found in the listing`)
      }
      createdRoomIds.add(created.roomid)
      expect(created).toMatchObject(payload)
    },
  )
})
