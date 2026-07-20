const REDACTED = '***'

const SENSITIVE_KEYS = new Set(['password', 'token', 'authorization', 'cookie', 'set-cookie'])

export const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redact)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) =>
        SENSITIVE_KEYS.has(key.toLowerCase()) ? [key, REDACTED] : [key, redact(entry)],
      ),
    )
  }
  return value
}

export const redactPayload = (payload: unknown): unknown => {
  if (typeof payload === 'string') {
    try {
      return redact(JSON.parse(payload))
    } catch {
      return payload
    }
  }
  return redact(payload)
}

export interface ExchangeLogEntry {
  correlationId: string
  method: string
  url: string
  status?: number
  durationMs?: number
  attempt?: number
  requestHeaders?: unknown
  requestBody?: unknown
  responseBody?: unknown
  error?: string
}

export type ExchangeLogger = (entry: ExchangeLogEntry) => void

export const consoleExchangeLogger: ExchangeLogger = (entry) => {
  if (process.env.HTTP_LOG === 'true') {
    console.info(JSON.stringify(entry))
  }
}
