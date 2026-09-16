import { inject } from 'vitest'
import { adminSession } from '@support/admin-session'

export const sharedToken = (): string => {
  const token = inject('adminToken')
  adminSession().adopt(token)
  return token
}
