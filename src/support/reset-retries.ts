import { appendFileSync, readFileSync } from 'node:fs'
import type { ResettableService } from './platform-reset'

export interface ResetRetry {
  test: string
  services: ResettableService[]
}

const RESET_RETRY_LOG_ENV = 'RESET_RETRY_LOG'

const isResettableService = (value: unknown): value is ResettableService =>
  value === 'room' || value === 'booking' || value === 'message'

export const resetRetryLogPath = (): string | undefined => process.env[RESET_RETRY_LOG_ENV]

export const useResetRetryLog = (path: string): void => {
  process.env[RESET_RETRY_LOG_ENV] = path
}

export const recordResetRetry = (retry: ResetRetry): void => {
  const path = resetRetryLogPath()
  if (path === undefined) {
    return
  }
  appendFileSync(path, `${JSON.stringify(retry)}\n`)
}

const parseRetry = (line: string): ResetRetry[] => {
  try {
    const entry: unknown = JSON.parse(line)
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'test' in entry &&
      'services' in entry &&
      typeof entry.test === 'string' &&
      Array.isArray(entry.services) &&
      entry.services.every(isResettableService)
    ) {
      return [{ test: entry.test, services: entry.services }]
    }
  } catch {
    return []
  }
  return []
}

export const parseResetRetries = (contents: string): ResetRetry[] =>
  contents
    .split('\n')
    .filter((line) => line.length > 0)
    .flatMap(parseRetry)

export const readResetRetries = (path: string): ResetRetry[] => {
  try {
    return parseResetRetries(readFileSync(path, 'utf8'))
  } catch {
    return []
  }
}

export const resetDatabases = (services: readonly ResettableService[]): string => {
  const unique = [...new Set(services)]
  if (unique.length <= 1) {
    return `${unique.join('')} database`
  }
  return `${unique.slice(0, -1).join(', ')} and ${unique.at(-1) ?? ''} databases`
}

export const describeResetRetries = (retries: readonly ResetRetry[]): string | undefined => {
  if (retries.length === 0) {
    return undefined
  }
  const databases = resetDatabases(retries.flatMap((retry) => retry.services))
  const tests = retries.map((retry) => `  - ${retry.test}`).join('\n')
  return `Retried ${retries.length} test(s) once after the platform reset its ${databases} mid-run:\n${tests}`
}
