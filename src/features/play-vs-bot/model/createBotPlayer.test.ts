import type { BotLevelId, ChessEngine, EngineMove } from '@/entities/bot'
import type { ClientMessage, GameTransport, ServerMessage } from '@/shared/api'
import { createBotIdentity, createBotPlayer } from './createBotPlayer'
import { getBotLevel } from '@/entities/bot'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
const E5: EngineMove = { from: 'e7', to: 'e5' }

/** Транспорт-двойник: сообщения хоста «произносит» тест, отправленное записывается. */
function fakeTransport() {
  const sent: ClientMessage[] = []
  let handler: (msg: ServerMessage) => void = () => {}
  const transport: GameTransport = {
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(),
    send: (msg) => sent.push(msg),
    subscribe: (h) => {
      handler = h
      return () => {
        handler = () => {}
      }
    },
    onStatusChange: () => () => {},
  }
  return { transport, sent, receive: (msg: ServerMessage) => handler(msg) }
}

/** Движок-двойник: ответ на поиск выдаёт тест. */
function fakeEngine() {
  let resolveSearch: (move: EngineMove | null) => void = () => {}
  let resolveInit: () => void = () => {}
  let rejectInit: (error: Error) => void = () => {}
  const searches: { fen: string; timeMs: number }[] = []
  const engine: ChessEngine = {
    init: vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          resolveInit = resolve
          rejectInit = reject
        }),
    ),
    setLevel: vi.fn(),
    bestMove: vi.fn((fen: string, timeMs: number) => {
      searches.push({ fen, timeMs })
      return new Promise<EngineMove | null>((resolve) => (resolveSearch = resolve))
    }),
    stop: vi.fn(() => resolveSearch(null)),
    dispose: vi.fn(),
  }
  return {
    engine,
    searches,
    ready: () => resolveInit(),
    failToLoad: (error: Error) => rejectInit(error),
    answer: (move: EngineMove | null) => resolveSearch(move),
  }
}

const identity = createBotIdentity(getBotLevel(3))
const human = { ...identity, kind: 'guest' as const, id: 'human', displayName: 'Вы' }

const state = (over: Partial<Extract<ServerMessage, { type: 'state' }>> = {}): ServerMessage => ({
  type: 'state',
  status: 'playing',
  startFen: START,
  fen: START,
  moves: [],
  clock: null,
  result: null,
  players: { w: human, b: identity },
  you: ['b'],
  drawOffer: null,
  ...over,
})

const moved = (fen: string, ply: number, san: string): ServerMessage => ({
  type: 'moved',
  ply,
  san,
  move: { from: 'e2', to: 'e4' },
  fen,
  clock: null,
})

