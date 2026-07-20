import { appendFileSync, readFileSync, rmSync } from 'node:fs'

export type TrackedKind = 'room' | 'booking' | 'message'

export interface TrackedResource {
  kind: TrackedKind
  id: number
}

const REGISTRY_ENV = 'RUN_REGISTRY'

const isTrackedKind = (value: unknown): value is TrackedKind =>
  value === 'room' || value === 'booking' || value === 'message'

export const registryPath = (): string | undefined => process.env[REGISTRY_ENV]

export const track = (kind: TrackedKind, id: number): void => {
  const path = registryPath()
  if (path === undefined) {
    return
  }
  appendFileSync(path, `${JSON.stringify({ kind, id })}\n`)
}

export const parseRegistry = (contents: string): TrackedResource[] =>
  contents
    .split('\n')
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      try {
        const entry: unknown = JSON.parse(line)
        if (
          typeof entry === 'object' &&
          entry !== null &&
          'kind' in entry &&
          'id' in entry &&
          isTrackedKind(entry.kind) &&
          typeof entry.id === 'number'
        ) {
          return [{ kind: entry.kind, id: entry.id }]
        }
      } catch {
        return []
      }
      return []
    })

export const readRegistry = (path: string): TrackedResource[] => {
  try {
    return parseRegistry(readFileSync(path, 'utf8'))
  } catch {
    return []
  }
}

export const clearRegistry = (path: string): void => {
  rmSync(path, { force: true })
}
