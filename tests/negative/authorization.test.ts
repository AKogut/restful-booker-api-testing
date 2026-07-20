import { beforeAll, describe, expect, it } from 'vitest'
import { roomPayload } from '@factories/room-factory'
import type { AuthCredentials } from '@models/auth'
import type { Branding } from '@models/branding'
import { getConfig } from '@config/app-config'
import { createServicesWithoutRetry } from '@services/service-factory'

const { auth, room, booking, message, branding, report } = createServicesWithoutRetry()
const { credentials } = getConfig()

const ANY_ID = 1

let currentBranding: Branding

beforeAll(async () => {
  currentBranding = (await branding.get()).data
})

describe('authentication negatives @negative', () => {
  it.each<[string, AuthCredentials]>([
    ['empty credentials', { username: '', password: '' }],
    ['missing password', { username: credentials.username, password: '' }],
    ['unknown username', { username: 'not-a-user', password: credentials.password }],
    ['wrong password', { username: credentials.username, password: 'wrong-password' }],
  ])('rejects login with %s', async (_name, creds) => {
    const response = await auth.login(creds)

    expect(response.status).toBe(401)
    expect(response.data).toEqual({ error: 'Invalid credentials' })
  })

  it('rejects a malformed token on validate', async () => {
    const response = await auth.validate('not-a-real-token')

    expect(response.status).toBe(403)
    expect(response.data).toEqual({ error: 'Invalid token' })
  })
})

describe('authorization matrix @negative', () => {
  it.each<[string, () => Promise<{ status: number }>, number]>([
    ['room.create', () => room.create(roomPayload()), 401],
    ['room.delete', () => room.delete(ANY_ID), 403],
    ['booking.list', () => booking.list(ANY_ID), 401],
    ['booking.summary', () => booking.summary(ANY_ID), 401],
    ['message.markRead', () => message.markRead(ANY_ID), 403],
    ['message.delete', () => message.delete(ANY_ID), 403],
    ['branding.update', () => branding.update(currentBranding), 401],
    ['report.get', () => report.get(), 401],
  ])('rejects %s without a token', async (_name, call, expected) => {
    const response = await call()

    expect(response.status).toBe(expected)
  })

  it('leaves the anonymized per-room availability report public', async () => {
    const response = await report.getByRoom(ANY_ID)

    expect(response.status).toBe(200)
  })
})
