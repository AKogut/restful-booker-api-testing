import { execFileSync } from 'node:child_process'

const git = (...args: string[]): string => {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

export const contractVersion = (): string =>
  process.env.PACT_VERSION || git('rev-parse', '--short', 'HEAD') || 'dev'

export const contractBranch = (): string =>
  process.env.PACT_BRANCH || git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown'
