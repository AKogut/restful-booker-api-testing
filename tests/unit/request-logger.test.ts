import { describe, expect, it } from 'vitest'
import { redact } from '@client/request-logger'

describe('redact', () => {
  it('masks sensitive keys at any depth', () => {
    const entry = {
      requestHeaders: { Cookie: 'token=abc', accept: 'application/json' },
      requestBody: { username: 'admin', password: 'secret' },
      responseBody: { token: 'abc123', nested: { Authorization: 'Bearer x' } },
    }

    expect(redact(entry)).toEqual({
      requestHeaders: { Cookie: '***', accept: 'application/json' },
      requestBody: { username: 'admin', password: '***' },
      responseBody: { token: '***', nested: { Authorization: '***' } },
    })
  })

  it('masks sensitive keys case-insensitively', () => {
    expect(redact({ PASSWORD: 'x', 'Set-Cookie': 'y' })).toEqual({
      PASSWORD: '***',
      'Set-Cookie': '***',
    })
  })

  it('walks arrays', () => {
    expect(redact([{ token: 'a' }, { token: 'b' }])).toEqual([{ token: '***' }, { token: '***' }])
  })

  it('returns primitives untouched', () => {
    expect(redact('plain')).toBe('plain')
    expect(redact(42)).toBe(42)
    expect(redact(null)).toBeNull()
  })
})
