import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Сервер собирается Vite в SSR-режиме: алиас `@/` и barrel'ы слайсов (React, CSS Modules)
// обрабатываются так же, как в приложении, а неиспользуемое выбрасывается tree-shaking'ом.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    target: 'node24',
    emptyOutDir: true,
  },
})
