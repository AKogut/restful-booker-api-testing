import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@client/api-error'
import { DEFECT_REPORTS, defectFixedMessage, observeDefect } from '@support/defect-guard'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const reportsDir = join(repoRoot, 'docs', 'bug-reports')
const testsDir = join(repoRoot, 'tests')

const reportIdsOnDisk = (): string[] =>
  readdirSync(reportsDir)
    .flatMap((name) => /^(BUG-\d{3})-/.exec(name)?.slice(1, 2) ?? [])
    .sort()

const guardedReportIds = (): string[] => {
  const sources = readdirSync(testsDir, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => readFileSync(join(testsDir, name), 'utf8'))
    .join('\n')

  return [...new Set([...sources.matchAll(/guardsDefect\(\s*'(BUG-\d{3})'/g)].map(([, id]) => id))]
    .filter((id): id is string => id !== undefined)
    .sort()
}

describe('observeDefect', () => {
  it('reports the defect as present when the expectation fails', async () => {
    const verdict = await observeDefect(() => {
      expect(500).toBe(400)
      return Promise.resolve()
    })

    expect(verdict).toBe('present')
  })

  it('reports the defect as fixed when the expectation holds', async () => {
    const verdict = await observeDefect(() => {
      expect(400).toBe(400)
      return Promise.resolve()
    })

    expect(verdict).toBe('fixed')
  })

  it('rethrows a transport failure instead of counting it as the defect', async () => {
    const timeout = new ApiError('Request timed out: /room', { method: 'POST', url: '/room' })

    await expect(observeDefect(() => Promise.reject(timeout))).rejects.toThrow(
      'Request timed out: /room',
    )
  })

  it('rethrows an unexpected runtime error instead of counting it as the defect', async () => {
    await expect(
      observeDefect(() => Promise.reject(new TypeError("Cannot use 'in' operator"))),
    ).rejects.toThrow(TypeError)
  })

  it('names the report when a defect stops reproducing', () => {
    expect(defectFixedMessage('BUG-007')).toContain('BUG-007')
  })
})

describe('report-to-guard parity', () => {
  it('declares exactly the reports that exist on disk', () => {
    expect([...DEFECT_REPORTS].sort()).toEqual(reportIdsOnDisk())
  })

  it('guards every declared report', () => {
    expect(guardedReportIds()).toEqual([...DEFECT_REPORTS].sort())
  })
})
