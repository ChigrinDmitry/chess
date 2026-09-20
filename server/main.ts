import { createChessServer } from './app'

const port = Number(process.env['PORT'] ?? 3001)

const server = createChessServer()
await server.listen(port)
console.log(`chess server listening on :${port}`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0))
  })
}
