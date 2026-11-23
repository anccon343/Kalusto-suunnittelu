import { defineConfig } from 'vitest/config'

// Emulator tests (security rules and data layer); run through `pnpm test:emulator`.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The emulator is shared state: run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
})
