import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { messagePayload } from '@factories/message-factory'
import type { MessagePayload } from '@models/message'
import { createServices } from '@services/service-factory'
import { adminToken } from '@support/session'
import { expectedStatus, supports } from '@profiles/target-profile'
import { itWhenSupported } from '../support/target'

const { message } = createServices()

let token: string
const createdMessageIds = new Set<number>()

const createMessage = async (payload: MessagePayload): Promise<number> => {
  const creation = await message.create(payload)
  expect(creation.status).toBe(expectedStatus('resource.created'))
  if (supports('auth.describesOutcome')) {
    expect(creation.data).toEqual({ success: true })
  }

  const listing = await message.list()
  const created = listing.data.messages.find((entry) => entry.subject === payload.subject)
  if (created === undefined) {
    throw new Error(`Created message "${payload.subject}" not found in the inbox`)
  }
  createdMessageIds.add(created.id)
  return created.id
}

beforeAll(async () => {
  token = await adminToken()
})

afterAll(async () => {
  for (const messageid of createdMessageIds) {
    await message.delete(messageid, token)
  }
})

describe('message service @smoke', () => {
  it('accepts a guest contact message', async () => {
    const id = await createMessage(messagePayload())

    expect(id).toBeTypeOf('number')
  })

  it('returns full contact details for a message', async () => {
    const payload = messagePayload()
    const id = await createMessage(payload)

    const response = await message.getById(id)

    expect(response.status).toBe(200)
    expect(response.data).toMatchObject({
      messageid: id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      subject: payload.subject,
      description: payload.description,
    })
  })

  it('exposes a well-formed unread count', async () => {
    const response = await message.unreadCount(token)

    expect(response.status).toBe(200)
    expect(response.data.count).toBeTypeOf('number')
    expect(response.data.count).toBeGreaterThanOrEqual(0)
  })

  it('marks a message as read', async () => {
    const id = await createMessage(messagePayload())
    const readState = async (): Promise<boolean | undefined> => {
      const listing = await message.list()
      return listing.data.messages.find((entry) => entry.id === id)?.read
    }
    expect(await readState()).toBe(false)

    const read = await message.markRead(id, token)

    expect(read.status).toBe(202)
    expect(await readState()).toBe(true)
  })

  it('deletes a message and removes it from the inbox', async () => {
    const id = await createMessage(messagePayload())

    const deletion = await message.delete(id, token)
    createdMessageIds.delete(id)

    expect(deletion.status).toBe(202)

    const listing = await message.list()
    expect(listing.data.messages.map((entry) => entry.id)).not.toContain(id)
  })

  it('rejects marking a message read without a token', async () => {
    const id = await createMessage(messagePayload())

    const response = await message.markRead(id)

    expect(response.status).toBe(403)
  })

  it('rejects deleting a message without a token', async () => {
    const id = await createMessage(messagePayload())

    const response = await message.delete(id)

    expect(response.status).toBe(403)
  })

  itWhenSupported('defects.documented').fails(
    'protects the inbox from anonymous reads (known RBP defect: exposes PII)',
    async () => {
      const id = await createMessage(messagePayload())

      const response = await message.getById(id)

      expect(response.status).toBe(401)
    },
  )
})
