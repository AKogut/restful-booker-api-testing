import { inject } from 'vitest'

export const sharedToken = (): string => inject('adminToken')
