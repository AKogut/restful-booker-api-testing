import { assertPlatformHealthy } from '@health/health-check'
import { getConfig } from '@config/app-config'

export default async function globalSetup(): Promise<void> {
  if (process.env.HEALTHCHECK !== '1') {
    return
  }
  await assertPlatformHealthy(getConfig())
}
