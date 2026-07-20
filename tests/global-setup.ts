import { getConfig } from '@config/app-config'
import { waitForPlatformReady } from '@health/health-check'

export default async function globalSetup(): Promise<void> {
  if (process.env.HEALTHCHECK !== '1') {
    return
  }
  await waitForPlatformReady(getConfig())
}
