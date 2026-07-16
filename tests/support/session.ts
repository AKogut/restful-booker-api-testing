import { getConfig } from '@config/app-config'
import { createServices } from '@services/service-factory'

export const adminToken = async (): Promise<string> => {
  const { auth } = createServices()
  const response = await auth.login(getConfig().credentials)
  if (!('token' in response.data)) {
    throw new Error(`Admin login failed with status ${response.status}`)
  }
  return response.data.token
}
