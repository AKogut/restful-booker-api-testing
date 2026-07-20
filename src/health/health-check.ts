import { HttpClient } from '@client/http-client'
import { sleep } from '@client/retry-policy'
import { getConfig, type AppConfig, type ServiceUrls } from '@config/app-config'
import type { HealthReport, HealthStatus } from '@models/health'

export interface ServiceHealth {
  service: string
  status: HealthStatus | 'UNREACHABLE'
  healthy: boolean
}

export type ReadinessReporter = (attempt: number, unhealthy: ServiceHealth[]) => void

const summarize = (results: ServiceHealth[]): string =>
  results.map((result) => `${result.service}=${result.status}`).join(', ')

export const consoleReadinessReporter: ReadinessReporter = (attempt, unhealthy) => {
  console.info(`Waiting for the platform — attempt ${attempt}, ${summarize(unhealthy)}`)
}

const probe = async (baseUrl: string, timeoutMs: number): Promise<ServiceHealth['status']> => {
  const client = new HttpClient({ baseUrl, timeoutMs })
  try {
    const response = await client.request<unknown>({ method: 'GET', path: '/actuator/health' })
    const body = response.data
    if (typeof body === 'object' && body !== null && 'status' in body) {
      return (body as HealthReport).status
    }
    return 'UNREACHABLE'
  } catch {
    return 'UNREACHABLE'
  }
}

export const checkHealth = async (config: AppConfig = getConfig()): Promise<ServiceHealth[]> => {
  const entries = Object.entries(config.services) as [keyof ServiceUrls, string][]
  return Promise.all(
    entries.map(async ([service, baseUrl]) => {
      const status = await probe(baseUrl, config.timeoutMs)
      return { service, status, healthy: status === 'UP' }
    }),
  )
}

export const assertPlatformHealthy = async (config: AppConfig = getConfig()): Promise<void> => {
  const unhealthy = (await checkHealth(config)).filter((result) => !result.healthy)
  if (unhealthy.length > 0) {
    throw new Error(`Restful Booker Platform is not ready — ${summarize(unhealthy)}`)
  }
}

export const waitForPlatformReady = async (
  config: AppConfig = getConfig(),
  report: ReadinessReporter = consoleReadinessReporter,
): Promise<void> => {
  const deadline = Date.now() + config.readiness.timeoutMs

  for (let attempt = 1; ; attempt += 1) {
    const unhealthy = (await checkHealth(config)).filter((result) => !result.healthy)
    if (unhealthy.length === 0) {
      return
    }

    if (Date.now() + config.readiness.intervalMs > deadline) {
      throw new Error(
        `Restful Booker Platform is not ready after ${attempt} attempts within ${config.readiness.timeoutMs} ms — ${summarize(unhealthy)}`,
      )
    }

    report(attempt, unhealthy)
    await sleep(config.readiness.intervalMs)
  }
}
