import { appendFileSync, readFileSync, rmdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'

export type TrackedKind = 'room' | 'booking' | 'message'

export interface TrackedResource {
  kind: TrackedKind
  id: number
}

interface RegistryEvent extends TrackedResource {
  released: boolean
}

const REGISTRY_ENV = 'RUN_REGISTRY'

const isTrackedKind = (value: unknown): value is TrackedKind =>
  value === 'room' || value === 'booking' || value === 'message'

export const registryPath = (): string | undefined => process.env[REGISTRY_ENV]

const append = (event: TrackedResource & { released?: true }): void => {
  const path = registryPath()
  if (path === undefined) {
    return
  }
  appendFileSync(path, `${JSON.stringify(event)}\n`)
}

export const track = (kind: TrackedKind, id: number): void => {
  append({ kind, id })
}

export const release = (kind: TrackedKind, id: number): void => {
  append({ kind, id, released: true })
}

const parseEvent = (line: string): RegistryEvent[] => {
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
      const released = 'released' in entry && entry.released === true
      return [{ kind: entry.kind, id: entry.id, released }]
    }
  } catch {
    return []
  }
  return []
}

export const parseRegistry = (contents: string): TrackedResource[] => {
  const outstanding = new Map<string, TrackedResource>()
  for (const line of contents.split('\n').filter((candidate) => candidate.length > 0)) {
    for (const { kind, id, released } of parseEvent(line)) {
      const key = `${kind}:${id}`
      if (released) {
        outstanding.delete(key)
      } else if (!outstanding.has(key)) {
        outstanding.set(key, { kind, id })
      }
    }
  }
  return [...outstanding.values()]
}

export const readRegistry = (path: string): TrackedResource[] => {
  try {
    return parseRegistry(readFileSync(path, 'utf8'))
  } catch {
    return []
  }
}

export const clearRegistry = (path: string): void => {
  rmSync(path, { force: true })
  try {
    rmdirSync(dirname(path))
  } catch {
    return
  }
}
