import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@permutation/shared': resolve(import.meta.dirname, 'packages/shared/src/index.ts'),
      '@permutation/db': resolve(import.meta.dirname, 'packages/db/src/index.ts'),
      '@permutation/agent': resolve(import.meta.dirname, 'packages/agent/src/index.ts'),
      '@permutation/tools': resolve(import.meta.dirname, 'packages/tools/src/index.ts'),
      '@permutation/scheduler': resolve(import.meta.dirname, 'packages/scheduler/src/index.ts'),
      '@permutation/connectors': resolve(import.meta.dirname, 'packages/connectors/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 20_000,
  },
})
