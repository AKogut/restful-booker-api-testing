import { randomUUID } from 'node:crypto'
import axios, { AxiosError, type AxiosInstance, type Method } from 'axios'
import { ApiError } from './api-error'
import { consoleExchangeLogger, redact, redactPayload, type ExchangeLogger } from './request-logger'
import {
  backoffDelay,
  isIdempotent,
  isTransientStatus,
  NO_RETRY,
  sleep,
  type RetryPolicy,
} from './retry-policy'

declare module 'axios' {
  export interface AxiosRequestConfig {
    attempt?: number
  }
}

export interface HttpClientOptions {
  baseUrl: string
  timeoutMs: number
  logger?: ExchangeLogger
  retry?: RetryPolicy
}

export interface ApiRequest {
  method: Method
  path: string
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean>
  body?: unknown
  retry?: RetryPolicy
}

export interface ApiResponse<T> {
  status: number
  headers: Record<string, string>
  data: T
}

interface ExchangeMeta {
  correlationId: string
  startedAt: number
  attempt: number
}

const toHeaderRecord = (headers: object): Record<string, string> =>
  Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]))

export class HttpClient {
  private readonly transport: AxiosInstance
  private readonly baseUrl: string
  private readonly logger: ExchangeLogger
  private readonly retry: RetryPolicy
  private readonly meta = new WeakMap<object, ExchangeMeta>()

  constructor(options: HttpClientOptions) {
    this.logger = options.logger ?? consoleExchangeLogger
    this.retry = options.retry ?? NO_RETRY
    this.baseUrl = options.baseUrl
    this.transport = axios.create({
      baseURL: options.baseUrl,
      timeout: options.timeoutMs,
      validateStatus: () => true,
    })
    this.transport.interceptors.request.use((config) => {
      const correlationId = randomUUID()
      this.meta.set(config, {
        correlationId,
        startedAt: performance.now(),
        attempt: config.attempt ?? 1,
      })
      config.headers.set('x-correlation-id', correlationId)
      return config
    })
    this.transport.interceptors.response.use((response) => {
      const meta = this.meta.get(response.config)
      this.logger({
        correlationId: meta?.correlationId ?? '',
        method: (response.config.method ?? 'get').toUpperCase(),
        url: `${response.config.baseURL ?? ''}${response.config.url ?? ''}`,
        status: response.status,
        durationMs: meta === undefined ? 0 : performance.now() - meta.startedAt,
        attempt: meta?.attempt ?? 1,
        requestHeaders: redact(response.config.headers.toJSON()),
        requestBody: redactPayload(response.config.data),
        responseBody: redact(response.data),
      })
      return response
    })
  }

  async request<T>(request: ApiRequest): Promise<ApiResponse<T>> {
    const policy = request.retry ?? this.retry
    const retryable = policy.maxAttempts > 1 && isIdempotent(request.method)

    for (let attempt = 1; ; attempt += 1) {
      const lastAttempt = !retryable || attempt >= policy.maxAttempts
      try {
        const response = await this.send<T>(request, attempt)
        if (lastAttempt || !isTransientStatus(response.status)) {
          return response
        }
      } catch (error) {
        const apiError = this.normalizeError(error, request)
        this.logFailure(error, request, apiError, attempt)
        if (lastAttempt) {
          throw apiError
        }
      }
      await sleep(backoffDelay(policy, attempt))
    }
  }

  private async send<T>(request: ApiRequest, attempt: number): Promise<ApiResponse<T>> {
    const response = await this.transport.request<T>({
      method: request.method,
      url: request.path,
      data: request.body,
      attempt,
      ...(request.headers === undefined ? {} : { headers: request.headers }),
      ...(request.query === undefined ? {} : { params: request.query }),
    })
    return {
      status: response.status,
      headers: toHeaderRecord({ ...response.headers }),
      data: response.data,
    }
  }

  private logFailure(
    error: unknown,
    request: ApiRequest,
    apiError: ApiError,
    attempt: number,
  ): void {
    const meta =
      error instanceof AxiosError && error.config !== undefined
        ? this.meta.get(error.config)
        : undefined
    this.logger({
      correlationId: meta?.correlationId ?? '',
      method: request.method,
      url: `${this.baseUrl}${request.path}`,
      attempt,
      ...(meta === undefined ? {} : { durationMs: performance.now() - meta.startedAt }),
      error: apiError.message,
    })
  }

  private normalizeError(error: unknown, request: ApiRequest): ApiError {
    const url = `${this.baseUrl}${request.path}`
    if (error instanceof AxiosError) {
      const timedOut = error.code === AxiosError.ECONNABORTED || error.code === 'ETIMEDOUT'
      return new ApiError(timedOut ? `Request timed out: ${url}` : `Network failure: ${url}`, {
        method: request.method,
        url,
        ...(error.code === undefined ? {} : { code: error.code }),
      })
    }
    return new ApiError(`Unexpected transport failure: ${url}`, {
      method: request.method,
      url,
    })
  }
}
