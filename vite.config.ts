import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/ and https://vitest.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The Firestore SDK alone is ~550 kB minified (~165 kB gzip); that chunk is expected.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Vendor code changes rarely: separate chunks stay cached across app deploys.
        advancedChunks: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            {
              name: 'ui',
              test: /node_modules[\\/](@mantine|@floating-ui|@tabler|react-router|dayjs)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.test.ts', 'src/core/__fixtures__/**'],
      // The engine is safety-critical (plan section 5): floors just below current coverage.
      thresholds: { statements: 95, branches: 92, functions: 95, lines: 98 },
    },
  },
})
