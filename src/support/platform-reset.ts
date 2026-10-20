import { ApiError } from '@client/api-error'
import { bookingPayload } from '@factories/booking-factory'
import { messagePayload } from '@factories/message-factory'
import type { BookingService } from '@services/booking-service'
import type { MessageService } from '@services/message-service'
import type { Room } from '@models/room'
import type { RoomService } from '@services/room-service'
import { createdBooking } from './bookings'
import { provisionRoom } from './rooms'
import { track } from './run-registry'

export type ResettableService = 'room' | 'booking' | 'message'

export interface CanaryServices {
  readonly room: RoomService
  readonly booking: BookingService
  readonly message: MessageService
}

type Presence = 'present' | 'gone' | 'unknown'

type ProvisionRoom = (room: RoomService, token: string) => Promise<Room>

const PLANTING_ORDER: readonly ResettableService[] = ['room', 'booking', 'message']

const GONE_ROOM_STATUSES: ReadonlySet<number> = new Set([404, 500])

const GONE_BOOKING_STATUSES: ReadonlySet<number> = new Set([404])

const presenceOf = (status: number, goneStatuses: ReadonlySet<number>): Presence => {
  if (status === 200) {
    return 'present'
  }
  return goneStatuses.has(status) ? 'gone' : 'unknown'
}

export class PlatformResetDetector {
  private readonly canaries = new Map<ResettableService, number>()

  constructor(
    private readonly services: CanaryServices,
    private readonly token: () => string,
    private readonly provision: ProvisionRoom = provisionRoom,
  ) {}

  get armed(): ResettableService[] {
    return PLANTING_ORDER.filter((service) => this.canaries.has(service))
  }

  async arm(): Promise<void> {
    await this.plant(PLANTING_ORDER)
  }

  async resetServices(): Promise<ResettableService[]> {
    const reset: ResettableService[] = []
    for (const service of PLANTING_ORDER) {
      const id = this.canaries.get(service)
      if (id !== undefined && (await this.presence(service, id)) === 'gone') {
        this.canaries.delete(service)
        reset.push(service)
      }
    }
    await this.plant(reset)
    return reset
  }

  async disarm(): Promise<void> {
    for (const service of [...PLANTING_ORDER].reverse()) {
      const id = this.canaries.get(service)
      if (id !== undefined) {
        await this.remove(service, id).catch(() => undefined)
        this.canaries.delete(service)
      }
    }
  }

  private async plant(services: readonly ResettableService[]): Promise<void> {
    for (const service of PLANTING_ORDER.filter((candidate) => services.includes(candidate))) {
      const id = await this.create(service).catch(() => undefined)
      if (id !== undefined) {
        this.canaries.set(service, id)
      }
    }
  }

  private async create(service: ResettableService): Promise<number | undefined> {
    const { room, booking, message } = this.services
    if (service === 'room') {
      return (await this.provision(room, this.token())).roomid
    }
    if (service === 'booking') {
      const roomid = this.canaries.get('room')
      if (roomid === undefined) {
        return undefined
      }
      const created = createdBooking((await booking.create(bookingPayload(roomid))).data)
      if (created !== undefined) {
        track('booking', created.bookingid)
      }
      return created?.bookingid
    }
    const payload = messagePayload()
    await message.create(payload)
    const listing = await message.list(this.token())
    const id = listing.data.messages.find((entry) => entry.subject === payload.subject)?.id
    if (id !== undefined) {
      track('message', id)
    }
    return id
  }

  private async presence(service: ResettableService, id: number): Promise<Presence> {
    const { room, booking, message } = this.services
    try {
      if (service === 'room') {
        return presenceOf((await room.getById(id)).status, GONE_ROOM_STATUSES)
      }
      if (service === 'booking') {
        return presenceOf((await booking.getById(id, this.token())).status, GONE_BOOKING_STATUSES)
      }
      const listing = await message.list(this.token())
      if (listing.status !== 200) {
        return 'unknown'
      }
      return listing.data.messages.some((entry) => entry.id === id) ? 'present' : 'gone'
    } catch (error) {
      if (error instanceof ApiError) {
        return 'unknown'
      }
      throw error
    }
  }

  private async remove(service: ResettableService, id: number): Promise<void> {
    const { room, booking, message } = this.services
    const token = this.token()
    if (service === 'room') {
      await room.delete(id, token)
    } else if (service === 'booking') {
      await booking.delete(id, token)
    } else {
      await message.delete(id, token)
    }
  }
}
