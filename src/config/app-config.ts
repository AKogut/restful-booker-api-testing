import { config as loadDotenv } from 'dotenv'
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

export interface AppConfig {
  readonly mode: TestMode
  readonly timeoutMs: number
  readonly services: ServiceUrls
  readonly credentials: Credentials
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
  }
}

let cached: AppConfig | undefined

export const getConfig = (): AppConfig => {
  if (!cached) {
    loadDotenv()
    cached = buildConfig()
  }
  return cached
}

export const resetConfig = (): void => {
  cached = undefined
}
