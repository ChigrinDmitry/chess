import { createEmitter } from './emitter'
import type { ClientMessage, ServerMessage } from './protocol'
import type { GameTransport, HostTransport, TransportStatus } from './transport'

export interface LocalRoom {
  host: HostTransport
  createClient(): GameTransport
}

/**
 * Комната в памяти без сети (hot-seat, бот): хост и клиенты живут в одной вкладке.
 * Сообщения доставляются синхронно, поэтому UI отвечает сразу; логика хоста и клиента
 * от синхронности не зависит — они рассчитаны и на асинхронные транспорты.
 */
export function createLocalRoom(): LocalRoom {
  const clients = new Map<string, { deliver: (msg: ServerMessage) => void; close: () => void }>()
  const messages = createEmitter<[clientId: string, msg: ClientMessage]>()
  const disconnects = createEmitter<[clientId: string]>()
  let seq = 0

  const host: HostTransport = {
    onMessage: (handler) => messages.on(handler),
    onClientDisconnect: (handler) => disconnects.on(handler),
    send: (clientId, msg) => clients.get(clientId)?.deliver(msg),
    broadcast: (msg) => {
      for (const client of [...clients.values()]) client.deliver(msg)
    },
    close: () => {
      for (const client of [...clients.values()]) client.close()
    },
  }

  const createClient = (): GameTransport => {
    const id = `local-${++seq}`
    const incoming = createEmitter<[ServerMessage]>()
    const statuses = createEmitter<[TransportStatus]>()
    let status: TransportStatus = 'closed'

    const setStatus = (next: TransportStatus) => {
      if (status === next) return
      status = next
      statuses.emit(next)
    }
    const close = () => {
      if (status === 'closed') return
      clients.delete(id)
      setStatus('closed')
      disconnects.emit(id)
    }

    return {
      connect: () => {
        if (status !== 'open') {
          clients.set(id, { deliver: (msg) => incoming.emit(msg), close })
          setStatus('open')
        }
        return Promise.resolve()
      },
      disconnect: close,
      send: (msg) => {
        if (status === 'open') messages.emit(id, msg)
      },
      subscribe: (handler) => incoming.on(handler),
      onStatusChange: (handler) => statuses.on(handler),
    }
  }

  return { host, createClient }
}
