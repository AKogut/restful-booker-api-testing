import { describe, expect, it } from 'vitest'
import { expectedStatus, supports } from '@profiles/target-profile'

describe('expectedStatus', () => {
  it('maps a created resource to the status each target returns', () => {
    expect(expectedStatus('resource.created', 'live')).toBe(201)
    expect(expectedStatus('resource.created', 'local')).toBe(201)
  })

  it('maps a rejected credential to the status each target returns', () => {
    expect(expectedStatus('auth.rejected', 'live')).toBe(403)
    expect(expectedStatus('auth.rejected', 'local')).toBe(403)
  })

  it('keeps a status that both targets agree on', () => {
    expect(expectedStatus('authz.forbidden', 'live')).toBe(403)
    expect(expectedStatus('authz.forbidden', 'local')).toBe(403)
  })
})

describe('supports', () => {
  it('reports the token-in-body contract as unsupported on both targets', () => {
    expect(supports('auth.tokenInBody', 'live')).toBe(false)
    expect(supports('auth.tokenInBody', 'local')).toBe(false)
  })

  it('reports documented defects as reproduced on neither target', () => {
    expect(supports('defects.documented', 'live')).toBe(false)
    expect(supports('defects.documented', 'local')).toBe(false)
  })
})
