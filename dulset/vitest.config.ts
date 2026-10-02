import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Two projects, one `vitest run`:
//   unit        tests/*.test.ts         — pure logic (lib/logic, content loaders), Node, fast
//   components  tests/components/**     — React components in jsdom (@testing-library/react),
//                                         rendered inside the real StoreProvider (tests/setup.ts)
// `npx vitest run --project unit` / `--project components` runs one of them.
const alias = { '@': path.resolve(__dirname, '.') }
// Fix "today" so date-dependent logic is deterministic in tests.
const env = { TZ: 'Asia/Seoul' }

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/*.test.ts'],
          environment: 'node',
          env,
        },
      },
      {
        resolve: { alias },
        // tsconfig says `jsx: preserve` (Next compiles JSX itself); here esbuild must emit the React runtime calls.
        esbuild: { jsx: 'automatic' },
        test: {
          name: 'components',
          include: ['tests/components/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/setup.ts'],
          env,
        },
      },
    ],
  },
})
