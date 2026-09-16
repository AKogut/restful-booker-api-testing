import { getConfig } from '@config/app-config'
import { createServices } from '@services/service-factory'
import { extractToken } from './token'

export { extractToken } from './token'

export const adminToken = async (): Promise<string> => {
  const { auth } = createServices()
  const response = await auth.login(getConfig().credentials)
  const token = extractToken(response)
  if (token === undefined) {
    throw new Error(`Admin login failed with status ${response.status}`)
  }
  return token
}
