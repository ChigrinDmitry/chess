import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import type { ClockConfig } from '@/entities/clock'
import { createGameHost, type GameHost } from '@/features/host-game'
import { createWsHostTransport, type WsHostTransport } from '../transport/wsHostTransport'

export interface RoomRegistryOptions {
  /** Через сколько мс без единого клиента комната удаляется (в том числе не занятая с создания). */
  emptyTtlMs?: number
  /** Предел числа одновременных комнат. */
  maxRooms?: number
  /** Предел соединений в одной комнате: два игрока с запасом на вторые вкладки. */
  maxClientsPerRoom?: number
  heartbeatMs?: number
  /** Источник времени для часов партий; в тестах подменяется. */
  now?: () => number
}

export type AttachResult = 'ok' | 'not-found' | 'full'

export interface RoomRegistry {
  /** Создаёт комнату; `null`, если достигнут предел числа комнат. */
  create(clock: ClockConfig | null): string | null
  has(gameId: string): boolean
  attach(gameId: string, socket: WebSocket): AttachResult
  readonly size: number
  close(): void
}

interface Room {
  transport: WsHostTransport
  host: GameHost
  idleTimer: ReturnType<typeof setTimeout> | undefined
}

/**
 * Комнаты в памяти процесса: `gameId` → своя партия (`createGameHost`) со своим транспортом.
 * Состояние не переживает рестарт сервера — хранилище сюда добавится, когда решим, что нужно.
 */
export function createRoomRegistry(options: RoomRegistryOptions = {}): RoomRegistry {
  const {
    emptyTtlMs = 10 * 60_000,
    maxRooms = 1000,
    maxClientsPerRoom = 8,
    heartbeatMs,
    now,
  } = options
  const rooms = new Map<string, Room>()

  const destroy = (gameId: string) => {
    const room = rooms.get(gameId)
    if (!room) return
    rooms.delete(gameId)
    clearTimeout(room.idleTimer)
    room.host.stop()
    room.transport.close()
  }

  const armIdleTimer = (gameId: string, room: Room) => {
    clearTimeout(room.idleTimer)
    room.idleTimer = setTimeout(() => destroy(gameId), emptyTtlMs)
    room.idleTimer.unref()
  }

  const newGameId = (): string => {
    // Ссылка-приглашение — единственный «секрет» комнаты, поэтому id непредсказуемый
    let id: string
    do id = randomBytes(9).toString('base64url')
    while (rooms.has(id))
    return id
  }

  return {
    create: (clock) => {
      if (rooms.size >= maxRooms) return null
      const gameId = newGameId()
      const transport = createWsHostTransport(heartbeatMs === undefined ? {} : { heartbeatMs })
      const host = createGameHost({ transport, clock, ...(now ? { now } : {}) })
      host.start()
      const room: Room = { transport, host, idleTimer: undefined }
      transport.onClientDisconnect(() => {
        if (transport.size === 0) armIdleTimer(gameId, room)
      })
      rooms.set(gameId, room)
      armIdleTimer(gameId, room)
      return gameId
    },
    has: (gameId) => rooms.has(gameId),
    attach: (gameId, socket) => {
      const room = rooms.get(gameId)
      if (!room) return 'not-found'
      if (room.transport.size >= maxClientsPerRoom) return 'full'
      clearTimeout(room.idleTimer)
      room.transport.attach(socket)
      return 'ok'
    },
    get size() {
      return rooms.size
    },
    close: () => {
      for (const gameId of [...rooms.keys()]) destroy(gameId)
    },
  }
}
