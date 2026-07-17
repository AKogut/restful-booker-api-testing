import type { z } from 'zod'
import { authTokenSchema, logoutResultSchema, tokenValidationSchema } from './auth.schema'
import {
  bookingListSchema,
  bookingSchema,
  bookingSummarySchema,
  updatedBookingSchema,
} from './booking.schema'
import { brandingSchema } from './branding.schema'
import { healthReportSchema } from './health.schema'
import { messageListSchema, messageSchema, unreadCountSchema } from './message.schema'
import { reportSchema } from './report.schema'
import { roomListSchema, roomSchema } from './room.schema'

export const schemaRegistry = {
  AuthToken: authTokenSchema,
  TokenValidation: tokenValidationSchema,
  LogoutResult: logoutResultSchema,
  Room: roomSchema,
  RoomList: roomListSchema,
  Booking: bookingSchema,
  BookingList: bookingListSchema,
  UpdatedBooking: updatedBookingSchema,
  BookingSummary: bookingSummarySchema,
  Message: messageSchema,
  MessageList: messageListSchema,
  UnreadCount: unreadCountSchema,
  Branding: brandingSchema,
  Report: reportSchema,
  HealthReport: healthReportSchema,
} satisfies Record<string, z.ZodTypeAny>
