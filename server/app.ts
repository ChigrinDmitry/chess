import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocketServer } from 'ws'
import { BodyTooLargeError, createGameBody, readJson } from './http/createGame'
import { createRoomRegistry, type RoomRegistryOptions } from './rooms/roomRegistry'

/** Сообщения протокола крошечные; всё, что больше, — не игра. */
const MAX_WS_PAYLOAD_BYTES = 4096

const WS_PATH = /^\/ws\/([\w-]{1,64})$/

export interface ChessServer {
  /** Начинает слушать порт (0 — любой свободный) и возвращает фактический. */
  listen(port: number, host?: string): Promise<number>
  close(): Promise<void>
}

function reply(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(body === undefined ? undefined : JSON.stringify(body))
}

/**
 * HTTP: `POST /api/games` создаёт комнату, `GET /api/health` — проверка живости.
 * WebSocket: `/ws/:gameId` подключает клиента к комнате; всю игру ведёт хост комнаты.
 */
export function createChessServer(options: RoomRegistryOptions = {}): ChessServer {
  const registry = createRoomRegistry(options)
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD_BYTES })

  const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')

    if (pathname === '/api/health') return reply(res, 200, { ok: true })
    if (pathname !== '/api/games') return reply(res, 404)
    if (req.method !== 'POST') return reply(res, 405)

    let body: unknown
    try {
      body = await readJson(req)
    } catch (error) {
      if (error instanceof BodyTooLargeError) return reply(res, 413)
      throw error
    }
    const parsed = createGameBody.safeParse(body)
    if (!parsed.success) return reply(res, 400, { error: 'invalid-body' })

    const gameId = registry.create(parsed.data.clock)
    if (!gameId) return reply(res, 503, { error: 'too-many-games' })
    reply(res, 201, { gameId })
  }

  const server = createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      if (!res.headersSent) reply(res, 500)
      else res.end()
    })
  })

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    const gameId = WS_PATH.exec(pathname)?.[1]
    if (!gameId || !registry.has(gameId)) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const result = registry.attach(gameId, ws)
      // 1013 — «попробуйте позже»: комната переполнена или только что закрылась
      if (result !== 'ok') ws.close(1013, result)
    })
  })

  return {
    listen: (port, host) =>
      new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => {
          server.off('error', reject)
          resolve((server.address() as AddressInfo).port)
        })
      }),
    close: () =>
      new Promise((resolve) => {
        registry.close()
        wss.close()
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}
