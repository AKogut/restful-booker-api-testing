import { fileURLToPath } from 'node:url'
import { PactV3, SpecificationVersion, type V3MockServer } from '@pact-foundation/pact'
import { HttpClient } from '@client/http-client'
import { NO_RETRY } from '@client/retry-policy'
import type { TestMode } from '@config/app-config'

export const CONSUMER = 'rbp-api-tests'

export const CONTRACT_TARGET: TestMode = 'local'

export const PROVIDER = {
  auth: 'rbp-auth',
  room: 'rbp-room',
  booking: 'rbp-booking',
} as const

export const PACT_DIR = fileURLToPath(new URL('../../../pacts', import.meta.url))

export const contractWith = (provider: string): PactV3 =>
  new PactV3({
    consumer: CONSUMER,
    provider,
    dir: PACT_DIR,
    spec: SpecificationVersion.SPECIFICATION_VERSION_V3,
    logLevel: 'warn',
  })

export const clientFor = (server: V3MockServer): HttpClient =>
  new HttpClient({ baseUrl: server.url, timeoutMs: 10_000, retry: NO_RETRY })
