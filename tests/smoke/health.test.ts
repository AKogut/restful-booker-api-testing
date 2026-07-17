import { describe, expect, it } from 'vitest'
import { checkHealth } from '@health/health-check'

describe('platform health @smoke', () => {
  it('reports every RBP service as UP', async () => {
    const results = await checkHealth()

    expect(results).toHaveLength(6)
    for (const result of results) {
      expect(result, `${result.service} is ${result.status}`).toMatchObject({
        status: 'UP',
        healthy: true,
      })
    }
  })
})
