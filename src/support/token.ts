import type { ApiResponse } from '@client/http-client'
import type { AuthToken } from '@models/auth'
import type { ErrorResponse } from '@models/common'

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
