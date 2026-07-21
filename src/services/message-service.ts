import type { ApiResponse, HttpClient } from '@client/http-client'
import { RequestBuilder } from '@client/request-builder'
import type { Message, MessageList, MessagePayload, UnreadCount } from '@models/message'
import type { SuccessResponse } from '@models/common'

export class MessageService {
  constructor(private readonly client: HttpClient) {}

  async create(payload: MessagePayload): Promise<ApiResponse<SuccessResponse>> {
    return this.client.request(RequestBuilder.post('').withBody(payload).build())
  }

  async list(token?: string): Promise<ApiResponse<MessageList>> {
    return this.client.request(RequestBuilder.get('').withToken(token).build())
  }

  async getById(messageid: number, token?: string): Promise<ApiResponse<Message>> {
    return this.client.request(RequestBuilder.get(`/${messageid}`).withToken(token).build())
  }

  async unreadCount(token?: string): Promise<ApiResponse<UnreadCount>> {
    return this.client.request(RequestBuilder.get('/count').withToken(token).build())
  }

  async markRead(messageid: number, token?: string): Promise<ApiResponse<unknown>> {
    return this.client.request(RequestBuilder.put(`/${messageid}/read`).withToken(token).build())
  }

  async delete(messageid: number, token?: string): Promise<ApiResponse<unknown>> {
    return this.client.request(RequestBuilder.delete(`/${messageid}`).withToken(token).build())
  }
}
