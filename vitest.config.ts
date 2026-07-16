import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = (segment: string) => fileURLToPath(new URL(`./src/${segment}`, import.meta.url))

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    reporters: process.env.CI ? ['default', ['junit', { outputFile: 'junit.xml' }]] : ['default'],
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
      '@factories': alias('factories'),
      '@support': alias('support'),
    },
  },
})
