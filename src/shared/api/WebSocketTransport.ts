import { createEmitter } from './emitter'
import { parseServerMessage, type ClientMessage, type ServerMessage } from './protocol'
import type { GameTransport, TransportStatus } from './transport'

export interface WebSocketTransportOptions {
  /** Адрес сокета комнаты; по умолчанию — тот же хост, путь `/ws/:gameId`. */
  url?: (gameId: string) => string
  /** Фабрика сокета; в тестах подменяется. */
  createSocket?: (url: string) => WebSocket
  reconnect?: {
    /** Первая пауза перед повтором, дальше она удваивается. */
    baseMs?: number
    maxMs?: number
    /** Сколько попыток подряд может не удаться до первого открытия, прежде чем сдаться. */
    maxInitialAttempts?: number
  }
  /** Источник случайности для «дрожания» пауз; в тестах подменяется. */
  random?: () => number
}

/** Сообщений, копящихся до открытия сокета; при переполнении отбрасываются самые старые. */
const MAX_QUEUE = 50

/** Код закрытия сервера «попробуйте позже» — комната переполнена; повторять бессмысленно. */
const CLOSE_TRY_LATER = 1013

function defaultUrl(gameId: string): string {
  const { protocol, host } = globalThis.location
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws/${encodeURIComponent(gameId)}`
}

/**
 * Клиентская сторона канала поверх WebSocket (сервер — `server/`).
 *
 * - `send` до открытия ставит сообщение в очередь; после `disconnect` сообщения отбрасываются.
 * - Обрыв после успешного открытия → статус `reconnecting`, повторы с растущей паузой без
 *   ограничения; после каждого открытия первым уходит последний `join` (resync), так что состояние
 *   партии обновляется без участия клиента партии.
 * - Пока соединение не открылось ни разу, повторов ограничено `maxInitialAttempts`: комнаты
 *   может не быть, а браузер не отличает 404 от обрыва сети.
 * - Секрет места (`auth` из `connect`) подставляется в каждый `join`; клиент партии его не видит.
 */
export function createWebSocketClient(options: WebSocketTransportOptions = {}): GameTransport {
  const { url = defaultUrl, createSocket = (target) => new WebSocket(target) } = options
  const { baseMs = 500, maxMs = 10_000, maxInitialAttempts = 5 } = options.reconnect ?? {}
  const random = options.random ?? Math.random

  const incoming = createEmitter<[ServerMessage]>()
  const statuses = createEmitter<[TransportStatus]>()
  let status: TransportStatus = 'closed'

  /** `null` — не подключены (до `connect` и после `disconnect`). */
  let session: { gameId: string; token: string | undefined } | null = null
  let socket: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let opened = false
  let failures = 0
  let queue: ClientMessage[] = []
  let lastJoin: ClientMessage | null = null
  let pending: { promise: Promise<void>; resolve(): void; reject(error: Error): void } | null = null

  const setStatus = (next: TransportStatus) => {
    if (status === next) return
    status = next
    statuses.emit(next)
  }

  const write = (msg: ClientMessage) => {
    const wire = msg.type === 'join' && session?.token ? { ...msg, token: session.token } : msg
    socket?.send(JSON.stringify(wire))
  }

  const flush = () => {
    const waiting = queue
    queue = []
    // После переподключения состояние надо получить заново, даже если клиент ничего не слал
    if (lastJoin && !waiting.some((msg) => msg.type === 'join')) waiting.unshift(lastJoin)
    for (const msg of waiting) write(msg)
  }

  const giveUp = () => {
    session = null
    queue = []
    lastJoin = null
    setStatus('closed')
    pending?.reject(new Error('Не удалось подключиться к партии'))
    pending = null
  }

  const scheduleRetry = () => {
    const delay = Math.min(maxMs, baseMs * 2 ** Math.min(failures, 16))
    // «Дрожание» разводит по времени клиентов, потерявших связь одновременно (рестарт сервера)
    retryTimer = setTimeout(connectSocket, delay * (0.5 + random() / 2))
    failures++
  }

  const handleClose = (code: number) => {
    socket = null
    if (!session) return
    if (code === CLOSE_TRY_LATER) return giveUp()
    if (!opened && failures + 1 >= maxInitialAttempts) return giveUp()
    setStatus(opened ? 'reconnecting' : 'connecting')
    scheduleRetry()
  }

  function connectSocket() {
    if (!session) return
    const ws = createSocket(url(session.gameId))
    socket = ws
    ws.onopen = () => {
      if (socket !== ws) return
      opened = true
      failures = 0
      setStatus('open')
      pending?.resolve()
      pending = null
      flush()
    }
    ws.onmessage = (event: MessageEvent<unknown>) => {
      if (socket !== ws || typeof event.data !== 'string') return
      let json: unknown
      try {
        json = JSON.parse(event.data)
      } catch {
        return
      }
      const msg = parseServerMessage(json)
      if (msg) incoming.emit(msg)
    }
    ws.onclose = (event) => {
      if (socket === ws) handleClose(event.code)
    }
    // За `error` всегда следует `close`, повтор планируем там
    ws.onerror = () => {}
  }

  const disconnect = () => {
    if (!session) return
    session = null
    clearTimeout(retryTimer)
    const closing = socket
    socket = null
    closing?.close()
    queue = []
    lastJoin = null
    setStatus('closed')
    pending?.reject(new Error('Соединение закрыто до открытия'))
    pending = null
  }

  return {
    connect: (gameId, _identity, auth) => {
      if (pending) return pending.promise
      if (session) return Promise.resolve()
      session = { gameId, token: auth }
      opened = false
      failures = 0
      setStatus('connecting')
      let resolve!: () => void
      let reject!: (error: Error) => void
      const promise = new Promise<void>((res, rej) => {
        resolve = res
        reject = rej
      })
      pending = { promise, resolve, reject }
      connectSocket()
      return promise
    },
    disconnect,
    send: (msg) => {
      if (!session) return
      if (msg.type === 'join') {
        lastJoin = msg
        queue = queue.filter((queued) => queued.type !== 'join')
      }
      if (status === 'open') return write(msg)
      queue.push(msg)
      if (queue.length > MAX_QUEUE) queue.shift()
    },
    subscribe: (handler) => incoming.on(handler),
    onStatusChange: (handler) => statuses.on(handler),
  }
}
