import {
  createClockStore,
  flaggedColor,
  snapshotClock,
  watchFlag,
  type ClockConfig,
} from '@/entities/clock'
import { createGameStore, type Color, type MoveInput } from '@/entities/game'
import {
  colorOf,
  emptySeats,
  freeColor,
  isFull,
  seat,
  type PlayerIdentity,
  type Seats,
} from '@/entities/player'
import type { ClientMessage, HostTransport, ProtocolErrorCode, StateMessage } from '@/shared/api'

export interface GameHostOptions {
  transport: HostTransport
  /** Контроль времени; `null` — партия без часов. */
  clock: ClockConfig | null
  /**
   * Hot-seat: за обе стороны играет один клиент. Места заняты сразу, а от имени той стороны,
   * которая должна действовать (чей ход; кто отвечает на ничью), выступает любой клиент.
   */
  hotSeat?: Record<Color, PlayerIdentity>
  /** Источник времени; в тестах подменяется. */
  now?: () => number
}

export interface GameHost {
  /** Состояние для клиента `clientId`; без него — как его увидит единственный клиент hot-seat. */
  snapshot(clientId?: string): StateMessage
  /** Начинает принимать сообщения. Можно вызвать снова после `stop`. */
  start(): void
  /** Перестаёт слушать транспорт и гасит таймеры. Сам транспорт закрывает тот, кто его создал. */
  stop(): void
}

type JoinMessage = Extract<ClientMessage, { type: 'join' }>

const other = (color: Color): Color => (color === 'w' ? 'b' : 'w')

/**
 * Авторитетная логика партии: проверяет ходы, ведёт часы, определяет исход и рассылает
 * состояние клиентам. Клиент только просит («ход», «сдаюсь», «ничья»), а решает хост.
 * Транспорт лишь передаёт сообщения; с появлением сервера эту роль займёт он.
 */
