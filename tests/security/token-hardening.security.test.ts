import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { nextRoomName, roomPayload } from '@factories/room-factory'
import { getConfig } from '@config/app-config'
import { createServicesWithoutRetry } from '@services/service-factory'
import { sweepRoomsByPrefix } from '../support/room-sweep'
import { guardsDefect } from '../support/defect-guard'
import { itWhenSupported } from '../support/target'
import { sharedToken } from '../support/session'

const { auth, room } = createServicesWithoutRetry(getConfig())
const { credentials } = getConfig()

const LEAKED_INTERNALS = /org\.springframework|java\.|SQLException|HikariCP|jdbc/i
const INFRA_HEADERS = ['x-railway-request-id', 'x-railway-edge', 'x-hikari-trace']
const SECURITY_HEADERS = ['strict-transport-security', 'x-content-type-options']
const MARKER = 'SEC-TOKEN-'

let token: string

const markedRoom = () => roomPayload({ roomName: `${MARKER}${nextRoomName()}` })

beforeAll(() => {
  token = sharedToken()
})

afterAll(async () => {
  await sweepRoomsByPrefix(room, token, MARKER)
})

describe('token tampering @security', () => {
  const flipFinalCharacter = (value: string): string =>
    `${value.slice(0, -1)}${value.at(-1) === 'a' ? 'b' : 'a'}`

  it.each<[string, (value: string) => string]>([
    ['flipped final character', flipFinalCharacter],
    ['truncated', (value) => value.slice(0, Math.max(0, value.length - 4))],
    ['trailing whitespace', (value) => `${value} `],
    ['empty string', () => ''],
    ['only whitespace', () => '   '],
  ])('rejects a %s token on validate', async (_name, tamper) => {
    const response = await auth.validate(tamper(token))

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })

  it('rejects a tampered token on a protected call and creates nothing', async () => {
    const payload = markedRoom()

    const response = await room.create(payload, flipFinalCharacter(token))

    expect(response.status).toBeGreaterThanOrEqual(400)
    const listing = await room.list()
    expect(listing.data.rooms.map((entry) => entry.roomName)).not.toContain(payload.roomName)
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
  for (const header of INFRA_HEADERS) {
    guardsDefect('BUG-010', `does not leak the ${header} header`, {
      reproduce: () => room.list(),
      expectCorrect: (response) => {
        expect(response.headers[header]).toBeUndefined()
      },
    })
  }

  for (const header of SECURITY_HEADERS) {
    guardsDefect('BUG-011', `sets the ${header} security header`, {
      reproduce: () => room.list(),
      expectCorrect: (response) => {
        expect(response.headers[header]).toBeDefined()
      },
    })
  }
})
