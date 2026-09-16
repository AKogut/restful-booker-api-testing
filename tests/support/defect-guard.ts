import { it } from 'vitest'
import { supports } from '@profiles/target-profile'
import {
  defectFixedMessage,
  observeDefect,
  type DefectReport,
  type DefectReproduction,
} from '@support/defect-guard'

export const guardsDefect = <Observation>(
  report: DefectReport,
  name: string,
  reproduction: DefectReproduction<Observation>,
  timeoutMs?: number,
): void => {
  it.skipIf(!supports('defects.documented'))(
    `${name} (${report})`,
    async () => {
      if ((await observeDefect(reproduction)) === 'fixed') {
        throw new Error(defectFixedMessage(report))
      }
    },
    timeoutMs,
  )
}
