import type { ApiResponse } from '@client/http-client'
import { getConfig } from '@config/app-config'
import type { AuthToken } from '@models/auth'
import type { ErrorResponse } from '@models/common'
import { createServices } from '@services/service-factory'

const TOKEN_COOKIE = /(?:^|[;,\s])token=([^;,\s]+)/

const tokenFromCookie = (setCookie: string | undefined): string | undefined =>
  setCookie === undefined ? undefined : (TOKEN_COOKIE.exec(setCookie)?.[1] ?? undefined)

export const extractToken = (
  response: ApiResponse<AuthToken | ErrorResponse>,
): string | undefined => {
  const body: unknown = response.data
  if (typeof body === 'object' && body !== null && 'token' in body) {
    return (body as AuthToken).token
  }
  return tokenFromCookie(response.headers['set-cookie'])
}

export const adminToken = async (): Promise<string> => {
  const { auth } = createServices()
  const response = await auth.login(getConfig().credentials)
  const token = extractToken(response)
  if (token === undefined) {
    throw new Error(`Admin login failed with status ${response.status}`)
  }
  return token
}
