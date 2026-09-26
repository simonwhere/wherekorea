import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Fix "today" so date-dependent logic is deterministic in tests.
    env: { TZ: 'Asia/Seoul' },
  },
})
