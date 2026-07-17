import type { ApiResponse, HttpClient } from '@client/http-client'
import { RequestBuilder } from '@client/request-builder'
import type { Branding } from '@models/branding'
import type { ErrorResponse, ValidationErrorResponse } from '@models/common'

export class BrandingService {
  constructor(private readonly client: HttpClient) {}

  async get(): Promise<ApiResponse<Branding>> {
    return this.client.request(RequestBuilder.get('').build())
  }

  async update(
    payload: Branding,
    token?: string,
  ): Promise<ApiResponse<Branding | ErrorResponse | ValidationErrorResponse>> {
    return this.client.request(RequestBuilder.put('').withBody(payload).withToken(token).build())
  }
}
