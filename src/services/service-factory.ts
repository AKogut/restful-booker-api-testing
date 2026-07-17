import { HttpClient } from '@client/http-client'
import { getConfig, type AppConfig } from '@config/app-config'
import { AuthService } from './auth-service'
import { BookingService } from './booking-service'
import { BrandingService } from './branding-service'
import { MessageService } from './message-service'
import { ReportService } from './report-service'
import { RoomService } from './room-service'

export interface Services {
  readonly auth: AuthService
  readonly room: RoomService
  readonly booking: BookingService
  readonly message: MessageService
  readonly branding: BrandingService
  readonly report: ReportService
}

export const createServices = (config: AppConfig = getConfig()): Services => {
  const clientFor = (baseUrl: string): HttpClient =>
    new HttpClient({ baseUrl, timeoutMs: config.timeoutMs })

  return {
    auth: new AuthService(clientFor(config.services.auth)),
    room: new RoomService(clientFor(config.services.room)),
    booking: new BookingService(clientFor(config.services.booking)),
    message: new MessageService(clientFor(config.services.message)),
    branding: new BrandingService(clientFor(config.services.branding)),
    report: new ReportService(clientFor(config.services.report)),
  }
}
