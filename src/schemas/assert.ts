import type { z } from 'zod'

export const assertValid = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Schema validation failed:\n${issues}\nReceived: ${JSON.stringify(data)}`)
  }
  return result.data
}
