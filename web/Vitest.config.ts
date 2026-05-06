import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 'node' para tests de lib puras, 'jsdom' para tests de hooks/componentes
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/api/**', 'src/hooks/**'],
      exclude: ['src/lib/__tests__/**', 'src/hooks/__tests__/**'],
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});