import { fileURLToPath } from 'node:url'
import type { ViteUserConfig } from 'vitest/config'
import { defineConfig } from 'vitest/config'

const alias = (segment: string) => fileURLToPath(new URL(`./src/${segment}`, import.meta.url))

type Reporters = NonNullable<NonNullable<ViteUserConfig['test']>['reporters']>

const reporters = (): Reporters => {
  const active: (string | [string, Record<string, unknown>])[] = ['default']
  if (process.env.CI) {
    active.push(['junit', { outputFile: 'junit.xml' }])
  }
  if (process.env.ALLURE === '1') {
    active.push(['allure-vitest/reporter', { resultsDir: 'allure-results' }])
  }
  return active
}

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    testTimeout: 30_000,
    reporters: reporters(),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@config': alias('config'),
      '@client': alias('client'),
      '@models': alias('models'),
      '@schemas': alias('schemas'),
      '@services': alias('services'),
      '@health': alias('health'),
      '@factories': alias('factories'),
      '@support': alias('support'),
    },
  },
})
