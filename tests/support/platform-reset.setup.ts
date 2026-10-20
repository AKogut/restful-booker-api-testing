import { afterAll, beforeAll, beforeEach, expect } from 'vitest'
import { getConfig } from '@config/app-config'
import { createServices } from '@services/service-factory'
import { PlatformResetDetector } from '@support/platform-reset'
import { recordResetRetry, resetDatabases } from '@support/reset-retries'
import { reestablishFixtures } from './fixtures'
import { sharedToken } from './session'

const OFFLINE_LAYERS = ['/tests/unit/', '/tests/pact/']

const NOT_RETRIED_WITHOUT_RESET =
  'Not retried: no platform database reset was detected since this file started, so the failure above is the result'

const NOT_RETRIED_OFFLINE =
  'Not retried: this file does not run against the live platform, so the failure above is the result'

const detectsResets = (testPath: string | undefined): boolean =>
  process.env.HEALTHCHECK === '1' &&
  testPath !== undefined &&
  !OFFLINE_LAYERS.some((layer) => testPath.includes(layer)) &&
  getConfig().mode === 'live'

let detector: PlatformResetDetector | undefined

beforeAll(async () => {
  if (!detectsResets(expect.getState().testPath)) {
    return
  }
  detector = new PlatformResetDetector(createServices(), sharedToken)
  await detector.arm()
})

afterAll(async () => {
  await detector?.disarm()
})

beforeEach(async ({ task }) => {
  if ((task.result?.retryCount ?? 0) === 0) {
    return
  }
  if (detector === undefined) {
    throw new Error(NOT_RETRIED_OFFLINE)
  }
  const reset = await detector.resetServices()
  if (reset.length === 0) {
    throw new Error(NOT_RETRIED_WITHOUT_RESET)
  }
  console.warn(
    `The platform reset its ${resetDatabases(reset)} during "${task.name}"; re-provisioned this file's fixtures and retried the test once`,
  )
  recordResetRetry({ test: `${task.file.name} > ${task.name}`, services: reset })
  await reestablishFixtures()
})