/** Бот 3-го уровня за чёрных; пауза до хода фиксирована (random = 0 → минимум уровня, 500 мс). */
function setup(options: { level?: BotLevelId } = {}) {
  vi.useFakeTimers()
  const net = fakeTransport()
  const eng = fakeEngine()
  const bot = createBotPlayer({
    transport: net.transport,
    gameId: 'bot',
    level: options.level ?? 3,
    createEngine: () => eng.engine,
    color: 'b',
    random: () => 0,
  })
  bot.start()
  eng.ready()
  return { bot, ...net, ...eng }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('личность', () => {
  it('бот — игрок вида bot с именем по уровню; имя проходит проверку протокола', async () => {
    const { parseServerMessage } = await import('@/shared/api')
    const identity8 = createBotIdentity(getBotLevel(8))
    expect(identity8).toMatchObject({
      kind: 'bot',
      id: 'bot-8',
      displayName: 'Бот Эксперт',
    })
    expect(parseServerMessage(state({ players: { w: null, b: identity8 } }))).not.toBeNull()
  })
})

describe('подключение', () => {
  it('входит в комнату за свой цвет и загружает движок', async () => {
    const { transport, sent, engine, bot } = setup()
    expect(transport.connect).toHaveBeenCalledWith('bot', bot.identity)
    expect(sent).toEqual([{ type: 'join', identity: bot.identity, color: 'b' }])
    expect(engine.setLevel).toHaveBeenCalledWith(3)
    await vi.waitFor(() => expect(bot.store.getState().ready).toBe(true))
  })

  it('не удалось загрузить движок — ошибка в сторе', async () => {
    vi.useFakeTimers()
    const net = fakeTransport()
    const eng = fakeEngine()
    const bot = createBotPlayer({
      transport: net.transport,
      gameId: 'bot',
      level: 1,
      createEngine: () => eng.engine,
    })
    bot.start()
    eng.failToLoad(new Error('wasm не загрузился'))
    await vi.waitFor(() => expect(bot.store.getState().error).toBe('wasm не загрузился'))
    expect(net.sent[0]).toEqual({ type: 'join', identity: bot.identity })
  })
})

describe('ход', () => {
  it('думает над своим ходом и отвечает не раньше паузы', async () => {
    const { receive, sent, searches, answer, bot } = setup()
    sent.length = 0
    receive(state({ fen: AFTER_E4, moves: ['e4'] }))
    expect(bot.store.getState().thinking).toBe(true)
    expect(searches).toEqual([{ fen: AFTER_E4, timeMs: 80 }])

    answer(E5)
    await vi.advanceTimersByTimeAsync(499)
    expect(sent).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(sent).toEqual([{ type: 'move', from: 'e7', to: 'e5' }])
    expect(bot.store.getState().thinking).toBe(false)
  })

  it('время расчёта учитывается в паузе: медленный ответ движка не ждёт ещё раз', async () => {
    const { receive, sent, answer } = setup()
    sent.length = 0
    receive(state({ fen: AFTER_E4, moves: ['e4'] }))
    await vi.advanceTimersByTimeAsync(800)
    answer(E5)
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).toEqual([{ type: 'move', from: 'e7', to: 'e5' }])
  })

  it('передаёт превращение пешки', async () => {
    const { receive, sent, answer } = setup()
    sent.length = 0
    receive(state({ fen: '8/P7/8/8/8/8/8/k6K b - - 0 1' }))
    answer({ from: 'a7', to: 'a8', promotion: 'q' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(sent).toEqual([{ type: 'move', from: 'a7', to: 'a8', promotion: 'q' }])
  })

  it('не ходит, когда очередь соперника, партия не началась или окончена', () => {
    const { receive, searches } = setup()
    receive(state())
    receive(state({ status: 'waiting', fen: AFTER_E4 }))
    receive(state({ status: 'over', fen: AFTER_E4 }))
    expect(searches).toEqual([])
  })

  it('ход соперника запускает расчёт', () => {
    const { receive, searches } = setup()
    receive(state())
    receive(moved(AFTER_E4, 1, 'e4'))
    expect(searches).toEqual([{ fen: AFTER_E4, timeMs: 80 }])
  })

  it('свой ход не запускает расчёт заново', async () => {
    const { receive, searches, answer } = setup()
    receive(state({ fen: AFTER_E4 }))
    answer(E5)
    await vi.advanceTimersByTimeAsync(600)
    receive(moved('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 2, 'e5'))
    expect(searches).toHaveLength(1)
  })

  it('на часах время расчёта и пауза сжимаются под остаток', async () => {
    const { receive, sent, searches, answer } = setup({ level: 8 })
    sent.length = 0
    receive(
      state({
        fen: AFTER_E4,
        clock: {
          config: { initialMs: 10_000, incrementMs: 0 },
          remaining: { w: 10_000, b: 600 },
          running: 'b',
        },
      }),
    )
    // 600 / 30 = 20 мс на ход → не меньше минимума в 30 мс
    expect(searches[0]?.timeMs).toBe(30)
    answer(E5)
    // Пауза — не больше 5% остатка (30 мс), а не полсекунды
    await vi.advanceTimersByTimeAsync(30)
    expect(sent).toHaveLength(1)
  })
})

describe('отмена расчёта', () => {
  it('новая позиция (отмена хода, реванш) сбрасывает текущий расчёт', async () => {
    const { receive, sent, searches, answer, engine } = setup()
    receive(state({ fen: AFTER_E4 }))
    sent.length = 0

    // Игрок отменил ход: хост прислал другое состояние, где ходит уже не бот
    receive(state({ fen: START, you: ['b'] }))
    expect(engine.stop).toHaveBeenCalled()
    answer(E5)
    await vi.advanceTimersByTimeAsync(2000)
    expect(sent).toEqual([])
    expect(searches).toHaveLength(1)
  })

  it('пока ждёт паузу, прерывается ходом соперника или концом партии', async () => {
    const { receive, sent, answer, bot } = setup()
    receive(state({ fen: AFTER_E4 }))
    sent.length = 0
    answer(E5)
    await vi.advanceTimersByTimeAsync(100)

    receive({ type: 'gameOver', result: '1-0', reason: 'resignation', clock: null })
    await vi.advanceTimersByTimeAsync(2000)
    expect(sent).toEqual([])
    expect(bot.store.getState().thinking).toBe(false)
  })

  it('поиск без хода (нет ходов) не оставляет индикатор включённым', async () => {
    const { receive, answer, bot } = setup()
    receive(state({ fen: AFTER_E4 }))
    answer(null)
    await vi.advanceTimersByTimeAsync(0)
    expect(bot.store.getState().thinking).toBe(false)
  })

  it('сбой движка посреди партии — ошибка в сторе', async () => {
    vi.useFakeTimers()
    const net = fakeTransport()
    const eng = fakeEngine()
    eng.engine.bestMove = vi.fn(() => Promise.reject(new Error('упал')))
    const bot = createBotPlayer({
      transport: net.transport,
      gameId: 'bot',
      level: 1,
      createEngine: () => eng.engine,
    })
    bot.start()
    net.receive(state({ fen: AFTER_E4 }))
    await vi.advanceTimersByTimeAsync(0)
    expect(bot.store.getState()).toMatchObject({ thinking: false, error: 'упал' })
  })
})

describe('предложения и реванш', () => {
  it('отклоняет ничью соперника, но не свою — с короткой задержкой', async () => {
    const { receive, sent } = setup()
    receive(state())
    sent.length = 0
    receive({ type: 'drawOffered', by: 'w' })
    receive({ type: 'drawOffered', by: 'b' })
    expect(sent).toEqual([])
    await vi.advanceTimersByTimeAsync(300)
    expect(sent).toEqual([{ type: 'answerDraw', accept: false }])
  })

  it('принимает предложение реванша', async () => {
    const { receive, sent } = setup()
    receive(state({ status: 'over' }))
    sent.length = 0
    receive({ type: 'rematchRequested', by: 'w' })
    await vi.advanceTimersByTimeAsync(300)
    expect(sent).toEqual([{ type: 'rematch' }])
  })

  it('отложенные ответы не уходят после stop', async () => {
    const { receive, sent, bot } = setup()
    receive(state({ status: 'over' }))
    sent.length = 0
    receive({ type: 'rematchRequested', by: 'w' })
    bot.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(sent).toEqual([])
  })

  it('после реванша цвета меняются — бот играет за нового цвета', () => {
    const { receive, searches } = setup()
    receive(state({ you: ['w'], status: 'playing' }))
    expect(searches).toEqual([{ fen: START, timeMs: 80 }])
  })

  it('отказ хода: сверяется с хостом повторным входом', () => {
    const { receive, sent } = setup()
    sent.length = 0
    receive({ type: 'error', code: 'not-your-turn' })
    receive({ type: 'error', code: 'game-over' })
    expect(sent).toEqual([{ type: 'join', identity, color: 'b' }])
  })
})

describe('жизненный цикл', () => {
  it('stop отключает бота и останавливает движок; start создаёт новый движок', async () => {
    vi.useFakeTimers()
    const net = fakeTransport()
    const engines: ReturnType<typeof fakeEngine>[] = []
    const bot = createBotPlayer({
      transport: net.transport,
      gameId: 'bot',
      level: 2,
      createEngine: () => {
        const next = fakeEngine()
        engines.push(next)
        return next.engine
      },
    })
    bot.start()
    bot.start()
    expect(engines).toHaveLength(1)

    bot.stop()
    bot.stop()
    expect(net.transport.disconnect).toHaveBeenCalledTimes(1)
    expect(engines[0]?.engine.dispose).toHaveBeenCalledTimes(1)

    bot.start()
    expect(engines).toHaveLength(2)
    engines[1]?.ready()
    await vi.advanceTimersByTimeAsync(0)
    expect(bot.store.getState().ready).toBe(true)
  })

  it('поздний ответ прежнего движка не влияет на новый запуск', async () => {
    vi.useFakeTimers()
    const net = fakeTransport()
    const engines: ReturnType<typeof fakeEngine>[] = []
    const bot = createBotPlayer({
      transport: net.transport,
      gameId: 'bot',
      level: 2,
      createEngine: () => {
        const next = fakeEngine()
        engines.push(next)
        return next.engine
      },
    })
    bot.start()
    bot.stop()
    bot.start()
    engines[0]?.ready()
    await vi.advanceTimersByTimeAsync(0)
    expect(bot.store.getState().ready).toBe(false)
  })
})
