import { z } from 'zod'

export const authTokenSchema = z.strictObject({ token: z.string().min(1) })

export const tokenValidationSchema = z.strictObject({ valid: z.boolean() })

export const logoutResultSchema = z.strictObject({ success: z.boolean() })
