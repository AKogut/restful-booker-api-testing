export const DEFECT_REPORTS = [
  'BUG-001',
  'BUG-002',
  'BUG-003',
  'BUG-004',
  'BUG-005',
  'BUG-006',
  'BUG-007',
  'BUG-008',
  'BUG-009',
  'BUG-010',
  'BUG-011',
  'BUG-012',
] as const

export type DefectReport = (typeof DEFECT_REPORTS)[number]

export type DefectVerdict = 'present' | 'fixed'

const isAssertionFailure = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AssertionError'

export const observeDefect = async (body: () => Promise<void>): Promise<DefectVerdict> => {
  try {
    await body()
  } catch (error) {
    if (isAssertionFailure(error)) {
      return 'present'
    }
    throw error
  }
  return 'fixed'
}

export const defectFixedMessage = (report: DefectReport): string =>
  `${report} no longer reproduces — the expectation in this test now holds. Retire the guard and close the report.`
