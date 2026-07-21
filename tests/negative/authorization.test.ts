import { beforeAll, describe, expect, it } from 'vitest'
import { roomPayload } from '@factories/room-factory'
import type { AuthCredentials } from '@models/auth'
import type { Branding } from '@models/branding'
import { getConfig } from '@config/app-config'
import { expectedStatus, supports, type StatusKey } from '@profiles/target-profile'
import { createServicesWithoutRetry } from '@services/service-factory'
import { itWhenSupported } from '../support/target'

const config = getConfig()
const { auth, room, booking, message, branding, report } = createServicesWithoutRetry(config)
const { credentials } = config

const ANY_ID = 1

const PATIENT_CLIENT_TIMEOUT_MS = 60_000
const PATIENT_TIMEOUT_MS = 70_000

const patient = createServicesWithoutRetry({ ...config, timeoutMs: PATIENT_CLIENT_TIMEOUT_MS })

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

    expect(response.status).toBe(expectedStatus('auth.rejected'))
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ error: 'Invalid credentials' })
    }
  })

  it('rejects a malformed token on validate', async () => {
    const response = await auth.validate('not-a-real-token')

    expect(response.status).toBe(expectedStatus('auth.tokenInvalid'))
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ error: 'Invalid token' })
    }
  })
})

describe('authorization matrix @negative', () => {
  it.each<[string, () => Promise<{ status: number }>, StatusKey]>([
    ['room.create', () => room.create(roomPayload()), 'authz.missingToken'],
    ['room.delete', () => room.delete(ANY_ID), 'authz.forbidden'],
    ['booking.list', () => booking.list(ANY_ID), 'authz.missingToken'],
    ['message.markRead', () => message.markRead(ANY_ID), 'authz.forbidden'],
    ['message.delete', () => message.delete(ANY_ID), 'authz.forbidden'],
    ['branding.update', () => branding.update(currentBranding), 'authz.missingToken.report'],
    ['report.get', () => report.get(), 'authz.missingToken.report'],
  ])('rejects %s without a token', async (_name, call, key) => {
    const response = await call()

    expect(response.status).toBe(expectedStatus(key))
  })

  itWhenSupported('authz.bookingSummary')('rejects booking.summary without a token', async () => {
    const response = await booking.summary(ANY_ID)

    expect(response.status).toBe(expectedStatus('authz.missingToken'))
  })

  it('leaves the anonymized per-room availability report public', async () => {
    const response = await report.getByRoom(ANY_ID)

    expect(response.status).toBe(200)
  })
})

describe('invalid token handling @negative', () => {
  const INVALID_TOKEN = 'garbage-not-a-real-token'

  it.each<[string, () => Promise<{ status: number }>]>([
    ['room.delete', () => room.delete(ANY_ID, INVALID_TOKEN)],
    ['message.delete', () => message.delete(ANY_ID, INVALID_TOKEN)],
  ])('rejects %s carrying an invalid token', async (_name, call) => {
    const response = await call()

    expect(response.status).toBe(expectedStatus('authz.forbidden'))
  })

  itWhenSupported('defects.documented').fails.each<[string, () => Promise<{ status: number }>]>([
    ['room.create', () => room.create(roomPayload(), INVALID_TOKEN)],
    ['booking.list', () => booking.list(ANY_ID, INVALID_TOKEN)],
  ])('rejects %s carrying an invalid token instead of failing (BUG-007)', async (_name, call) => {
    const response = await call()

    expect(response.status).toBe(401)
  })

  itWhenSupported('defects.documented').fails(
    'rejects report.get carrying an invalid token instead of stalling (BUG-009)',
    async () => {
      const response = await patient.report.get(INVALID_TOKEN)

      expect(response.status).toBe(401)
    },
    PATIENT_TIMEOUT_MS,
  )

  itWhenSupported('defects.documented').fails(
    'rejects booking.summary carrying an invalid token (BUG-008)',
    async () => {
      const response = await booking.summary(ANY_ID, INVALID_TOKEN)

      expect(response.status).toBe(401)
    },
  )
})
