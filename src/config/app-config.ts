import { config as loadDotenv } from 'dotenv'
import type { RetryPolicy } from '@client/retry-policy'
import { envSchema } from './env-schema'

export type TestMode = 'live' | 'local'

export interface ServiceUrls {
  readonly auth: string
  readonly room: string
  readonly booking: string
  readonly message: string
  readonly branding: string
  readonly report: string
}

export interface Credentials {
  readonly username: string
  readonly password: string
}

export interface Readiness {
  readonly timeoutMs: number
  readonly intervalMs: number
}

export interface AppConfig {
  readonly mode: TestMode
  readonly timeoutMs: number
  readonly services: ServiceUrls
  readonly credentials: Credentials
  readonly retry: RetryPolicy
  readonly readiness: Readiness
}

export const buildConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration — ${details}`)
  }
  const { data } = parsed
  return {
    mode: data.TEST_MODE,
    timeoutMs: data.TIMEOUT_MS,
    services: {
      auth: data.AUTH_URL,
      room: data.ROOM_URL,
      booking: data.BOOKING_URL,
      message: data.MESSAGE_URL,
      branding: data.BRANDING_URL,
      report: data.REPORT_URL,
    },
    credentials: {
      username: data.ADMIN_USER,
      password: data.ADMIN_PASSWORD,
    },
    retry: {
      maxAttempts: data.RETRY_MAX_ATTEMPTS,
      baseDelayMs: data.RETRY_BASE_DELAY_MS,
      maxDelayMs: data.RETRY_MAX_DELAY_MS,
    },
    readiness: {
      timeoutMs: data.READINESS_TIMEOUT_MS,
      intervalMs: data.READINESS_INTERVAL_MS,
    },
  }
}

let cached: AppConfig | undefined

export const getConfig = (): AppConfig => {
  if (!cached) {
    loadDotenv({ path: process.env.ENV_FILE ?? '.env' })
    cached = buildConfig()
  }
  return cached
}

export const resetConfig = (): void => {
  cached = undefined
}
