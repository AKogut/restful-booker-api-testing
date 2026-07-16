import type { ApiResponse, HttpClient } from '@client/http-client'
import { RequestBuilder } from '@client/request-builder'
import type {
  Booking,
  BookingList,
  BookingPayload,
  BookingSummary,
  UpdateBookingPayload,
  UpdatedBooking,
} from '@models/booking'
import type { ErrorResponse, ErrorsResponse, ValidationErrorResponse } from '@models/common'

export class BookingService {
  constructor(private readonly client: HttpClient) {}

  async create(
    payload: BookingPayload,
  ): Promise<ApiResponse<Booking | ErrorResponse | ErrorsResponse>> {
    return this.client.request(RequestBuilder.post('').withBody(payload).build())
  }

  async list(roomid: number, token?: string): Promise<ApiResponse<BookingList | ErrorResponse>> {
    return this.client.request(
      RequestBuilder.get('').withQuery('roomid', roomid).withToken(token).build(),
    )
  }

  async getById(bookingid: number, token?: string): Promise<ApiResponse<Booking | ErrorResponse>> {
    return this.client.request(RequestBuilder.get(`/${bookingid}`).withToken(token).build())
  }

  async summary(
    roomid: number,
    token?: string,
  ): Promise<ApiResponse<BookingSummary | ErrorResponse>> {
    return this.client.request(
      RequestBuilder.get('/summary').withQuery('roomid', roomid).withToken(token).build(),
    )
  }

  async update(
    bookingid: number,
    payload: UpdateBookingPayload,
    token?: string,
  ): Promise<ApiResponse<UpdatedBooking | ErrorResponse | ValidationErrorResponse>> {
    return this.client.request(
      RequestBuilder.put(`/${bookingid}`).withBody(payload).withToken(token).build(),
    )
  }

  async delete(bookingid: number, token?: string): Promise<ApiResponse<unknown>> {
    return this.client.request(RequestBuilder.delete(`/${bookingid}`).withToken(token).build())
  }
}
