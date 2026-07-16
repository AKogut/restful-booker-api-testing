export interface BookingDates {
  checkin: string
  checkout: string
}

export interface Booking {
  bookingid: number
  roomid: number
  firstname: string
  lastname: string
  depositpaid: boolean
  bookingdates: BookingDates
}

export type UpdateBookingPayload = Omit<Booking, 'bookingid'>

export interface BookingPayload extends UpdateBookingPayload {
  email: string
  phone: string
}

export interface BookingList {
  bookings: Booking[]
}

export interface UpdatedBooking {
  booking: Booking
  bookingid: number
}

export interface BookingSummaryEntry {
  bookingDates: BookingDates
}

export interface BookingSummary {
  bookings: BookingSummaryEntry[]
}
