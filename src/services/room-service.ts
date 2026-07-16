import type { ApiResponse, HttpClient } from '@client/http-client'
import { RequestBuilder } from '@client/request-builder'
import type { ErrorsResponse, SuccessResponse } from '@models/common'
import type { Room, RoomList, RoomPayload } from '@models/room'

export class RoomService {
  constructor(private readonly client: HttpClient) {}

  async list(): Promise<ApiResponse<RoomList>> {
    return this.client.request(RequestBuilder.get('').build())
  }

  async getById(roomid: number): Promise<ApiResponse<Room>> {
    return this.client.request(RequestBuilder.get(`/${roomid}`).build())
  }

  async create(
    payload: RoomPayload,
    token?: string,
  ): Promise<ApiResponse<SuccessResponse | ErrorsResponse>> {
    return this.client.request(RequestBuilder.post('').withBody(payload).withToken(token).build())
  }

  async update(
    roomid: number,
    payload: RoomPayload,
    token?: string,
  ): Promise<ApiResponse<Room | ErrorsResponse>> {
    return this.client.request(
      RequestBuilder.put(`/${roomid}`).withBody(payload).withToken(token).build(),
    )
  }

  async delete(roomid: number, token?: string): Promise<ApiResponse<unknown>> {
    return this.client.request(RequestBuilder.delete(`/${roomid}`).withToken(token).build())
  }
}
