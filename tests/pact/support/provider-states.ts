export const PROVIDER_STATE = {
  adminExists: 'an admin account exists',
  activeSession: 'an active admin session exists',
  roomExists: 'a room exists',
  bookedRoom: 'a room with one booking exists',
} as const

export type ProviderStateName = (typeof PROVIDER_STATE)[keyof typeof PROVIDER_STATE]
