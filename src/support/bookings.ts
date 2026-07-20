import type { Booking } from '@models/booking'

export const createdBooking = (data: unknown): Booking | undefined => {
  if (typeof data !== 'object' || data === null || !('bookingid' in data)) {
    return undefined
  }
  if ('booking' in data) {
    return (data as { booking: Booking }).booking
  }
  return data as Booking
}
