import type { ApiResponse, HttpClient } from '@client/http-client'
import { RequestBuilder } from '@client/request-builder'
import type { ErrorResponse } from '@models/common'
import type { Report } from '@models/report'

export class ReportService {
  constructor(private readonly client: HttpClient) {}

  async get(token?: string): Promise<ApiResponse<Report | ErrorResponse>> {
    return this.client.request(RequestBuilder.get('').withToken(token).build())
  }

  async getByRoom(roomid: number, token?: string): Promise<ApiResponse<Report | ErrorResponse>> {
    return this.client.request(RequestBuilder.get(`/room/${roomid}`).withToken(token).build())
  }
}
