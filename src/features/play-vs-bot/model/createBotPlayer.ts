import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import {
  getBotLevel,
  moveTimeBudget,
  type BotClock,
  type BotLevel,
  type BotLevelId,
  type ChessEngine,
} from '@/entities/bot'
import type { ClientMessage, GameTransport, ProtocolIdentity, ServerMessage } from '@/shared/api'

type Color = 'w' | 'b'

export interface BotPlayerState {
  /** Движок загружен и готов считать. */
  ready: boolean
  /** Бот выбирает ход (в том числе выдерживает «человеческую» паузу). */
  thinking: boolean
  /** Движок не запустился или упал; партия с ботом продолжаться не может. */
  error: string | null
}

export interface BotPlayerOptions {
  transport: GameTransport
  gameId: string
  level: BotLevelId
  /** Создаётся при каждом `start` и останавливается в `stop`. */
  createEngine: () => ChessEngine
  /** Цвет, за который бот садится; хост может назначить другой. */
  color?: Color
  /** Источник случайности для паузы; в тестах подменяется. */
  random?: () => number
}

export interface BotPlayer {
  identity: ProtocolIdentity
  store: StoreApi<BotPlayerState>
  /** Подключает бота к комнате и запускает движок. Можно вызвать снова после `stop`. */
  start(): void
  stop(): void
}

export function createBotIdentity(level: BotLevel): ProtocolIdentity {
  return {
    kind: 'bot',
    id: `bot-${level.id}`,
    displayName: `Бот ${level.name}`,
    avatar: { hue: (level.id * 40) % 360, initials: 'Б' },
  }
}

const turnOf = (fen: string): Color => (fen.split(' ')[1] === 'b' ? 'b' : 'w')

/**
 * Ответ на ничью и реванш откладывается: с синхронным транспортом мгновенный ответ вклинился бы
 * в рассылку исходного сообщения, и клиент человека получил бы «предложение» уже после отказа.
 */
const RESPONSE_DELAY_MS = 300

/** Не тратим на «человеческую» паузу больше этой доли остатка на часах. */
const PAUSE_CLOCK_SHARE = 0.05

/**
 * Бот — обычный игрок: входит в комнату, слушает те же сообщения хоста, что и человек, и отвечает
 * сообщением `move`. Партия не знает, что на другой стороне движок. Выбранный ход отправляется не
 * раньше «человеческой» паузы; любое изменение позиции (ход соперника, отмена хода, реванш)
 * отменяет текущий расчёт.
 */
export function createBotPlayer(options: BotPlayerOptions): BotPlayer {
  const { transport, gameId, createEngine, random = Math.random } = options
  const level = getBotLevel(options.level)
  const identity = createBotIdentity(level)
  const store = createStore<BotPlayerState>()(() => ({
    ready: false,
    thinking: false,
    error: null,
  }))
  const patch = (next: Partial<BotPlayerState>) => store.setState(next)

  let engine: ChessEngine | null = null
  let stopListening: (() => void) | null = null
  let pause: ReturnType<typeof setTimeout> | undefined
  const responses = new Set<ReturnType<typeof setTimeout>>()

  // Последнее, что хост сообщил о партии
  let status: 'waiting' | 'playing' | 'over' = 'waiting'
  let fen = ''
  let myColor: Color | null = null
  let clock: { remaining: Record<Color, number>; incrementMs: number } | null = null
  /** Растёт при каждой отмене: устаревший расчёт узнаёт, что его ход больше не нужен. */
  let generation = 0

  const send: GameTransport['send'] = (msg) => transport.send(msg)

  const join = () => {
    send({ type: 'join', identity, ...(options.color ? { color: options.color } : {}) })
  }

  const botClock = (): BotClock | null =>
    clock && myColor
      ? { remainingMs: clock.remaining[myColor], incrementMs: clock.incrementMs }
      : null

  /** Случайная пауза уровня, но не дороже доли остатка времени. */
  const humanPause = (): number => {
    const [min, max] = level.delayMs
    const wanted = min + random() * (max - min)
    const current = botClock()
    return current ? Math.min(wanted, current.remainingMs * PAUSE_CLOCK_SHARE) : wanted
  }

  const respond = (msg: ClientMessage) => {
    const timer = setTimeout(() => {
      responses.delete(timer)
      send(msg)
    }, RESPONSE_DELAY_MS)
    responses.add(timer)
  }

  const cancel = () => {
    generation++
    clearTimeout(pause)
    pause = undefined
    engine?.stop()
    if (store.getState().thinking) patch({ thinking: false })
  }

  const think = async () => {
    if (!engine || status !== 'playing' || !myColor || turnOf(fen) !== myColor) return
    const mine = generation
    const position = fen
    const startedAt = Date.now()
    patch({ thinking: true })
    try {
      const move = await engine.bestMove(position, moveTimeBudget(level, botClock()))
      if (mine !== generation) return
      if (!move) return patch({ thinking: false })
      const wait = humanPause() - (Date.now() - startedAt)
      if (wait > 0) {
        await new Promise<void>((resolve) => {
          pause = setTimeout(resolve, wait)
        })
        if (mine !== generation) return
      }
      patch({ thinking: false })
      send({
        type: 'move',
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion } : {}),
      })
    } catch (error) {
      if (mine !== generation) return
      patch({
        thinking: false,
        error: error instanceof Error ? error.message : 'Не удалось запустить бота',
      })
    }
  }

  const handle = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'state':
        cancel()
        status = msg.status
        fen = msg.fen
        myColor = msg.you[0] ?? null
        clock = msg.clock
          ? { remaining: msg.clock.remaining, incrementMs: msg.clock.config.incrementMs }
          : null
        return void think()
      case 'moved':
        cancel()
        fen = msg.fen
        if (msg.clock && clock) clock = { ...clock, remaining: msg.clock.remaining }
        return void think()
      case 'gameOver':
        cancel()
        status = 'over'
        return
      case 'drawOffered':
        // Бот не соглашается на ничью, но и не оставляет предложение без ответа
        if (msg.by !== myColor) respond({ type: 'answerDraw', accept: false })
        return
      case 'rematchRequested':
        if (msg.by !== myColor) respond({ type: 'rematch' })
        return
      case 'error':
        // Наш ход опоздал или не подошёл к позиции хоста: сверяемся с ним
        if (msg.code === 'not-your-turn' || msg.code === 'illegal-move') join()
        return
    }
  }

  return {
    identity,
    store,

    start: () => {
      if (stopListening) return
      patch({ ready: false, thinking: false, error: null })
      const started = createEngine()
      engine = started
      started.setLevel(level.id)
      started.init().then(
        () => {
          if (engine === started) patch({ ready: true })
        },
        (error: unknown) => {
          if (engine === started) {
            patch({ error: error instanceof Error ? error.message : 'Не удалось запустить бота' })
          }
        },
      )

      const unsubscribe = transport.subscribe(handle)
      stopListening = () => {
        unsubscribe()
        stopListening = null
      }
      transport.connect(gameId, identity).catch(() => patch({ error: 'Нет связи с партией' }))
      join()
    },

    stop: () => {
      if (!stopListening) return
      cancel()
      for (const timer of responses) clearTimeout(timer)
      responses.clear()
      stopListening()
      transport.disconnect()
      engine?.dispose()
      engine = null
      status = 'waiting'
      patch({ ready: false, thinking: false })
    },
  }
}
