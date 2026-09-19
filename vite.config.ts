import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // ТЗ: iOS Safari 16+. Без явных таргетов minifier вырезает -webkit-backdrop-filter,
    // и стекло пропадает в Safari < 18.
    cssTarget: ['chrome111', 'edge111', 'firefox113', 'safari16'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/test-helpers.ts', 'src/main.tsx'],
    },
  },
})
