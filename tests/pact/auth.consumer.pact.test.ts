import { MatchersV3 } from '@pact-foundation/pact'
import { describe, expect, it } from 'vitest'
import { expectedStatus } from '@profiles/target-profile'
import { AuthService } from '@services/auth-service'
import { extractToken } from '@support/session'
import { CONTRACT_TARGET, PROVIDER, clientFor, contractWith } from './support/contract'
import { PROVIDER_STATE } from './support/provider-states'

const { fromProviderState, regex } = MatchersV3

const credentials = { username: 'admin', password: 'password' }

describe('rbp-auth contract', () => {
  it('answers a valid login with a session cookie', async () => {
    const contract = contractWith(PROVIDER.auth)
      .given(PROVIDER_STATE.adminExists)
      .uponReceiving('a login with valid credentials')
      .withRequest({
        method: 'POST',
        path: '/login',
        contentType: 'application/json',
        body: credentials,
      })
      .willRespondWith({
        status: 200,
        headers: {
          'set-cookie': regex(/token=[^;]+; Path=\//, 'token=aBcD1234eFgH5678; Path=/'),
        },
      })

    await contract.executeTest(async (server) => {
      const response = await new AuthService(clientFor(server)).login(credentials)

      expect(response.status).toBe(200)
      expect(extractToken(response)).toBe('aBcD1234eFgH5678')
    })
  })

  it('rejects a login with the wrong password', async () => {
    const contract = contractWith(PROVIDER.auth)
      .given(PROVIDER_STATE.adminExists)
      .uponReceiving('a login with an incorrect password')
      .withRequest({
        method: 'POST',
        path: '/login',
        contentType: 'application/json',
        body: { username: 'admin', password: 'not-the-password' },
      })
      .willRespondWith({ status: expectedStatus('auth.rejected', CONTRACT_TARGET) })

    await contract.executeTest(async (server) => {
      const response = await new AuthService(clientFor(server)).login({
        username: 'admin',
        password: 'not-the-password',
      })

      expect(response.status).toBe(expectedStatus('auth.rejected', CONTRACT_TARGET))
      expect(extractToken(response)).toBeUndefined()
    })
  })

  it('accepts a token issued by an active session', async () => {
    const contract = contractWith(PROVIDER.auth)
      .given(PROVIDER_STATE.activeSession)
      .uponReceiving('a validation request for a live token')
      .withRequest({
        method: 'POST',
        path: '/validate',
        contentType: 'application/json',
        body: { token: fromProviderState('${token}', 'aBcD1234eFgH5678') },
      })
      .willRespondWith({ status: 200 })

    await contract.executeTest(async (server) => {
      const response = await new AuthService(clientFor(server)).validate('aBcD1234eFgH5678')

      expect(response.status).toBe(200)
    })
  })
})
