import { describe, expect, it } from 'vitest'
import { buildConfig } from '@config/app-config'

const validEnv = {
  AUTH_URL: 'https://rbp.test/api/auth',
  ROOM_URL: 'https://rbp.test/api/room',
  BOOKING_URL: 'https://rbp.test/api/booking',
  MESSAGE_URL: 'https://rbp.test/api/message',
  BRANDING_URL: 'https://rbp.test/api/branding',
  REPORT_URL: 'https://rbp.test/api/report',
  ADMIN_USER: 'admin',
  ADMIN_PASSWORD: 'password',
}

describe('buildConfig', () => {
  it('builds a typed config from a valid environment', () => {
    const config = buildConfig(validEnv)

    expect(config).toEqual({
      mode: 'live',
      timeoutMs: 30_000,
      services: {
        auth: 'https://rbp.test/api/auth',
        room: 'https://rbp.test/api/room',
        booking: 'https://rbp.test/api/booking',
        message: 'https://rbp.test/api/message',
        branding: 'https://rbp.test/api/branding',
        report: 'https://rbp.test/api/report',
      },
      credentials: { username: 'admin', password: 'password' },
    })
  })

  it('coerces TIMEOUT_MS into a number', () => {
    const config = buildConfig({ ...validEnv, TIMEOUT_MS: '5000' })

    expect(config.timeoutMs).toBe(5000)
  })

  it('accepts the local test mode', () => {
    const config = buildConfig({ ...validEnv, TEST_MODE: 'local' })

    expect(config.mode).toBe('local')
  })

  it('rejects an unknown test mode', () => {
    expect(() => buildConfig({ ...validEnv, TEST_MODE: 'staging' })).toThrowError(/TEST_MODE/)
  })

  it('rejects a malformed service url', () => {
    expect(() => buildConfig({ ...validEnv, ROOM_URL: 'not-a-url' })).toThrowError(/ROOM_URL/)
  })

  it('rejects a non-positive timeout', () => {
    expect(() => buildConfig({ ...validEnv, TIMEOUT_MS: '0' })).toThrowError(/TIMEOUT_MS/)
  })

  it('fails fast naming every missing variable', () => {
    expect(() => buildConfig({})).toThrowError(
      /AUTH_URL.*ROOM_URL.*BOOKING_URL.*MESSAGE_URL.*BRANDING_URL.*REPORT_URL.*ADMIN_USER.*ADMIN_PASSWORD/s,
    )
  })

  it('rejects empty credentials', () => {
    expect(() => buildConfig({ ...validEnv, ADMIN_USER: '' })).toThrowError(/ADMIN_USER/)
  })
})
