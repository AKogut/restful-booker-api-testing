export interface AuthCredentials {
  username: string
  password: string
}

export interface AuthToken {
  token: string
}

export interface TokenValidation {
  valid: boolean
}

export interface LogoutResult {
  success: boolean
}
