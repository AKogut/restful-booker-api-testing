import type { ApiResponse, HttpClient } from '@client/http-client'
import { RequestBuilder } from '@client/request-builder'
import type { AuthCredentials, AuthToken, LogoutResult, TokenValidation } from '@models/auth'
import type { ErrorResponse } from '@models/common'

export class AuthService {
  constructor(private readonly client: HttpClient) {}

  async login(credentials: AuthCredentials): Promise<ApiResponse<AuthToken | ErrorResponse>> {
    return this.client.request(RequestBuilder.post('/login').withBody(credentials).build())
  }

  async validate(token: string): Promise<ApiResponse<TokenValidation | ErrorResponse>> {
    return this.client.request(RequestBuilder.post('/validate').withBody({ token }).build())
  }

  async logout(token: string): Promise<ApiResponse<LogoutResult | ErrorResponse>> {
    return this.client.request(RequestBuilder.post('/logout').withBody({ token }).build())
  }
}
