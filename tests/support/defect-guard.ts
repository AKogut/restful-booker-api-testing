import { it } from 'vitest'
import { supports } from '@profiles/target-profile'
import { defectFixedMessage, observeDefect, type DefectReport } from '@support/defect-guard'

export const guardsDefect = (
  report: DefectReport,
  name: string,
  body: () => Promise<void>,
  timeoutMs?: number,
): void => {
  it.skipIf(!supports('defects.documented'))(
    `${name} (${report})`,
    async () => {
      if ((await observeDefect(body)) === 'fixed') {
        throw new Error(defectFixedMessage(report))
      }
    },
    timeoutMs,
  )
}