export function createGameHost(options: GameHostOptions): GameHost {
  const { transport, hotSeat, now = Date.now } = options
  const game = createGameStore()
  const clock = options.clock ? createClockStore({ config: options.clock, now }) : null

  let seats: Seats = hotSeat ? { w: hotSeat.w, b: hotSeat.b } : emptySeats()
  /** Вошедшие клиенты; личность `null` — у клиента hot-seat. */
  const clients = new Map<string, PlayerIdentity | null>()
  let drawOffer: Color | null = null
  let announcedOver = false
  const rematchVotes = new Set<Color>()
  let stopListening: (() => void) | null = null

  const status = (): StateMessage['status'] =>
    game.getState().result ? 'over' : isFull(seats) ? 'playing' : 'waiting'

  const colorsOf = (clientId: string): Color[] => {
    if (!clients.has(clientId)) return []
    if (hotSeat) return ['w', 'b']
    const identity = clients.get(clientId)
    const color = identity ? colorOf(seats, identity.id) : null
    return color ? [color] : []
  }

  /** Сторона, от имени которой клиент сдаётся или предлагает ничью. */
  const selfColor = (clientId: string): Color | null => {
    const colors = colorsOf(clientId)
    return colors.length === 2 ? game.getState().turn : (colors[0] ?? null)
  }

  const clockSnapshot = () => (clock ? snapshotClock(clock.getState(), now()) : null)

  const snapshot = (clientId?: string): StateMessage => {
    const { startFen, fen, moves, result } = game.getState()
    return {
      type: 'state',
      status: status(),
      startFen,
      fen,
      moves: moves.map((move) => move.san),
      clock: clock ? { config: clock.getState().config, ...clockSnapshot()! } : null,
      result,
      players: seats,
      you: clientId === undefined ? (hotSeat ? ['w', 'b'] : []) : colorsOf(clientId),
      drawOffer,
    }
  }

  const fail = (clientId: string, code: ProtocolErrorCode) => {
    transport.send(clientId, { type: 'error', code })
  }

  const sendStateToAll = () => {
    for (const clientId of clients.keys()) transport.send(clientId, snapshot(clientId))
  }

  const online = (color: Color): boolean => {
    const player = seats[color]
    if (!player) return false
    if (hotSeat) return clients.size > 0
    return [...clients.values()].some((identity) => identity?.id === player.id)
  }

  const broadcastPresence = () => {
    for (const color of ['w', 'b'] as const) {
      if (seats[color])
        transport.broadcast({ type: 'opponentPresence', color, online: online(color) })
    }
  }

  /** Партия закончилась (любым способом) — часы встают, все узнают итог. Один раз. */
  const announceIfOver = () => {
    const { result } = game.getState()
    if (!result || announcedOver) return
    announcedOver = true
    drawOffer = null
    clock?.getState().stop()
    transport.broadcast({ type: 'gameOver', ...result, clock: clockSnapshot() })
  }

  const resetGame = (swapColors: boolean) => {
    game.getState().reset()
    clock?.getState().reset()
    drawOffer = null
    announcedOver = false
    rematchVotes.clear()
    if (swapColors) seats = { w: seats.b, b: seats.w }
    sendStateToAll()
    broadcastPresence()
  }

  const join = (clientId: string, msg: JoinMessage) => {
    if (hotSeat) {
      clients.set(clientId, null)
    } else {
      const color = colorOf(seats, msg.identity.id) ?? freeColor(seats, msg.color)
      const next = color && seat(seats, color, msg.identity)
      if (!next) return fail(clientId, 'room-full')
      seats = next
      clients.set(clientId, msg.identity)
    }
    sendStateToAll()
    broadcastPresence()
  }

  const move = (clientId: string, input: MoveInput) => {
    const current = status()
    if (current !== 'playing')
      return fail(clientId, current === 'over' ? 'game-over' : 'not-started')
    if (!colorsOf(clientId).includes(game.getState().turn)) return fail(clientId, 'not-your-turn')

    const before = game.getState().moves.length
    const outcome = game.getState().move(input)
    if (!outcome.ok) return fail(clientId, 'illegal-move')

    drawOffer = null
    if (clock) {
      if (game.getState().result) {
        clock.getState().stop()
      } else if (before === 0) {
        // Первый ход времени не тратит и инкремента не даёт: часы стартуют у соперника
        clock.getState().start(game.getState().turn)
      } else {
        clock.getState().press()
        // Ходил уже с упавшим флагом, а таймер не успел сработать: время вышло раньше
        const flagged = flaggedColor(clock.getState(), now())
        if (flagged) game.getState().flag(flagged)
      }
    }

    const played = outcome.move
    transport.broadcast({
      type: 'moved',
      ply: game.getState().moves.length,
      san: played.san,
      move: {
        from: played.from,
        to: played.to,
        ...(played.promotion ? { promotion: played.promotion } : {}),
      },
      fen: played.fen,
      clock: clockSnapshot(),
    })
    announceIfOver()
  }

  const requireActive = (clientId: string): Color | null => {
    const current = status()
    if (current !== 'playing') {
      fail(clientId, current === 'over' ? 'game-over' : 'not-started')
      return null
    }
    const color = selfColor(clientId)
    if (!color) fail(clientId, 'not-joined')
    return color
  }

  const offerDraw = (clientId: string) => {
    const color = requireActive(clientId)
    if (!color || drawOffer === color) return
    if (drawOffer) {
      // Оба предложили ничью — это согласие
      game.getState().agreeDraw()
      announceIfOver()
      return
    }
    drawOffer = color
    transport.broadcast({ type: 'drawOffered', by: color })
  }

  const answerDraw = (clientId: string, accept: boolean) => {
    if (requireActive(clientId) === null) return
    if (!drawOffer) return fail(clientId, 'no-draw-offer')
    if (!colorsOf(clientId).includes(other(drawOffer))) return fail(clientId, 'not-your-turn')

    drawOffer = null
    if (accept) {
      game.getState().agreeDraw()
      announceIfOver()
    } else {
      transport.broadcast({ type: 'drawDeclined' })
    }
  }

  const rematch = (clientId: string) => {
    if (hotSeat) return resetGame(false)
    if (!game.getState().result) return fail(clientId, 'game-not-over')
    const color = colorsOf(clientId)[0]
    if (!color) return fail(clientId, 'not-joined')

    rematchVotes.add(color)
    if (rematchVotes.size === 2) resetGame(true)
    else transport.broadcast({ type: 'rematchRequested', by: color })
  }

  const handle = (clientId: string, msg: ClientMessage) => {
    if (msg.type === 'join') return join(clientId, msg)
    // Пульс для обнаружения обрывов появится вместе с онлайн-режимом (этап 6)
    if (msg.type === 'ping') return
    if (!clients.has(clientId)) return fail(clientId, 'not-joined')

    switch (msg.type) {
      case 'move':
        return move(clientId, {
          from: msg.from,
          to: msg.to,
          ...(msg.promotion ? { promotion: msg.promotion } : {}),
        })
      case 'resign': {
        const color = requireActive(clientId)
        if (!color) return
        game.getState().resign(color)
        return announceIfOver()
      }
      case 'offerDraw':
        return offerDraw(clientId)
      case 'answerDraw':
        return answerDraw(clientId, msg.accept)
      case 'rematch':
        return rematch(clientId)
      case 'takeback':
        // Отмена хода — только против бота (этап 7)
        return fail(clientId, 'unsupported')
    }
  }

  return {
    snapshot,
    start: () => {
      if (stopListening) return
      const stops = [
        transport.onMessage(handle),
        transport.onClientDisconnect((clientId) => {
          if (clients.delete(clientId)) broadcastPresence()
        }),
        clock &&
          watchFlag(
            clock,
            (color) => {
              game.getState().flag(color)
              announceIfOver()
            },
            now,
          ),
      ]
      stopListening = () => {
        for (const stop of stops) stop?.()
        clients.clear()
        stopListening = null
      }
    },
    stop: () => stopListening?.(),
  }
}
