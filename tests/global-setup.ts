import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestProject } from 'vitest/node'
import { getConfig } from '@config/app-config'
import { waitForPlatformReady } from '@health/health-check'
import { createServices } from '@services/service-factory'
import { clearRegistry, readRegistry, type TrackedResource } from '@support/run-registry'
import { adminToken } from '@support/session'

declare module 'vitest' {
  export interface ProvidedContext {
    adminToken: string
  }
}

const sweep = async (leftovers: TrackedResource[], token: string): Promise<number> => {
  const { room, booking, message } = createServices()
  const order: TrackedResource['kind'][] = ['booking', 'message', 'room']
  let removed = 0

  for (const kind of order) {
    for (const { id } of leftovers.filter((entry) => entry.kind === kind)) {
      const response =
        kind === 'booking'
          ? await booking.delete(id, token)
          : kind === 'message'
            ? await message.delete(id, token)
            : await room.delete(id, token)
      if (response.status < 400) {
        removed += 1
      }
    }
  }

  return removed
}

export default async function globalSetup(project: TestProject): Promise<() => Promise<void>> {
  if (process.env.HEALTHCHECK !== '1') {
    return () => Promise.resolve()
  }

  await waitForPlatformReady(getConfig())

  const token = await adminToken()
  project.provide('adminToken', token)

  const path = join(mkdtempSync(join(tmpdir(), 'rbp-run-')), 'registry.jsonl')
  writeFileSync(path, '')
  process.env.RUN_REGISTRY = path

  return async () => {
    const tracked = readRegistry(path)
    const removed = tracked.length === 0 ? 0 : await sweep(tracked, token)
    if (removed > 0) {
      console.info(`Swept ${removed} resource(s) left behind by an incomplete suite`)
    }
    clearRegistry(path)
  }
}
