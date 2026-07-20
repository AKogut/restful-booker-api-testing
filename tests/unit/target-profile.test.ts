import { describe, expect, it } from 'vitest'
import { expectedStatus, supports } from '@profiles/target-profile'

describe('expectedStatus', () => {
  it('maps a created resource to the status each target returns', () => {
    expect(expectedStatus('resource.created', 'live')).toBe(200)
    expect(expectedStatus('resource.created', 'local')).toBe(201)
  })

  it('maps a rejected credential to the status each target returns', () => {
    expect(expectedStatus('auth.rejected', 'live')).toBe(401)
    expect(expectedStatus('auth.rejected', 'local')).toBe(403)
  })

  it('keeps a status that both targets agree on', () => {
    expect(expectedStatus('authz.forbidden', 'live')).toBe(403)
    expect(expectedStatus('authz.forbidden', 'local')).toBe(403)
  })
})

describe('supports', () => {
  it('reports the token-in-body contract as live-only', () => {
    expect(supports('auth.tokenInBody', 'live')).toBe(true)
    expect(supports('auth.tokenInBody', 'local')).toBe(false)
  })

  it('reports documented defects as live-only', () => {
    expect(supports('defects.documented', 'live')).toBe(true)
    expect(supports('defects.documented', 'local')).toBe(false)
  })
})
