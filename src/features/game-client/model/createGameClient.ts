import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { createClockStore, type ClockStoreApi } from '@/entities/clock'
import { createGameStore, type Color, type GameStoreApi, type MoveInput } from '@/entities/game'
import { emptySeats, type PlayerIdentity, type Seats } from '@/entities/player'
import type {
  GameTransport,
  MovedMessage,
  ProtocolErrorCode,
  ServerMessage,
  StateMessage,
  TransportStatus,
} from '@/shared/api'

export interface GameClientState {
  connection: TransportStatus
  /** Хост прислал состояние: доска показывает настоящую партию. */
  synced: boolean
  /** Реплика разошлась с хостом и не смогла восстановиться (нелегальный список ходов). */
  desynced: boolean
  status: StateMessage['status']
  players: Seats
  /** Цвета, за которые ходит этот клиент (в hot-seat — оба). */
  you: Color[]
  drawOffer: Color | null
  rematchRequestedBy: Color | null
  /** Кто из игроков сейчас в комнате. */
  presence: Record<Color, boolean>
  /** Часы; `null` — партия без часов (или состояние ещё не пришло). */
  clock: ClockStoreApi | null
  /** Последний отказ хоста. */
  error: ProtocolErrorCode | null
}

export interface GameClientOptions {
  transport: GameTransport
  gameId: string
  identity: PlayerIdentity
  /** Желаемый цвет при входе. */
  color?: Color
  /**
   * Начальное состояние, известное до подключения (hot-seat: хост создан рядом). Экран сразу
   * показывает партию и часы, а не пустую доску до первого ответа.
   */
  initial?: StateMessage
}

export interface GameClient {
  /** Реплика партии: доска, ходы, результат. Меняется только по сообщениям хоста и своим ходам. */
  game: GameStoreApi
  store: StoreApi<GameClientState>
  /** Подключается и входит в комнату. Можно вызвать снова после `stop`. */
  start(): void
  stop(): void
  /** Оптимистичный ход: применяется у себя сразу, хост подтвердит или откатит. */
  move(input: MoveInput): boolean
  resign(): void
  offerDraw(): void
  answerDraw(accept: boolean): void
  rematch(): void
  /** Отменить свой последний ход (и ответ на него); хост разрешает только против бота. */
  takeback(): void
  /** Запросить у хоста полное состояние. */
  resync(): void
}

/** Ошибки, после которых своя реплика могла разойтись с хостом (отклонённый оптимистичный ход). */
const ROLLBACK_ERRORS: readonly ProtocolErrorCode[] = ['illegal-move', 'not-your-turn', 'game-over']

function toMoveInput(move: MovedMessage['move']): MoveInput {
  const { from, to, promotion } = move
  return { from, to, ...(promotion ? { promotion } : {}) }
}

/**
 * Клиентская сторона партии: держит реплику игры и часов, синхронизирует её с хостом
 * и превращает действия игрока в сообщения протокола. Хост авторитетен: при расхождении
 * реплика заменяется его состоянием.
 */
export function createGameClient(options: GameClientOptions): GameClient {
  const { transport, gameId, identity } = options
  const game = createGameStore()
  const store = createStore<GameClientState>()(() => ({
    connection: 'closed',
    synced: false,
    desynced: false,
    status: 'waiting',
    players: emptySeats(),
    you: [],
    drawOffer: null,
    rematchRequestedBy: null,
    presence: { w: false, b: false },
    clock: null,
    error: null,
  }))
  const patch = (next: Partial<GameClientState>) => store.setState(next)

  const send: GameTransport['send'] = (msg) => transport.send(msg)

  const resync = () => {
    send({ type: 'join', identity, ...(options.color ? { color: options.color } : {}) })
  }

  const applyClock = (clock: StateMessage['clock']) => {
    const current = store.getState().clock
    if (!clock) {
      if (current) patch({ clock: null })
      return
    }
    const { config, remaining, running } = clock
    let target = current
    if (
      !target ||
      target.getState().config.initialMs !== config.initialMs ||
      target.getState().config.incrementMs !== config.incrementMs
    ) {
      target = createClockStore({ config })
      patch({ clock: target })
    }
    target.getState().sync({ remaining, running })
  }

  /** Часы продолжают идти у той же стороны, но остатки берём у хоста. */
  const syncClock = (clock: MovedMessage['clock']) => {
    const target = store.getState().clock
    if (clock && target) target.getState().sync(clock)
  }

  const applyState = (msg: StateMessage) => {
    const loaded = game.getState().load({
      startFen: msg.startFen,
      moves: msg.moves,
      result: msg.result,
    })
    applyClock(msg.clock)
    patch({
      synced: true,
      desynced: !loaded || game.getState().fen !== msg.fen,
      status: msg.status,
      players: msg.players,
      you: msg.you,
      drawOffer: msg.drawOffer,
      ...(msg.result ? {} : { rematchRequestedBy: null }),
    })
  }

  const applyMoved = (msg: MovedMessage) => {
    const moves = game.getState().moves
    if (msg.ply <= moves.length) {
      // Свой оптимистичный ход хост подтвердил; другой ход на этом месте — расхождение
      if (moves[msg.ply - 1]?.san !== msg.san) return resync()
    } else if (msg.ply === moves.length + 1) {
      const outcome = game.getState().move(toMoveInput(msg.move))
      if (!outcome.ok || game.getState().fen !== msg.fen) return resync()
    } else {
      // Пропустили сообщение
      return resync()
    }
    syncClock(msg.clock)
    patch({ drawOffer: null })
  }

  const handle = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'state':
        return applyState(msg)
      case 'moved':
        return applyMoved(msg)
      case 'gameOver': {
        const { startFen, moves } = game.getState()
        game.getState().load({
          startFen,
          moves: moves.map((move) => move.san),
          result: { result: msg.result, reason: msg.reason },
        })
        syncClock(msg.clock)
        return patch({ status: 'over', drawOffer: null })
      }
      case 'drawOffered':
        return patch({ drawOffer: msg.by })
      case 'drawDeclined':
        return patch({ drawOffer: null })
      case 'rematchRequested':
        return patch({ rematchRequestedBy: msg.by })
      case 'opponentPresence':
        return patch({ presence: { ...store.getState().presence, [msg.color]: msg.online } })
      case 'error':
        patch({ error: msg.code })
        if (ROLLBACK_ERRORS.includes(msg.code)) resync()
    }
  }

  if (options.initial) applyState(options.initial)

  let stopListening: (() => void) | null = null

  return {
    game,
    store,

    start: () => {
      if (stopListening) return
      const unsubscribeMessages = transport.subscribe(handle)
      const unsubscribeStatus = transport.onStatusChange((connection) => patch({ connection }))
      stopListening = () => {
        unsubscribeMessages()
        unsubscribeStatus()
        stopListening = null
      }
      transport.connect(gameId, identity).catch(() => patch({ connection: 'closed' }))
      resync()
    },

    stop: () => {
      if (!stopListening) return
      stopListening()
      transport.disconnect()
      patch({ connection: 'closed' })
    },

    move: (input) => {
      const { synced, status, you } = store.getState()
      const { turn, result } = game.getState()
      if (!synced || status !== 'playing' || result || !you.includes(turn)) return false
      if (!game.getState().move(input).ok) return false
      send({ type: 'move', ...input })
      return true
    },

    resign: () => send({ type: 'resign' }),
    offerDraw: () => send({ type: 'offerDraw' }),
    answerDraw: (accept) => send({ type: 'answerDraw', accept }),
    rematch: () => send({ type: 'rematch' }),
    takeback: () => send({ type: 'takeback' }),
    resync,
  }
}
