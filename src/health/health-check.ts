import { HttpClient } from '@client/http-client'
import { getConfig, type AppConfig, type ServiceUrls } from '@config/app-config'
import type { HealthReport, HealthStatus } from '@models/health'

export interface ServiceHealth {
  service: string
  status: HealthStatus | 'UNREACHABLE'
  healthy: boolean
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
  const results = await checkHealth(config)
  const unhealthy = results.filter((result) => !result.healthy)
  if (unhealthy.length > 0) {
    const summary = unhealthy.map((result) => `${result.service}=${result.status}`).join(', ')
    throw new Error(`Restful Booker Platform is not ready — ${summary}`)
  }
}
