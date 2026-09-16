import { ApiError } from '@client/api-error'
import { HttpClient, type SessionRecovery } from '@client/http-client'
import { getConfig } from '@config/app-config'
import type { AuthCredentials } from '@models/auth'
import { AuthService } from '@services/auth-service'
import { extractToken } from './token'

export interface SessionAuthority {
  auth: AuthService
  credentials: AuthCredentials
}

const platformAuthority = (): SessionAuthority => {
  const config = getConfig()
  return {
    auth: new AuthService(
      new HttpClient({ baseUrl: config.services.auth, timeoutMs: config.timeoutMs }),
    ),
    credentials: config.credentials,
  }
}

export class AdminSession implements SessionRecovery {
  private origin: string | undefined
  private readonly replacements = new Map<string, string>()
  private pending: Promise<string | undefined> | undefined
  private authority: SessionAuthority | undefined
  private renewalCount = 0

  constructor(private readonly resolveAuthority: () => SessionAuthority = platformAuthority) {}

  adopt(token: string): void {
    this.origin ??= token
  }

  current(token: string): string {
    let resolved = token
    for (let next = this.replacements.get(resolved); next !== undefined;) {
      resolved = next
      next = this.replacements.get(resolved)
    }
    return resolved
  }

  get renewals(): number {
    return this.renewalCount
  }

  recover(token: string): Promise<string | undefined> {
    if (this.origin === undefined || token !== this.current(this.origin)) {
      return Promise.resolve(undefined)
    }
    this.pending ??= this.renewOrKeep(token).finally(() => {
      this.pending = undefined
    })
    return this.pending
  }

  private async renewOrKeep(token: string): Promise<string | undefined> {
    try {
      return await this.renew(token)
    } catch (error) {
      if (!(error instanceof ApiError)) {
        throw error
      }
      console.warn(
        `Could not check whether the platform still accepts the shared admin token (${error.message}); kept the original response`,
      )
      return undefined
    }
  }

  private async renew(token: string): Promise<string | undefined> {
    this.authority ??= this.resolveAuthority()
    const { auth, credentials } = this.authority

    const validation = await auth.validate(token)
    if (validation.status === 200) {
      return undefined
    }

    const login = await auth.login(credentials)
    const replacement = extractToken(login)
    if (replacement === undefined) {
      return undefined
    }

    this.replacements.set(token, replacement)
    this.renewalCount += 1
    console.warn(
      `The platform stopped accepting the shared admin token (validate returned ${validation.status}); re-authenticated and replayed the rejected request`,
    )
    return replacement
  }
}

let workerSession: AdminSession | undefined

export const adminSession = (): AdminSession => {
  workerSession ??= new AdminSession()
  return workerSession
}
