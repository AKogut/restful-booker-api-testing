import { describe, it } from 'vitest'
import { supports, type CapabilityKey } from '@profiles/target-profile'

export const itWhenSupported = (key: CapabilityKey) => it.skipIf(!supports(key))

export const describeWhenSupported = (key: CapabilityKey) => describe.skipIf(!supports(key))
