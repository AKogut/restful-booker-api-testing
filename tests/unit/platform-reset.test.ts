import { describe, expect, it } from 'vitest'
import { ApiError } from '@client/api-error'
import type { ApiResponse } from '@client/http-client'
import type { BookingPayload } from '@models/booking'
import type { MessagePayload } from '@models/message'
import type { Room } from '@models/room'
import type { BookingService } from '@services/booking-service'
import type { MessageService } from '@services/message-service'
import type { RoomService } from '@services/room-service'
import {
  PlatformResetDetector,
  type CanaryServices,
  type ResettableService,
} from '@support/platform-reset'

const reply = <T>(status: number, data: T): Promise<ApiResponse<T>> =>
  Promise.resolve({ status, headers: {}, data })

const transportFailure = (): Promise<never> =>
  Promise.reject(new ApiError('Network failure: https://rbp.test', { method: 'GET', url: '' }))

class FakePlatform {
  private nextId = 1
  readonly rooms = new Set<number>()
  readonly bookings = new Map<number, number>()
  readonly messages = new Map<number, string>()
  readonly deleted: string[] = []
  listingStatus = 200
  listingsFail = false
  roomsFailToProvision = false

  reset(service: ResettableService): void {
    const tables = { room: this.rooms, booking: this.bookings, message: this.messages }
    tables[service].clear()
  }

  readonly provision = (): Promise<Room> => {
    if (this.roomsFailToProvision) {
      return Promise.reject(new Error('Room provisioning failed with status 500'))
    }
    const roomid = this.nextId++
    this.rooms.add(roomid)
    return Promise.resolve({ roomid, roomName: `canary-${roomid}` } as Room)
  }

  private listing<T>(data: T): Promise<ApiResponse<T>> {
    return this.listingsFail ? transportFailure() : reply(this.listingStatus, data)
  }

  services(): CanaryServices {
    const room = {
      list: () =>
        this.listing({ rooms: [...this.rooms].map((roomid) => ({ roomid, roomName: 'canary' })) }),
      getById: () => reply(500, 'Internal Server Error'),
      delete: (id: number) => {
        this.deleted.push(`room:${id}`)
        return reply(202, {})
      },
    } as unknown as RoomService

    const booking = {
      create: (payload: BookingPayload) => {
        const bookingid = this.nextId++
        this.bookings.set(bookingid, payload.roomid)
        return reply(201, { bookingid, booking: { ...payload, bookingid } })
      },
      list: (roomid: number) =>
        this.listing({
          bookings: [...this.bookings]
            .filter(([, bookedRoom]) => bookedRoom === roomid)
            .map(([bookingid]) => ({ bookingid, roomid })),
        }),
      getById: () => reply(500, 'Internal Server Error'),
      delete: (id: number) => {
        this.deleted.push(`booking:${id}`)
        return reply(202, {})
      },
    } as unknown as BookingService

    const message = {
      create: (payload: MessagePayload) => {
        this.messages.set(this.nextId++, payload.subject)
        return reply(200, { success: true })
      },
      list: () =>
        this.listing({
          messages: [...this.messages].map(([id, subject]) => ({
            id,
            subject,
            name: 'canary',
            read: false,
          })),
        }),
      delete: (id: number) => {
        this.deleted.push(`message:${id}`)
        return reply(202, {})
      },
    } as unknown as MessageService

    return { room, booking, message }
  }

  detector(): PlatformResetDetector {
    return new PlatformResetDetector(this.services(), () => 'token', this.provision)
  }
}

const armedPlatform = async (): Promise<[FakePlatform, PlatformResetDetector]> => {
  const platform = new FakePlatform()
  const detector = platform.detector()
  await detector.arm()
  return [platform, detector]
}

describe('PlatformResetDetector', () => {
  it('plants a canary in every service it watches', async () => {
    const [platform, detector] = await armedPlatform()

    expect(detector.armed).toEqual(['room', 'booking', 'message'])
    expect(platform.rooms.size).toBe(1)
    expect(platform.bookings.size).toBe(1)
    expect(platform.messages.size).toBe(1)
  })

  it('reports no reset while every canary is still listed', async () => {
    const [, detector] = await armedPlatform()

    await expect(detector.resetServices()).resolves.toEqual([])
  })

  it('names the service whose database was reset and plants a fresh canary in it', async () => {
    const [platform, detector] = await armedPlatform()

    platform.reset('booking')

    await expect(detector.resetServices()).resolves.toEqual(['booking'])
    expect(platform.bookings.size).toBe(1)
    await expect(detector.resetServices()).resolves.toEqual([])
  })

  it('reports every service that was reset in the same window', async () => {
    const [platform, detector] = await armedPlatform()

    platform.reset('room')
    platform.reset('message')

    await expect(detector.resetServices()).resolves.toEqual(['room', 'message'])
    expect(detector.armed).toEqual(['room', 'booking', 'message'])
  })

  it('still finds the booking canary under its original room after the room database resets', async () => {
    const [platform, detector] = await armedPlatform()

    platform.reset('room')

    await expect(detector.resetServices()).resolves.toEqual(['room'])
    await expect(detector.resetServices()).resolves.toEqual([])
  })

  it('never reads a 500 from a per-id route as a reset', async () => {
    const [, detector] = await armedPlatform()

    await expect(detector.resetServices()).resolves.toEqual([])
  })

  it('claims no reset when the listings cannot be read in transit', async () => {
    const [platform, detector] = await armedPlatform()

    platform.reset('room')
    platform.reset('booking')
    platform.reset('message')
    platform.listingsFail = true

    await expect(detector.resetServices()).resolves.toEqual([])
  })

  it('claims no reset when a listing answers with anything but 200', async () => {
    const [platform, detector] = await armedPlatform()

    platform.reset('room')
    platform.reset('booking')
    platform.reset('message')
    platform.listingStatus = 500

    await expect(detector.resetServices()).resolves.toEqual([])
  })

  it('never reports a service it could not plant a canary in', async () => {
    const platform = new FakePlatform()
    platform.roomsFailToProvision = true
    const detector = platform.detector()

    await detector.arm()
    platform.reset('room')
    platform.reset('booking')

    expect(detector.armed).toEqual(['message'])
    await expect(detector.resetServices()).resolves.toEqual([])
  })

  it('removes every canary it still holds when disarmed', async () => {
    const [platform, detector] = await armedPlatform()

    await detector.disarm()

    expect(platform.deleted).toEqual(['message:3', 'booking:2', 'room:1'])
    expect(detector.armed).toEqual([])
  })
})
