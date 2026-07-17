export type HealthStatus = 'UP' | 'DOWN' | 'OUT_OF_SERVICE' | 'UNKNOWN'

export interface HealthReport {
  status: HealthStatus
  groups?: string[]
}
