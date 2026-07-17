import { z } from 'zod'
import { isoDate } from './primitives'

export const reportEntrySchema = z
  .object({
    start: isoDate,
    end: isoDate,
    title: z.string(),
  })
  .strict()

export const reportSchema = z.object({ report: z.array(reportEntrySchema) }).strict()
