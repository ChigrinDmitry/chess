import { z } from 'zod'
import { createEmitter } from './emitter'
import {
  parseClientMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from './protocol'
import type { GameTransport, HostTransport, TransportStatus } from './transport'

/**
 * «Онлайн» между вкладками одного браузера: одна вкладка — хост, остальные — клиенты.
 * По каналу ходят конверты; содержимое проверяется Zod-схемами протокола на приёме.
 */
const envelope = z.discriminatedUnion('dir', [
  /** Клиент → хост. */
  z.object({ dir: z.literal('up'), from: z.string(), msg: z.unknown() }),
  /** Хост → клиент; `to: null` — всем. */
  z.object({ dir: z.literal('down'), to: z.string().nullable(), msg: z.unknown() }),
  /** Клиент отключился (закрыл вкладку или вызвал `disconnect`). */
  z.object({ dir: z.literal('bye'), from: z.string() }),
])
type Envelope = z.infer<typeof envelope>

const channelName = (gameId: string) => `chess:game:${gameId}`

function newClientId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  )
}

function open(gameId: string, onEnvelope: (env: Envelope) => void) {
  const channel = new BroadcastChannel(channelName(gameId))
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const parsed = envelope.safeParse(event.data)
    if (parsed.success) onEnvelope(parsed.data)
  }
  return channel
}

/** Клиентская сторона. Идентичность хост узнаёт из сообщения `join`, а не из соединения. */
export function createBroadcastClient(): GameTransport {
  const incoming = createEmitter<[ServerMessage]>()
  const statuses = createEmitter<[TransportStatus]>()
  let status: TransportStatus = 'closed'
  let channel: BroadcastChannel | null = null
  let clientId = ''

  const setStatus = (next: TransportStatus) => {
    if (status === next) return
    status = next
    statuses.emit(next)
  }

  const disconnect = () => {
    if (!channel) return
    const closing = channel
    channel = null
    closing.postMessage({ dir: 'bye', from: clientId } satisfies Envelope)
    closing.close()
    globalThis.removeEventListener?.('pagehide', disconnect)
    setStatus('closed')
  }

  return {
    connect: (gameId) => {
      if (!channel) {
        clientId = newClientId()
        setStatus('connecting')
        channel = open(gameId, (env) => {
          if (env.dir !== 'down' || (env.to !== null && env.to !== clientId)) return
          const msg = parseServerMessage(env.msg)
          if (msg) incoming.emit(msg)
        })
        globalThis.addEventListener?.('pagehide', disconnect)
        setStatus('open')
      }
      return Promise.resolve()
    },
    disconnect,
    send: (msg) => {
      channel?.postMessage({ dir: 'up', from: clientId, msg } satisfies Envelope)
    },
    subscribe: (handler) => incoming.on(handler),
    onStatusChange: (handler) => statuses.on(handler),
  }
}

/** Серверная сторона: хост комнаты `gameId`. Закрытие вкладки без `bye` пока не замечается. */
export function createBroadcastHost(gameId: string): HostTransport {
  const messages = createEmitter<[string, ClientMessage]>()
  const disconnects = createEmitter<[string]>()
  const known = new Set<string>()

  const channel = open(gameId, (env) => {
    if (env.dir === 'bye') {
      if (known.delete(env.from)) disconnects.emit(env.from)
      return
    }
    if (env.dir !== 'up') return
    const msg = parseClientMessage(env.msg)
    if (!msg) return
    known.add(env.from)
    messages.emit(env.from, msg)
  })

  return {
    onMessage: (handler) => messages.on(handler),
    onClientDisconnect: (handler) => disconnects.on(handler),
    send: (clientId, msg) => channel.postMessage({ dir: 'down', to: clientId, msg }),
    broadcast: (msg) => channel.postMessage({ dir: 'down', to: null, msg }),
    close: () => channel.close(),
  }
}
