import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
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
  it('reports the defect as present when the correct behaviour is not observed', async () => {
    const verdict = await observeDefect({
      reproduce: () => Promise.resolve(500),
      expectCorrect: (status) => {
        expect(status).toBe(400)
      },
    })

    expect(verdict).toBe('present')
  })

  it('reports the defect as fixed when the correct behaviour is observed', async () => {
    const verdict = await observeDefect({
      reproduce: () => Promise.resolve(400),
      expectCorrect: (status) => {
        expect(status).toBe(400)
      },
    })

    expect(verdict).toBe('fixed')
  })

  it('rethrows a failed reproduction assertion instead of counting it as the defect', async () => {
    const expectCorrect = vi.fn()

    await expect(
      observeDefect({
        reproduce: () => {
          expect(403).toBe(201)
          return Promise.resolve(403)
        },
        expectCorrect,
      }),
    ).rejects.toThrow('expected 403 to be 201')
    expect(expectCorrect).not.toHaveBeenCalled()
  })

  it('rethrows a transport failure instead of counting it as the defect', async () => {
    const timeout = new ApiError('Request timed out: /room', { method: 'POST', url: '/room' })

    await expect(
      observeDefect({ reproduce: () => Promise.reject(timeout), expectCorrect: () => undefined }),
    ).rejects.toThrow('Request timed out: /room')
  })

  it('rethrows an unexpected runtime error instead of counting it as the defect', async () => {
    await expect(
      observeDefect({
        reproduce: () => Promise.resolve({}),
        expectCorrect: () => {
          throw new TypeError("Cannot use 'in' operator")
        },
      }),
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
