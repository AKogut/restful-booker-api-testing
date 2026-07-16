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

export interface BookingPayload extends Omit<Booking, 'bookingid'> {
  email: string
  phone: string
}

export interface BookingList {
  bookings: Booking[]
}
