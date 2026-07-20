import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearRegistry, parseRegistry, readRegistry, track } from '@support/run-registry'

let path: string

beforeEach(() => {
  path = join(mkdtempSync(join(tmpdir(), 'registry-test-')), 'registry.jsonl')
  writeFileSync(path, '')
  process.env.RUN_REGISTRY = path
})

afterEach(() => {
  clearRegistry(path)
  delete process.env.RUN_REGISTRY
})

describe('track', () => {
  it('appends every tracked resource as one line', () => {
    track('room', 1)
    track('booking', 2)

    expect(readFileSync(path, 'utf8')).toBe('{"kind":"room","id":1}\n{"kind":"booking","id":2}\n')
  })

  it('is a no-op when no registry is configured', () => {
    delete process.env.RUN_REGISTRY

    expect(() => track('room', 1)).not.toThrow()
    expect(readFileSync(path, 'utf8')).toBe('')
  })
})

describe('readRegistry', () => {
  it('reads back everything that was tracked', () => {
    track('room', 1)
    track('message', 9)

    expect(readRegistry(path)).toEqual([
      { kind: 'room', id: 1 },
      { kind: 'message', id: 9 },
    ])
  })

  it('returns nothing for a registry that was never created', () => {
    expect(readRegistry(join(tmpdir(), 'does-not-exist.jsonl'))).toEqual([])
  })
})

describe('parseRegistry', () => {
  it('ignores blank lines', () => {
    expect(parseRegistry('{"kind":"room","id":1}\n\n')).toEqual([{ kind: 'room', id: 1 }])
  })

  it('skips a truncated line rather than failing the sweep', () => {
    const contents = '{"kind":"room","id":1}\n{"kind":"booking","i\n{"kind":"message","id":3}\n'

    expect(parseRegistry(contents)).toEqual([
      { kind: 'room', id: 1 },
      { kind: 'message', id: 3 },
    ])
  })

  it('rejects entries with an unknown kind or a non-numeric id', () => {
    const contents = '{"kind":"invoice","id":1}\n{"kind":"room","id":"two"}\n{"kind":"room"}\n'

    expect(parseRegistry(contents)).toEqual([])
  })
})

describe('clearRegistry', () => {
  it('removes the file and tolerates being called twice', () => {
    track('room', 1)

    clearRegistry(path)
    clearRegistry(path)

    expect(readRegistry(path)).toEqual([])
  })
})
