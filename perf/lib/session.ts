import http, { type RefinedResponse, type ResponseType } from 'k6/http'
import { fail } from 'k6'
import { endpoints, join } from '../config.ts'

const isJsonBody = (response: RefinedResponse<ResponseType | undefined>): boolean => {
  const contentType = String(response.headers['Content-Type'] ?? '')
  return contentType.includes('application/json') && typeof response.body === 'string'
}

export const extractToken = (response: RefinedResponse<ResponseType | undefined>): string => {
  if (isJsonBody(response)) {
    const body = response.json() as unknown
    if (typeof body === 'object' && body !== null && 'token' in body) {
      return String(body.token)
    }
  }
  const jar = response.cookies['token']
  return jar !== undefined && jar.length > 0 ? jar[0].value : ''
}

const authHeader = (token: string): { Cookie: string } => ({ Cookie: `token=${token}` })

export const provisionRoom = (token: string): number => {
  const roomName = `perf-${Date.now()}`
  const created = http.post(
    join(endpoints.room, ''),
    JSON.stringify({
      roomName,
      type: 'Double',
      accessible: true,
      image: '/images/room1.jpg',
      description: 'Room provisioned for a performance smoke run',
      features: ['WiFi'],
      roomPrice: 100,
    }),
    { headers: { 'Content-Type': 'application/json', ...authHeader(token) } },
  )
  if (created.status >= 400) {
    fail(`could not provision a room for the run (status ${created.status})`)
  }

  const rooms = http.get(join(endpoints.room, '')).json('rooms') as
    { roomid: number; roomName: string }[] | undefined
  const mine = rooms?.find((room) => room.roomName === roomName)
  if (mine === undefined) {
    fail(`provisioned room ${roomName} was not found in the listing`)
  }
  return mine.roomid
}

export const deleteRoom = (token: string, roomid: number): void => {
  http.del(join(endpoints.room, `${roomid}`), null, { headers: authHeader(token) })
}

const DAY_MS = 86_400_000
const runStart = Date.UTC(2028, 0, 1)

export const disjointStay = (globalIteration: number): { checkin: string; checkout: string } => {
  const checkin = runStart + globalIteration * 3 * DAY_MS
  const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
  return { checkin: iso(checkin), checkout: iso(checkin + 2 * DAY_MS) }
}
