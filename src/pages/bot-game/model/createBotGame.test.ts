import type { ChessEngine, EngineMove } from '@/entities/bot'
import { createGameStore } from '@/entities/game'
import { createBotGame, HUMAN_PLAYER, type BotGameSettings } from './createBotGame'

const uci = (line: string): EngineMove => ({
  from: line.slice(0, 2) as EngineMove['from'],
  to: line.slice(2, 4) as EngineMove['to'],
})

/** Движок, отвечающий заготовленными ходами; в позиции без ходов — «хода нет». */
function scriptedEngine(...script: string[]) {
  const queue = [...script]
  const engine: ChessEngine = {
    init: vi.fn(() => Promise.resolve()),
    setLevel: vi.fn(),
    bestMove: vi.fn(async (fen: string) => {
      if (createGameStore({ startFen: fen }).getState().legalMoves.length === 0) return null
      const next = queue.shift()
      return next ? uci(next) : null
    }),
    stop: vi.fn(),
    dispose: vi.fn(),
  }
  return engine
}

const settings = (patch: Partial<BotGameSettings> = {}): BotGameSettings => ({
  level: 3,
  color: 'w',
  timeControl: 'none',
  ...patch,
})

const sans = (game: ReturnType<typeof createBotGame>) =>
  game.client.game.getState().moves.map((m) => m.san)

/** Пауза бота перед ходом не превышает 1,6 с. */
const think = () => vi.advanceTimersByTimeAsync(2000)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createBotGame', () => {
  it('человек и бот занимают разные цвета', () => {
    const game = createBotGame(settings({ color: 'b', level: 5 }), {
      createEngine: () => scriptedEngine(),
    })
    game.start()
    expect(game.client.store.getState()).toMatchObject({
      status: 'playing',
      you: ['b'],
      players: { w: { kind: 'bot', id: 'bot-5' }, b: HUMAN_PLAYER },
    })
    expect(game.bot.store.getState().thinking).toBe(true)
    game.stop()
  })

  it('до запуска экран уже знает игроков и часы', () => {
    const game = createBotGame(settings({ timeControl: '3+2' }), {
      createEngine: () => scriptedEngine(),
    })
    const state = game.client.store.getState()
    expect(state.players.w).toEqual(HUMAN_PLAYER)
    expect(state.players.b?.kind).toBe('bot')
    expect(state.clock?.getState().remaining).toEqual({ w: 180_000, b: 180_000 })
  })

  it('бот отвечает на ходы человека по очереди, часы переходят к нему и обратно', async () => {
    const game = createBotGame(settings({ timeControl: '3+2' }), {
      createEngine: () => scriptedEngine('e7e5', 'b8c6'),
    })
    game.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(game.client.move({ from: 'e2', to: 'e4' })).toBe(true)
    // Первый ход часов не запускает у хода игрока: они идут у бота
    expect(game.client.store.getState().clock?.getState().running).toBe('b')
    await think()
    expect(sans(game)).toEqual(['e4', 'e5'])
    expect(game.client.store.getState().clock?.getState().running).toBe('w')

    game.client.move({ from: 'g1', to: 'f3' })
    await think()
    expect(sans(game)).toEqual(['e4', 'e5', 'Nf3', 'Nc6'])
    expect(game.bot.store.getState().thinking).toBe(false)
    game.stop()
  })

  it('превращение пешки и ответ бота с превращением доходят до доски', async () => {
    const game = createBotGame(settings({ color: 'b' }), {
      createEngine: () => scriptedEngine('e2e4'),
    })
    game.start()
    await think()
    expect(sans(game)).toEqual(['e4'])
    game.stop()
  })

  it('бот отклоняет ничью, а человек может сдаться', async () => {
    const game = createBotGame(settings(), { createEngine: () => scriptedEngine('e7e5') })
    game.start()
    game.client.move({ from: 'e2', to: 'e4' })
    await think()

    game.client.offerDraw()
    expect(game.client.store.getState().drawOffer).toBe('w')
    await vi.advanceTimersByTimeAsync(300)
    // Бот отказал: предложение снято
    expect(game.client.store.getState().drawOffer).toBeNull()

    game.client.resign()
    expect(game.client.game.getState().result).toEqual({ result: '0-1', reason: 'resignation' })
    expect(game.bot.store.getState().thinking).toBe(false)
    game.stop()
  })

  it('отмена хода возвращает право хода, бот не отвечает на снятый ход', async () => {
    const game = createBotGame(settings(), { createEngine: () => scriptedEngine('e7e5', 'c7c5') })
    game.start()
    game.client.move({ from: 'e2', to: 'e4' })
    // Бот ещё думает — человек передумал
    game.client.takeback()
    await think()
    expect(sans(game)).toEqual([])
    expect(game.client.game.getState().turn).toBe('w')

    game.client.move({ from: 'd2', to: 'd4' })
    await think()
    // Поиск бота по снятому ходу отброшен; следующий ответ — уже на d4
    expect(sans(game)).toHaveLength(2)
    expect(sans(game)[0]).toBe('d4')
    game.stop()
  })

  it('реванш меняет цвета, и бот ходит первым', async () => {
    const game = createBotGame(settings(), {
      createEngine: () => scriptedEngine('e7e5', 'b8c6', 'g8f6', 'd2d4'),
    })
    game.start()
    for (const move of [
      { from: 'e2', to: 'e4' },
      { from: 'f1', to: 'c4' },
      { from: 'd1', to: 'h5' },
    ] as const) {
      game.client.move(move)
      await think()
    }
    game.client.move({ from: 'h5', to: 'f7' })
    expect(game.client.game.getState().result?.reason).toBe('checkmate')

    game.client.rematch()
    await think()
    expect(game.client.store.getState().you).toEqual(['b'])
    expect(sans(game)).toEqual(['d4'])
    game.stop()
  })

  it('stop гасит движок, повторный start работает с новым', async () => {
    const engines: ChessEngine[] = []
    const game = createBotGame(settings(), {
      createEngine: () => {
        const engine = scriptedEngine('e7e5')
        engines.push(engine)
        return engine
      },
    })
    game.start()
    game.stop()
    expect(engines[0]?.dispose).toHaveBeenCalledOnce()

    game.start()
    expect(engines).toHaveLength(2)
    game.client.move({ from: 'e2', to: 'e4' })
    await think()
    expect(sans(game)).toEqual(['e4', 'e5'])
    game.stop()
  })
})
