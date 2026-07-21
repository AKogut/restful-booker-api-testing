import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nextRoomName, roomPayload } from '@factories/room-factory'
import { getConfig } from '@config/app-config'
import { createServicesWithoutRetry } from '@services/service-factory'
import { sweepRoomsByPrefix } from '../support/room-sweep'
import { itWhenSupported } from '../support/target'
import { sharedToken } from '../support/session'

const { auth, room } = createServicesWithoutRetry(getConfig())
const { credentials } = getConfig()

const LEAKED_INTERNALS = /org\.springframework|java\.|SQLException|HikariCP|jdbc/i
const INFRA_HEADERS = ['x-railway-request-id', 'x-railway-edge', 'x-hikari-trace']
const SECURITY_HEADERS = ['strict-transport-security', 'x-content-type-options']
const MARKER = 'SEC-TOKEN-'

let token: string

const createdRoom = (data: unknown): boolean =>
  typeof data === 'object' && data !== null && 'roomid' in data

const markedRoom = () => roomPayload({ roomName: `${MARKER}${nextRoomName()}` })

beforeAll(() => {
  token = sharedToken()
})

afterAll(async () => {
  await sweepRoomsByPrefix(room, token, MARKER)
})

describe('token tampering @security', () => {
  const tamper = (value: string): Record<string, string> => ({
    'flipped final character': `${value.slice(0, -1)}${value.at(-1) === 'a' ? 'b' : 'a'}`,
    truncated: value.slice(0, Math.max(0, value.length - 4)),
    'trailing whitespace': `${value} `,
    'empty string': '',
    'only whitespace': '   ',
  })

  it.each(Object.entries(tamper('abcdEFGH12345678')))(
    'rejects a %s token on validate',
    async (_name, candidate) => {
      const response = await auth.validate(candidate)

      expect(response.status).toBeGreaterThanOrEqual(400)
    },
  )

  it('rejects a tampered token on a protected call and creates nothing', async () => {
    const tampered = `${token.slice(0, -1)}${token.at(-1) === 'a' ? 'b' : 'a'}`

    const response = await room.create(markedRoom(), tampered)

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(createdRoom(response.data)).toBe(false)
  })
})

describe('secret non-leakage @security', () => {
  it('does not echo the password on a successful login', async () => {
    const response = await auth.login(credentials)

    expect(JSON.stringify(response.data)).not.toContain(credentials.password)
  })

  itWhenSupported('errors.sanitized')(
    'does not leak framework or database internals in a validation error',
    async () => {
      const response = await room.create({ ...markedRoom(), roomPrice: -1 }, token)

      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(JSON.stringify(response.data)).not.toMatch(LEAKED_INTERNALS)
    },
  )
})

describe('response header hygiene @security', () => {
  itWhenSupported('defects.documented').fails.each(INFRA_HEADERS)(
    'does not leak the %s header (BUG-010)',
    async (header) => {
      const response = await room.list()

      expect(response.headers[header]).toBeUndefined()
    },
  )

  itWhenSupported('defects.documented').fails.each(SECURITY_HEADERS)(
    'sets the %s security header (BUG-011)',
    async (header) => {
      const response = await room.list()

      expect(response.headers[header]).toBeDefined()
    },
  )
})
