import { z } from 'zod'

export const authTokenSchema = z.object({ token: z.string().min(1) }).strict()

export const tokenValidationSchema = z.object({ valid: z.boolean() }).strict()

export const logoutResultSchema = z.object({ success: z.boolean() }).strict()
