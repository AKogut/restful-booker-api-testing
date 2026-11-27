import { getConfig, type TestMode } from '@config/app-config'

type ByTarget<T> = Readonly<Record<TestMode, T>>

const STATUS = {
  'resource.created': { live: 201, local: 201 },
  'booking.created': { live: 201, local: 201 },
  'auth.rejected': { live: 403, local: 403 },
  'authz.missingToken': { live: 403, local: 403 },
  'authz.missingToken.report': { live: 400, local: 400 },
  'authz.forbidden': { live: 403, local: 403 },
  'auth.tokenInvalid': { live: 403, local: 403 },
} satisfies Record<string, ByTarget<number>>

const CAPABILITIES = {
  'auth.tokenInBody': { live: false, local: false },
  'auth.describesOutcome': { live: false, local: false },
  'authz.bookingSummary': { live: false, local: false },
  'errors.sanitized': { live: false, local: false },
  'defects.documented': { live: false, local: false },
} satisfies Record<string, ByTarget<boolean>>

export type StatusKey = keyof typeof STATUS
export type CapabilityKey = keyof typeof CAPABILITIES

export const currentTarget = (): TestMode => getConfig().mode

export const expectedStatus = (key: StatusKey, target: TestMode = currentTarget()): number =>
  STATUS[key][target]

export const supports = (key: CapabilityKey, target: TestMode = currentTarget()): boolean =>
  CAPABILITIES[key][target]
