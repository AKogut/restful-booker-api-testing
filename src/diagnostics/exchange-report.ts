import type { ExchangeDiagnostic } from '@client/request-logger'
import { isTransientStatus } from '@client/retry-policy'

export interface ExchangeReport {
  total: number
  byStatus: Record<string, number>
  failures: ExchangeDiagnostic[]
  retried: number
  transient: ExchangeDiagnostic[]
  byHost: Record<string, { count: number; p95: number }>
  authExchanges: ExchangeDiagnostic[]
  durations: { p50: number; p95: number; max: number }
  slowest: ExchangeDiagnostic[]
}

const isDiagnostic = (value: unknown): value is ExchangeDiagnostic =>
  typeof value === 'object' &&
  value !== null &&
  'method' in value &&
  'url' in value &&
  typeof (value as ExchangeDiagnostic).url === 'string'

export const parseExchanges = (contents: string): ExchangeDiagnostic[] =>
  contents
    .split('\n')
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      try {
        const parsed: unknown = JSON.parse(line)
        return isDiagnostic(parsed) ? [parsed] : []
      } catch {
        return []
      }
    })

const hostOf = (url: string): string => {
  try {
    return new URL(url).host
  } catch {
    return 'unknown'
  }
}

const percentile = (sorted: number[], fraction: number): number => {
  if (sorted.length === 0) {
    return 0
  }
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  return sorted[index] ?? 0
}

const hostStats = (
  exchanges: ExchangeDiagnostic[],
): Record<string, { count: number; p95: number }> => {
  const grouped = new Map<string, number[]>()
  for (const entry of exchanges) {
    const host = hostOf(entry.url)
    const durations = grouped.get(host) ?? []
    if (typeof entry.durationMs === 'number') {
      durations.push(entry.durationMs)
    }
    grouped.set(host, durations)
  }
  return Object.fromEntries(
    [...grouped.entries()].map(([host, durations]) => [
      host,
      {
        count: durations.length,
        p95: percentile(
          [...durations].sort((a, b) => a - b),
          0.95,
        ),
      },
    ]),
  )
}

export const buildReport = (exchanges: ExchangeDiagnostic[], slowestCount = 10): ExchangeReport => {
  const durations = exchanges
    .map((entry) => entry.durationMs)
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b)

  const byStatus: Record<string, number> = {}
  for (const entry of exchanges) {
    const key = entry.status === undefined ? 'transport-error' : String(entry.status)
    byStatus[key] = (byStatus[key] ?? 0) + 1
  }

  return {
    total: exchanges.length,
    byStatus,
    failures: exchanges.filter((entry) => entry.error !== undefined),
    retried: exchanges.filter((entry) => (entry.attempt ?? 1) > 1).length,
    transient: exchanges.filter(
      (entry) => entry.status !== undefined && isTransientStatus(entry.status),
    ),
    byHost: hostStats(exchanges),
    authExchanges: exchanges.filter((entry) => entry.url.includes('/auth/')),
    durations: {
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      max: durations.at(-1) ?? 0,
    },
    slowest: [...exchanges]
      .filter((entry) => typeof entry.durationMs === 'number')
      .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
      .slice(0, slowestCount),
  }
}

export const formatReport = (report: ExchangeReport): string => {
  const lines: string[] = []
  const line = (text: string): number => lines.push(text)

  line(`HTTP exchanges: ${report.total}`)
  line(
    `Duration ms — p50 ${report.durations.p50}, p95 ${report.durations.p95}, max ${report.durations.max}`,
  )
  line(`Retried attempts: ${report.retried}`)
  line('')

  line('By status:')
  for (const [status, count] of Object.entries(report.byStatus).sort()) {
    line(`  ${status.padEnd(16)} ${count}`)
  }
  line('')

  line(`Auth exchanges: ${report.authExchanges.length}`)
  for (const entry of report.authExchanges) {
    line(`  ${entry.status ?? entry.error ?? '?'} ${entry.durationMs ?? '?'}ms ${entry.url}`)
  }
  line('')

  line('By host (count, p95 ms):')
  for (const [host, stats] of Object.entries(report.byHost).sort()) {
    line(`  ${host.padEnd(34)} ${String(stats.count).padStart(4)}  ${stats.p95}`)
  }
  line('')

  if (report.transient.length > 0) {
    line(`Transient infrastructure responses (408/425/429/502/503/504): ${report.transient.length}`)
    for (const entry of report.transient) {
      line(`  ${entry.status} ${entry.method} ${entry.url}`)
    }
    line('')
  }

  if (report.failures.length > 0) {
    line(`Transport failures: ${report.failures.length}`)
    for (const entry of report.failures) {
      line(`  ${entry.error} after ${entry.durationMs ?? '?'}ms (attempt ${entry.attempt ?? 1})`)
    }
    line('')
  }

  line('Slowest exchanges:')
  for (const entry of report.slowest) {
    line(
      `  ${String(entry.durationMs).padStart(7)}ms ${entry.status ?? 'ERR'} ${entry.method} ${entry.url}`,
    )
  }

  return lines.join('\n')
}
