/// <reference types="vitest/config" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite 8 + Vitest — config unificada.
 * Producción: plugin React, target ES2022, vendor chunks explícitos.
 * Rutas lazy en App.tsx generan chunks por página automáticamente.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  build: {
    target: 'es2022',
    sourcemap: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react-dom/')
              || id.includes('/react/')
              || id.includes('/react-router')
              || id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('@insforge/')) return 'vendor-insforge';
            if (id.includes('@sentry/')) return 'vendor-sentry';
            if (id.includes('/zod/')) return 'vendor-zod';
            if (id.includes('@dnd-kit/')) return 'vendor-dnd';
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            return 'vendor-misc';
          }

          if (id.includes('/src/lib/schemas')) return 'schemas';
        },
      },
    },
  },

  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/api/tablero.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
