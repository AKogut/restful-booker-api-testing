import { describe, expect, it } from 'vitest'
import { getConfig } from '@config/app-config'
import { expectedStatus, supports } from '@profiles/target-profile'
import { createServices } from '@services/service-factory'
import { adminToken, extractToken } from '@support/session'
import { itWhenSupported } from '../support/target'

const { auth } = createServices()
const { credentials } = getConfig()

describe('auth service @smoke', () => {
  it('issues a token for valid credentials', async () => {
    const response = await auth.login(credentials)

    expect(response.status).toBe(200)
    expect(extractToken(response)).toMatch(/.+/)
  })

  itWhenSupported('auth.tokenInBody')('returns the issued token in the response body', async () => {
    const response = await auth.login(credentials)

    expect(response.data).toEqual({ token: expect.stringMatching(/.+/) as string })
  })

  it('rejects invalid credentials', async () => {
    const response = await auth.login({
      username: credentials.username,
      password: 'wrong-password',
    })

    expect(response.status).toBe(expectedStatus('auth.rejected'))
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ error: 'Invalid credentials' })
    }
  })

  it('confirms an issued token as valid', async () => {
    const token = await adminToken()

    const response = await auth.validate(token)

    expect(response.status).toBe(200)
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ valid: true })
    }
  })

  it('rejects a malformed token', async () => {
    const response = await auth.validate('malformed-token')

    expect(response.status).toBe(expectedStatus('auth.tokenInvalid'))
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ error: 'Invalid token' })
    }
  })

  it('accepts logout for an active token', async () => {
    const token = await adminToken()

    const response = await auth.logout(token)

    expect(response.status).toBe(200)
    if (supports('auth.describesOutcome')) {
      expect(response.data).toEqual({ success: true })
    }
  })

  itWhenSupported('defects.documented').fails(
    'invalidates the token after logout (known RBP defect: token survives)',
    async () => {
      const token = await adminToken()
      await auth.logout(token)

      const response = await auth.validate(token)

      expect(response.status).toBe(expectedStatus('auth.tokenInvalid'))
    },
  )
})
