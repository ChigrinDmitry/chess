import { createHash, timingSafeEqual } from 'node:crypto'
import { WebSocket } from 'ws'
import {
  parseClientMessage,
  type ClientMessage,
  type HostTransport,
  type ServerMessage,
  type Unsubscribe,
} from '@/shared/api'

export interface WsHostTransport extends HostTransport {
  /** Подключает сокет как нового клиента комнаты. */
  attach(socket: WebSocket): void
  /** Число подключённых клиентов. */
  readonly size: number
}

export interface WsHostTransportOptions {
  /** Период проверки живых соединений; молчащий клиент отключается через два периода. */
  heartbeatMs?: number
}

const hashToken = (token: string) => createHash('sha256').update(token).digest()

/**
 * Серверная сторона канала комнаты поверх WebSocket: JSON в обе стороны, входящее проверяется
 * схемами протокола. Оборванные соединения ловит heartbeat (ws ping/pong) — хост узнаёт о них
 * через `onClientDisconnect`, как о закрытой вкладке.
 *
 * Место в комнате защищено секретом: первый `join` с данным `identity.id` привязывает к нему
 * `token`, дальше `join` с другим (или без) токена отклоняется ошибкой `unauthorized` и до хоста
 * не доходит. Токен хранится хэшем и хосту не передаётся.
 */
export function createWsHostTransport(options: WsHostTransportOptions = {}): WsHostTransport {
  const { heartbeatMs = 30_000 } = options
  const clients = new Map<string, WebSocket>()
  const alive = new WeakSet<WebSocket>()
  const seatTokens = new Map<string, Buffer>()
  const messageHandlers = new Set<(clientId: string, msg: ClientMessage) => void>()
  const disconnectHandlers = new Set<(clientId: string) => void>()
  let seq = 0

  const write = (socket: WebSocket, msg: ServerMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg))
  }

  /** Проверяет `join` и возвращает его без токена; `null` — секрет не подошёл. */
  const authorizeJoin = (msg: Extract<ClientMessage, { type: 'join' }>): ClientMessage | null => {
    if (!msg.token) return null
    const hash = hashToken(msg.token)
    const bound = seatTokens.get(msg.identity.id)
    if (!bound) seatTokens.set(msg.identity.id, hash)
    else if (!timingSafeEqual(bound, hash)) return null
    return msg.color
      ? { type: 'join', identity: msg.identity, color: msg.color }
      : { type: 'join', identity: msg.identity }
  }

  const heartbeat = setInterval(() => {
    for (const socket of clients.values()) {
      if (!alive.has(socket)) {
        socket.terminate()
        continue
      }
      alive.delete(socket)
      socket.ping()
    }
  }, heartbeatMs)
  heartbeat.unref()

  const subscribe = <T>(set: Set<T>, handler: T): Unsubscribe => {
    set.add(handler)
    return () => {
      set.delete(handler)
    }
  }

  return {
    get size() {
      return clients.size
    },
    attach: (socket) => {
      const clientId = `ws-${++seq}`
      clients.set(clientId, socket)
      alive.add(socket)

      socket.on('pong', () => alive.add(socket))
      socket.on('message', (data, isBinary) => {
        alive.add(socket)
        if (isBinary) return
        let json: unknown
        try {
          json = JSON.parse(data.toString())
        } catch {
          return write(socket, { type: 'error', code: 'unsupported' })
        }
        const msg = parseClientMessage(json)
        if (!msg) return write(socket, { type: 'error', code: 'unsupported' })
        let forwarded: ClientMessage | null = msg
        if (msg.type === 'join') forwarded = authorizeJoin(msg)
        if (!forwarded) return write(socket, { type: 'error', code: 'unauthorized' })
        for (const handler of [...messageHandlers]) handler(clientId, forwarded)
      })
      socket.on('close', () => {
        if (!clients.delete(clientId)) return
        for (const handler of [...disconnectHandlers]) handler(clientId)
      })
      socket.on('error', () => socket.terminate())
    },
    onMessage: (handler) => subscribe(messageHandlers, handler),
    onClientDisconnect: (handler) => subscribe(disconnectHandlers, handler),
    send: (clientId, msg) => {
      const socket = clients.get(clientId)
      if (socket) write(socket, msg)
    },
    broadcast: (msg) => {
      for (const socket of clients.values()) write(socket, msg)
    },
    close: () => {
      clearInterval(heartbeat)
      const sockets = [...clients.values()]
      clients.clear()
      messageHandlers.clear()
      disconnectHandlers.clear()
      for (const socket of sockets) socket.close(1001)
    },
  }
}
