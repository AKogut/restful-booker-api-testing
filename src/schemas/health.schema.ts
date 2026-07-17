import { z } from 'zod'

export const healthReportSchema = z.object({
  status: z.enum(['UP', 'DOWN', 'OUT_OF_SERVICE', 'UNKNOWN']),
  groups: z.array(z.string()).optional(),
})
