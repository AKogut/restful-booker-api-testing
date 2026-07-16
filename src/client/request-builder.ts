import type { Method } from 'axios'
import type { ApiRequest } from './http-client'

export class RequestBuilder {
  private readonly headers: Record<string, string> = {}
  private readonly query: Record<string, string | number | boolean> = {}
  private body: unknown

  private constructor(
    private readonly method: Method,
    private readonly path: string,
  ) {}

  static get(path: string): RequestBuilder {
    return new RequestBuilder('GET', path)
  }

  static post(path: string): RequestBuilder {
    return new RequestBuilder('POST', path)
  }

  static put(path: string): RequestBuilder {
    return new RequestBuilder('PUT', path)
  }

  static delete(path: string): RequestBuilder {
    return new RequestBuilder('DELETE', path)
  }

  withHeader(name: string, value: string): this {
    this.headers[name] = value
    return this
  }

  withQuery(name: string, value: string | number | boolean): this {
    this.query[name] = value
    return this
  }

  withBody(body: unknown): this {
    this.body = body
    return this
  }

  withToken(token: string): this {
    return this.withHeader('Cookie', `token=${token}`)
  }

  build(): ApiRequest {
    return {
      method: this.method,
      path: this.path,
      headers: { ...this.headers },
      query: { ...this.query },
      body: this.body,
    }
  }
}
