import { defineConfig } from 'vitest/config'

// Security rules tests; run through `pnpm test:rules`, which starts the Firestore emulator.
export default defineConfig({
  test: {
    include: ['test/**/*.rules.test.ts'],
    environment: 'node',
    // The emulator is shared state: run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
})
