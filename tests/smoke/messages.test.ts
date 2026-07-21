import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { messagePayload } from '@factories/message-factory'
import type { MessagePayload } from '@models/message'
import { createServices } from '@services/service-factory'
import { expectedStatus, supports } from '@profiles/target-profile'
import { itWhenSupported } from '../support/target'
import { sharedToken } from '../support/session'
import { CreatedResources } from '@support/created-resources'

const { message } = createServices()

let token: string
const createdMessageIds = new CreatedResources('message')

const createMessage = async (payload: MessagePayload): Promise<number> => {
  const creation = await message.create(payload)
  expect(creation.status).toBe(expectedStatus('resource.created'))
  if (supports('auth.describesOutcome')) {
    expect(creation.data).toEqual({ success: true })
  }

  const listing = await message.list(token)
  const created = listing.data.messages.find((entry) => entry.subject === payload.subject)
  if (created === undefined) {
    throw new Error(`Created message "${payload.subject}" not found in the inbox`)
  }
  createdMessageIds.add(created.id)
  return created.id
}

beforeAll(() => {
  token = sharedToken()
})

afterAll(async () => {
  for (const messageid of createdMessageIds.all()) {
    await message.delete(messageid, token)
  }
})

describe('message service @smoke', () => {
  it('accepts a guest contact message and files it in the inbox', async () => {
    const payload = messagePayload()

    const id = await createMessage(payload)

    const listing = await message.list(token)
    expect(listing.data.messages.map((entry) => entry.id)).toContain(id)
  })

  it('returns full contact details to an authenticated reader', async () => {
    const payload = messagePayload()
    const id = await createMessage(payload)

    const response = await message.getById(id, token)

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
      const listing = await message.list(token)
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
    createdMessageIds.forget(id)

    expect(deletion.status).toBe(202)

    const listing = await message.list(token)
    expect(listing.data.messages.map((entry) => entry.id)).not.toContain(id)
  })

  it('rejects marking a message read without a token', async () => {
    const id = await createMessage(messagePayload())

    const response = await message.markRead(id)

    expect(response.status).toBe(expectedStatus('authz.forbidden'))
  })

  it('rejects deleting a message without a token', async () => {
    const id = await createMessage(messagePayload())

    const response = await message.delete(id)

    expect(response.status).toBe(expectedStatus('authz.forbidden'))
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
