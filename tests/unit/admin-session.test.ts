import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@client/api-error'
import type { ApiResponse } from '@client/http-client'
import type { AuthService } from '@services/auth-service'
import { AdminSession } from '@support/admin-session'

const reply = <T>(status: number, data: T): Promise<ApiResponse<T>> =>
  Promise.resolve({ status, headers: {}, data })

const authStub = (validateStatus: number, issuedToken = 'renewed') => {
  const validate = vi.fn(() => reply(validateStatus, { valid: validateStatus === 200 }))
  const login = vi.fn(() => reply(200, { token: issuedToken }))
  const auth = { validate, login } as unknown as AuthService
  return { auth, validate, login }
}

const sessionWith = (auth: AuthService): AdminSession =>
  new AdminSession(() => ({ auth, credentials: { username: 'admin', password: 'password' } }))

describe('AdminSession', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ignores tokens it was not given to manage', async () => {
    const { auth, validate } = authStub(403)
    const session = sessionWith(auth)
    session.adopt('shared')

    await expect(session.recover('someone-elses')).resolves.toBeUndefined()
    expect(validate).not.toHaveBeenCalled()
  })

  it('keeps the token when the platform still accepts it', async () => {
    const { auth, login } = authStub(200)
    const session = sessionWith(auth)
    session.adopt('shared')

    await expect(session.recover('shared')).resolves.toBeUndefined()
    expect(login).not.toHaveBeenCalled()
    expect(session.current('shared')).toBe('shared')
    expect(session.renewals).toBe(0)
  })

  it('re-authenticates once a revoked token fails validation, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { auth, login } = authStub(403)
    const session = sessionWith(auth)
    session.adopt('shared')

    await expect(session.recover('shared')).resolves.toBe('renewed')
    expect(login).toHaveBeenCalledTimes(1)
    expect(session.current('shared')).toBe('renewed')
    expect(session.renewals).toBe(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('validate returned 403'))
  })

  it('keeps the original response when the token check itself fails in transit', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { auth, validate, login } = authStub(403)
    validate.mockRejectedValueOnce(
      new ApiError('Network failure: /auth/validate', { method: 'POST', url: '/auth/validate' }),
    )
    const session = sessionWith(auth)
    session.adopt('shared')

    await expect(session.recover('shared')).resolves.toBeUndefined()
    expect(login).not.toHaveBeenCalled()
    expect(session.current('shared')).toBe('shared')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('kept the original response'))
  })

  it('rethrows an unexpected error from the token check', async () => {
    const { auth, validate } = authStub(403)
    validate.mockRejectedValueOnce(new TypeError('broken'))
    const session = sessionWith(auth)
    session.adopt('shared')

    await expect(session.recover('shared')).rejects.toThrow(TypeError)
  })

  it('shares a single renewal between concurrent rejections', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { auth, login } = authStub(403)
    const session = sessionWith(auth)
    session.adopt('shared')

    const renewed = await Promise.all([session.recover('shared'), session.recover('shared')])

    expect(renewed).toEqual(['renewed', 'renewed'])
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('follows a chain of renewals from the original token', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { auth, login } = authStub(403)
    login.mockReturnValueOnce(reply(200, { token: 'second' }))
    login.mockReturnValueOnce(reply(200, { token: 'third' }))
    const session = sessionWith(auth)
    session.adopt('first')

    await session.recover('first')

    await expect(session.recover('first')).resolves.toBeUndefined()
    await expect(session.recover('second')).resolves.toBe('third')
    expect(session.current('first')).toBe('third')
    expect(session.renewals).toBe(2)
  })

  it('keeps the first adopted token when adopted again', () => {
    const { auth } = authStub(200)
    const session = sessionWith(auth)

    session.adopt('first')
    session.adopt('second')

    expect(session.current('first')).toBe('first')
  })
})
