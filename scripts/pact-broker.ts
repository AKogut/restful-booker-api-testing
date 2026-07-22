import { execFileSync } from 'node:child_process'
import { CONSUMER, PACT_DIR, PROVIDER } from '../tests/pact/support/contract'
import { contractBranch, contractVersion } from './support/contract-version'

const CLI_IMAGE = 'pactfoundation/pact-cli:latest'

const network = process.env.PACT_BROKER_NETWORK ?? 'pact_default'
const brokerUrl = process.env.PACT_BROKER_INTERNAL_URL ?? 'http://pact-broker:9292'

const version = contractVersion()
const branch = contractBranch()

const runCli = (args: string[], mountPacts = false): void => {
  const mount = mountPacts ? ['-v', `${PACT_DIR}:/pacts`] : []
  try {
    execFileSync('docker', ['run', '--rm', '--network', network, ...mount, CLI_IMAGE, ...args], {
      stdio: 'inherit',
    })
  } catch {
    process.exit(1)
  }
}

const publish = (): void => {
  runCli(
    [
      'publish',
      '/pacts',
      `--broker-base-url=${brokerUrl}`,
      `--consumer-app-version=${version}`,
      `--branch=${branch}`,
    ],
    true,
  )
}

const canIDeploy = (): void => {
  const pacticipants = [CONSUMER, ...Object.values(PROVIDER)].flatMap((name) => [
    '--pacticipant',
    name,
    '--version',
    version,
  ])
  runCli(['broker', 'can-i-deploy', `--broker-base-url=${brokerUrl}`, ...pacticipants])
}

const commands: Record<string, () => void> = { publish, 'can-i-deploy': canIDeploy }
const requested = process.argv[2] ?? ''
const command = commands[requested]

if (command === undefined) {
  console.error(
    `Unknown command "${requested}" — expected one of ${Object.keys(commands).join(', ')}`,
  )
  process.exit(1)
}

command()
