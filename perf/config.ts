export type Target = 'local' | 'live'

const target = (__ENV.PERF_TARGET ?? 'local') as Target

interface Endpoints {
  auth: string
  room: string
  booking: string
}

const defaults: Record<Target, Endpoints> = {
  local: {
    auth: 'http://localhost:3004/auth/',
    room: 'http://localhost:3001/room/',
    booking: 'http://localhost:3000/booking/',
  },
  live: {
    auth: 'https://automationintesting.online/api/auth',
    room: 'https://automationintesting.online/api/room',
    booking: 'https://automationintesting.online/api/booking',
  },
}

export const endpoints: Endpoints = {
  auth: __ENV.AUTH_URL ?? defaults[target].auth,
  room: __ENV.ROOM_URL ?? defaults[target].room,
  booking: __ENV.BOOKING_URL ?? defaults[target].booking,
}

export const join = (base: string, path: string): string =>
  path.length === 0 ? base : `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

export const credentials = {
  username: __ENV.ADMIN_USER ?? 'admin',
  password: __ENV.ADMIN_PASSWORD ?? 'password',
}

const numberFrom = (value: string | undefined, fallback: number): number =>
  value === undefined || value.length === 0 ? fallback : Number(value)

export const budgets = {
  p95Ms: numberFrom(__ENV.PERF_P95_MS, 1000),
  errorRate: numberFrom(__ENV.PERF_ERROR_RATE, 0.01),
  checkRate: numberFrom(__ENV.PERF_CHECK_RATE, 0.99),
}

const peakVus = numberFrom(__ENV.PERF_VUS, 5)

export const options = {
  scenarios: {
    smoke: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.PERF_RAMP ?? '10s', target: peakVus },
        { duration: __ENV.PERF_HOLD ?? '20s', target: peakVus },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: [`rate<${budgets.errorRate}`],
    http_req_duration: [`p(95)<${budgets.p95Ms}`],
    checks: [`rate>${budgets.checkRate}`],
  },
}
