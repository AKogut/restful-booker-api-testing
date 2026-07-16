export interface ApiErrorDetails {
  method: string
  url: string
  status?: number
  code?: string
  body?: unknown
}

export class ApiError extends Error {
  readonly method: string
  readonly url: string
  readonly status: number | undefined
  readonly code: string | undefined
  readonly body: unknown

  constructor(message: string, details: ApiErrorDetails) {
    super(message)
    this.name = 'ApiError'
    this.method = details.method
    this.url = details.url
    this.status = details.status
    this.code = details.code
    this.body = details.body
  }
}
