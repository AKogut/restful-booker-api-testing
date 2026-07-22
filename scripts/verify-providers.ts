import { join } from 'node:path'
import { Verifier } from '@pact-foundation/pact'
import type { VerifierOptions } from '@pact-foundation/pact'
import { getConfig } from '@config/app-config'
import { bookingPayload } from '@factories/booking-factory'
import { createServices } from '@services/service-factory'
import { createdBooking } from '@support/bookings'
import { provisionRoom } from '@support/rooms'
import { adminToken } from '@support/session'
import { CONSUMER, PACT_DIR, PROVIDER } from '../tests/pact/support/contract'
import { PROVIDER_STATE } from '../tests/pact/support/provider-states'
import { contractBranch, contractVersion } from './support/contract-version'

type StateHandlers = NonNullable<VerifierOptions['stateHandlers']>

const config = getConfig()
const services = createServices()

const stateHandlers: StateHandlers = {
  [PROVIDER_STATE.adminExists]: () => Promise.resolve(undefined),

  [PROVIDER_STATE.activeSession]: async () => ({ token: await adminToken() }),

  [PROVIDER_STATE.roomExists]: async () => {
    const token = await adminToken()
    return { token, roomid: (await provisionRoom(services.room, token)).roomid }
  },

  [PROVIDER_STATE.bookedRoom]: async () => {
    const token = await adminToken()
    const room = await provisionRoom(services.room, token)
    const response = await services.booking.create(bookingPayload(room.roomid))
    const booking = createdBooking(response.data)
    if (booking === undefined) {
      throw new Error(
        `Could not seed a booking for room ${room.roomid} — the provider answered ${response.status}`,
      )
    }
    return { token, roomid: room.roomid, bookingid: booking.bookingid }
  },
}

const brokerUrl = process.env.PACT_BROKER_URL
const providerVersion = contractVersion()
const providerBranch = contractBranch()

const contractSource = (provider: string): Partial<VerifierOptions> =>
  brokerUrl === undefined
    ? { pactUrls: [join(PACT_DIR, `${CONSUMER}-${provider}.json`)] }
    : {
        pactBrokerUrl: brokerUrl,
        consumerVersionSelectors: [{ branch: providerBranch }],
        publishVerificationResult: true,
        providerVersion,
        providerBranch,
      }

const verify = async (provider: string, baseUrl: string): Promise<void> => {
  await new Verifier({
    provider,
    providerBaseUrl: baseUrl.replace(/\/+$/, ''),
    stateHandlers,
    failIfNoPactsFound: true,
    logLevel: 'warn',
    ...contractSource(provider),
  }).verifyProvider()
}

const targets: readonly (readonly [string, string])[] = [
  [PROVIDER.auth, config.services.auth],
  [PROVIDER.room, config.services.room],
  [PROVIDER.booking, config.services.booking],
]

const failures: string[] = []

for (const [provider, baseUrl] of targets) {
  try {
    await verify(provider, baseUrl)
    console.info(`✔ ${provider} honours the contract published by ${CONSUMER}`)
  } catch (error) {
    failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} provider(s) broke the contract:\n${failures.join('\n')}`)
  process.exit(1)
}

console.info(`\nEvery provider honours the contract published by ${CONSUMER}.`)
