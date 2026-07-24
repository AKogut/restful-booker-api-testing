import { check, fail } from 'k6'
import exec from 'k6/execution'
import http from 'k6/http'
import { credentials, endpoints, join, options } from './config.ts'
import { deleteRoom, disjointStay, extractToken, provisionRoom } from './lib/session.ts'

export { options }

interface SetupData {
  token: string
  roomid: number
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export function setup(): SetupData {
  const login = http.post(join(endpoints.auth, 'login'), JSON.stringify(credentials), {
    headers: jsonHeaders,
  })
  const token = extractToken(login)
  if (token.length === 0) {
    fail(`admin login failed during setup (status ${login.status})`)
  }

  return { token, roomid: provisionRoom(token) }
}

export function teardown(data: SetupData): void {
  deleteRoom(data.token, data.roomid)
}

export default function (data: SetupData): void {
  const rooms = http.get(join(endpoints.room, ''), { tags: { name: 'room.list' } })
  check(rooms, { 'room list responds 200': (r) => r.status === 200 })

  const stay = disjointStay(exec.scenario.iterationInTest)
  const booking = http.post(
    join(endpoints.booking, ''),
    JSON.stringify({
      roomid: data.roomid,
      firstname: 'Perf',
      lastname: `VU${__VU}I${__ITER}`,
      depositpaid: true,
      email: 'perf@example.com',
      phone: '01234567890',
      bookingdates: stay,
    }),
    { headers: jsonHeaders, tags: { name: 'booking.create' } },
  )
  check(booking, { 'booking create responds 201': (r) => r.status === 201 })

  const listed = http.get(join(endpoints.booking, `?roomid=${data.roomid}`), {
    headers: { Cookie: `token=${data.token}` },
    tags: { name: 'booking.list' },
  })
  check(listed, { 'booking list responds 200': (r) => r.status === 200 })
}

interface SummaryData {
  metrics: Record<string, { values: Record<string, number> }>
}

export function handleSummary(data: SummaryData): Record<string, string> {
  const value = (metric: string, stat: string): number =>
    data.metrics[metric]?.values[stat] ?? Number.NaN

  const p95 = value('http_req_duration', 'p(95)')
  const errorRate = value('http_req_failed', 'rate')
  const checkRate = value('checks', 'rate')

  const line =
    `perf smoke — p95 ${p95.toFixed(1)}ms · ` +
    `errors ${(errorRate * 100).toFixed(2)}% · ` +
    `checks ${(checkRate * 100).toFixed(1)}%`

  return {
    'perf-summary.json': JSON.stringify(data, null, 2),
    stdout: `\n${line}\n`,
  }
}
