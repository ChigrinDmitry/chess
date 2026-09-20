import { createServer } from 'vite'

// Dev-запуск сервера: Vite грузит `server/main.ts` как SSR-модуль (алиас `@/`, CSS Modules).
// Перезапуск при правках — снаружи: `node --watch-path=./server --watch-path=./src`.
const vite = await createServer({
  configFile: 'vite.server.config.ts',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true },
})

process.once('exit', () => void vite.close())
await vite.ssrLoadModule('/server/main.ts')
