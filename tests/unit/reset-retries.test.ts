import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  describeResetRetries,
  parseResetRetries,
  resetDatabases,
  readResetRetries,
  recordResetRetry,
  resetRetryLogPath,
  useResetRetryLog,
} from '@support/reset-retries'

let path: string

beforeEach(() => {
  path = join(mkdtempSync(join(tmpdir(), 'reset-retries-test-')), 'reset-retries.jsonl')
  writeFileSync(path, '')
})

afterEach(() => {
  rmSync(dirname(path), { recursive: true, force: true })
  delete process.env.RESET_RETRY_LOG
})

describe('recordResetRetry', () => {
  it('appends every granted retry to the run log', () => {
    useResetRetryLog(path)

    recordResetRetry({ test: 'a.test.ts > first', services: ['booking'] })
    recordResetRetry({ test: 'b.test.ts > second', services: ['room', 'message'] })

    expect(readResetRetries(path)).toEqual([
      { test: 'a.test.ts > first', services: ['booking'] },
      { test: 'b.test.ts > second', services: ['room', 'message'] },
    ])
  })

  it('is a no-op when no run log is configured', () => {
    expect(resetRetryLogPath()).toBeUndefined()
    expect(() => recordResetRetry({ test: 'a', services: ['room'] })).not.toThrow()
    expect(readResetRetries(path)).toEqual([])
  })
})

describe('parseResetRetries', () => {
  it('skips lines that are not a recorded retry', () => {
    const contents = [
      '{"test":"kept","services":["room"]}',
      'not json',
      '{"test":"unknown service","services":["auth"]}',
      '{"services":["room"]}',
      '',
    ].join('\n')

    expect(parseResetRetries(contents)).toEqual([{ test: 'kept', services: ['room'] }])
  })
})

describe('readResetRetries', () => {
  it('returns nothing for a log that does not exist', () => {
    expect(readResetRetries(join(dirname(path), 'missing.jsonl'))).toEqual([])
  })
})

describe('resetDatabases', () => {
  it('names a single database', () => {
    expect(resetDatabases(['booking'])).toBe('booking database')
  })

  it('lists several databases once each', () => {
    expect(resetDatabases(['room', 'booking', 'room', 'message'])).toBe(
      'room, booking and message databases',
    )
  })
})

describe('describeResetRetries', () => {
  it('stays silent when nothing was retried', () => {
    expect(describeResetRetries([])).toBeUndefined()
  })

  it('names every retried test and each reset service once', () => {
    const summary = describeResetRetries([
      { test: 'a.test.ts > first', services: ['booking'] },
      { test: 'b.test.ts > second', services: ['booking', 'room'] },
    ])

    expect(summary).toBe(
      [
        'Retried 2 test(s) once after the platform reset its booking and room databases mid-run:',
        '  - a.test.ts > first',
        '  - b.test.ts > second',
      ].join('\n'),
    )
  })
})
