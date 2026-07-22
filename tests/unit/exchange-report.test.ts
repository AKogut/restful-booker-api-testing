import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fileExchangeLogger, toDiagnostic } from '@client/request-logger'
import { buildReport, formatReport, parseExchanges } from '@diagnostics/exchange-report'

const exchange = (overrides: Partial<ReturnType<typeof toDiagnostic>> = {}) => ({
  correlationId: 'c1',
  method: 'GET',
  url: 'https://rbp.test/api/room',
  status: 200,
  durationMs: 100,
  ...overrides,
})

const failedExchange = (error: string, durationMs?: number) => ({
  correlationId: 'c1',
  method: 'GET',
  url: 'https://rbp.test/api/room',
  error,
  ...(durationMs === undefined ? {} : { durationMs }),
})

describe('toDiagnostic', () => {
  it('keeps only the fields needed to diagnose a run', () => {
    const diagnostic = toDiagnostic({
      correlationId: 'c1',
      method: 'POST',
      url: 'https://rbp.test/api/auth/login',
      status: 200,
      durationMs: 12.7,
      attempt: 1,
      requestHeaders: { cookie: '***' },
      requestBody: { username: 'admin', password: '***' },
      responseBody: { token: '***' },
    })

    expect(diagnostic).toEqual({
      correlationId: 'c1',
      method: 'POST',
      url: 'https://rbp.test/api/auth/login',
      status: 200,
      durationMs: 13,
      attempt: 1,
    })
  })

  it('drops bodies and headers so no payload reaches the artifact', () => {
    const diagnostic = toDiagnostic({
      correlationId: 'c1',
      method: 'GET',
      url: 'https://rbp.test/api/message',
      status: 200,
      responseBody: { messages: [{ email: 'guest@example.com' }] },
    })

    expect(JSON.stringify(diagnostic)).not.toContain('guest@example.com')
  })

  it('records a transport failure with no status', () => {
    const diagnostic = toDiagnostic({
      correlationId: 'c1',
      method: 'GET',
      url: 'https://rbp.test/api/room',
      error: 'Request timed out',
      attempt: 3,
    })

    expect(diagnostic).toEqual({
      correlationId: 'c1',
      method: 'GET',
      url: 'https://rbp.test/api/room',
      error: 'Request timed out',
      attempt: 3,
    })
  })
})

describe('fileExchangeLogger', () => {
  let path: string

  beforeEach(() => {
    path = join(mkdtempSync(join(tmpdir(), 'exchange-log-')), 'exchanges.jsonl')
    writeFileSync(path, '')
  })

  afterEach(() => {
    delete process.env.HTTP_LOG_FILE
  })

  it('appends one line per exchange when a log file is configured', () => {
    process.env.HTTP_LOG_FILE = path

    fileExchangeLogger(exchange())
    fileExchangeLogger(exchange({ status: 500 }))

    expect(parseExchanges(readFileSync(path, 'utf8'))).toHaveLength(2)
  })

  it('is a no-op when no log file is configured', () => {
    expect(() => fileExchangeLogger(exchange())).not.toThrow()
    expect(readFileSync(path, 'utf8')).toBe('')
  })
})

describe('parseExchanges', () => {
  it('skips a truncated line rather than failing the report', () => {
    const contents = `${JSON.stringify(exchange())}\n{"method":"GET","ur\n${JSON.stringify(exchange())}\n`

    expect(parseExchanges(contents)).toHaveLength(2)
  })

  it('returns nothing for an empty log', () => {
    expect(parseExchanges('')).toEqual([])
  })
})

describe('buildReport', () => {
  it('counts exchanges by status and flags transport errors separately', () => {
    const report = buildReport([
      exchange(),
      exchange({ status: 500 }),
      failedExchange('Request timed out'),
    ])

    expect(report.total).toBe(3)
    expect(report.byStatus['200']).toBe(1)
    expect(report.byStatus['500']).toBe(1)
    expect(report.byStatus['transport-error']).toBe(1)
    expect(report.failures).toHaveLength(1)
  })

  it('counts transient infrastructure responses but not expected 4xx', () => {
    const report = buildReport([
      exchange({ status: 429 }),
      exchange({ status: 503 }),
      exchange({ status: 403 }),
      exchange({ status: 401 }),
    ])

    expect(report.transient.map((entry) => entry.status)).toEqual([429, 503])
  })

  it('separates hosts so loopback stubs do not distort live timings', () => {
    const report = buildReport([
      exchange({ url: 'https://rbp.test/api/room', durationMs: 900 }),
      exchange({ url: 'http://127.0.0.1:5000/forbidden', durationMs: 2 }),
    ])

    expect(Object.keys(report.byHost).sort()).toEqual(['127.0.0.1:5000', 'rbp.test'])
    expect(report.byHost['rbp.test']?.count).toBe(1)
  })

  it('reports auth exchanges separately', () => {
    const report = buildReport([
      exchange({ url: 'https://rbp.test/api/auth/login', method: 'POST' }),
    ])

    expect(report.authExchanges).toHaveLength(1)
  })

  it('reports duration percentiles and the slowest exchanges first', () => {
    const report = buildReport(
      [10, 20, 30, 40, 50].map((durationMs) => exchange({ durationMs })),
      2,
    )

    expect(report.durations.max).toBe(50)
    expect(report.durations.p50).toBe(30)
    expect(report.slowest.map((entry) => entry.durationMs)).toEqual([50, 40])
  })

  it('counts retried attempts', () => {
    const report = buildReport([exchange(), exchange({ attempt: 2 }), exchange({ attempt: 3 })])

    expect(report.retried).toBe(2)
  })
})

describe('formatReport', () => {
  it('names the totals, auth calls and slowest exchanges', () => {
    const output = formatReport(
      buildReport([
        failedExchange('Request timed out', 30_005),
        exchange({ url: 'https://rbp.test/api/auth/login', method: 'POST' }),
      ]),
    )

    expect(output).toContain('HTTP exchanges: 2')
    expect(output).toContain('Auth exchanges: 1')
    expect(output).toContain('Transport failures: 1')
    expect(output).toContain('Request timed out')
  })
})
