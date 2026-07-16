import { HttpClient } from '@client/http-client'
import { getConfig, type AppConfig } from '@config/app-config'
import { AuthService } from './auth-service'
import { RoomService } from './room-service'

export interface Services {
  readonly auth: AuthService
  readonly room: RoomService
}

export const createServices = (config: AppConfig = getConfig()): Services => {
  const clientFor = (baseUrl: string): HttpClient =>
    new HttpClient({ baseUrl, timeoutMs: config.timeoutMs })

  return {
    auth: new AuthService(clientFor(config.services.auth)),
    room: new RoomService(clientFor(config.services.room)),
  }
}
