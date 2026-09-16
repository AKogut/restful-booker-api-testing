import { z } from 'zod'
import { isoDate } from './primitives'

export const reportEntrySchema = z.strictObject({
  start: isoDate,
  end: isoDate,
  title: z.string(),
})

export const reportSchema = z.strictObject({ report: z.array(reportEntrySchema) })
