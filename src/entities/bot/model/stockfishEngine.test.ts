import { INIT_TIMEOUT_MS, createStockfishEngine, type EngineWorker } from './stockfishEngine'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Воркер-двойник: записывает команды, а ответы движка «произносит» тест. */
function fakeWorker() {
  const sent: string[] = []
  let handleLine: (line: string) => void = () => {}
  let handleError: (error: unknown) => void = () => {}
  const terminate = vi.fn()
  const worker: EngineWorker = {
    postMessage: (line) => sent.push(line),
    onLine: (handler) => (handleLine = handler),
    onError: (handler) => (handleError = handler),
    terminate,
  }
  return {
    worker,
    sent,
    terminate,
    say: (line: string) => handleLine(line),
    crash: (error: unknown) => handleError(error),
    /** Команды с момента последнего вызова. */
    take: () => sent.splice(0),
  }
}
type Fake = ReturnType<typeof fakeWorker>

/** Движок, у которого уже прошёл `uci`/`isready`. */
async function readyEngine() {
  const fake = fakeWorker()
  const createWorker = vi.fn(() => fake.worker)
  const engine = createStockfishEngine({ createWorker })
  const init = engine.init()
  await vi.waitFor(() => expect(fake.sent).toContain('uci'))
  fake.say('uciok')
  await vi.waitFor(() => expect(fake.sent).toContain('isready'))
  fake.say('readyok')
  await init
  fake.take()
  return { engine, fake, createWorker }
}

const started = (fake: Fake) =>
  vi.waitFor(() => expect(fake.sent.some((l) => l.startsWith('go'))).toBe(true))

afterEach(() => {
  vi.useRealTimers()
})

describe('загрузка', () => {
  it('uci → uciok → isready → readyok; воркер создаётся один раз', async () => {
    const fake = fakeWorker()
    const createWorker = vi.fn(() => fake.worker)
    const engine = createStockfishEngine({ createWorker })

    const first = engine.init()
    const second = engine.init()
    expect(createWorker).toHaveBeenCalledTimes(1)
    expect(fake.sent).toEqual(['uci'])

    fake.say('id name Stockfish')
    fake.say('uciok')
    await vi.waitFor(() => expect(fake.sent).toEqual(['uci', 'isready']))
    fake.say('readyok')
    await Promise.all([first, second])
  })

  it('сбой воркера отклоняет загрузку', async () => {
    const fake = fakeWorker()
    const engine = createStockfishEngine({ createWorker: () => fake.worker })
    const init = engine.init()
    fake.crash(new Error('wasm не загрузился'))
    await expect(init).rejects.toThrow('wasm не загрузился')
    // Ошибка запоминается: поиск сразу сообщает о ней
    await expect(engine.bestMove(START, 100)).rejects.toThrow('wasm не загрузился')
  })

  it('движок, не ответивший вовремя, считается сломанным', async () => {
    vi.useFakeTimers()
    const fake = fakeWorker()
    const engine = createStockfishEngine({ createWorker: () => fake.worker })
    const init = engine.init()
    const assertion = expect(init).rejects.toThrow('Движок не ответил')
    await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS)
    await assertion
  })
})

describe('поиск хода', () => {
  it('настраивает уровень, ставит позицию и разбирает bestmove', async () => {
    const { engine, fake } = await readyEngine()
    engine.setLevel(3)
    const move = engine.bestMove(START, 250)
    await started(fake)

    expect(fake.take()).toEqual([
      'setoption name UCI_LimitStrength value false',
      'setoption name Skill Level value 4',
      `position fen ${START}`,
      'go depth 2 movetime 250',
    ])
    fake.say('info depth 2 score cp 20')
    fake.say('bestmove e2e4 ponder e7e5')
    await expect(move).resolves.toEqual({ from: 'e2', to: 'e4' })
  })

  it('настройки уровня шлёт только при его смене', async () => {
    const { engine, fake } = await readyEngine()
    const first = engine.bestMove(START, 100)
    await started(fake)
    fake.say('bestmove e2e4')
    await first
    fake.take()

    const second = engine.bestMove(START, 100)
    await started(fake)
    expect(fake.take().some((line) => line.startsWith('setoption'))).toBe(false)
    fake.say('bestmove d2d4')
    await second

    engine.setLevel(1)
    void engine.bestMove(START, 100)
    await started(fake)
    expect(fake.take()[0]).toMatch(/^setoption/)
  })

  it('превращение пешки и отсутствие хода', async () => {
    const { engine, fake } = await readyEngine()
    const promotion = engine.bestMove('8/P7/8/8/8/8/8/k6K w - - 0 1', 100)
    await started(fake)
    fake.say('bestmove a7a8q')
    await expect(promotion).resolves.toEqual({ from: 'a7', to: 'a8', promotion: 'q' })

    const none = engine.bestMove(START, 100)
    await vi.waitFor(() => expect(fake.sent.filter((l) => l.startsWith('go'))).toHaveLength(2))
    fake.say('bestmove (none)')
    await expect(none).resolves.toBeNull()
  })

  it('поиски идут по очереди: второй начинается после ответа на первый', async () => {
    const { engine, fake } = await readyEngine()
    const first = engine.bestMove(START, 100)
    const second = engine.bestMove(START, 100)
    await started(fake)
    expect(fake.sent.filter((l) => l.startsWith('go'))).toHaveLength(1)

    fake.say('bestmove e2e4')
    await expect(first).resolves.toEqual({ from: 'e2', to: 'e4' })
    await vi.waitFor(() => expect(fake.sent.filter((l) => l.startsWith('go'))).toHaveLength(2))
    fake.say('bestmove d2d4')
    await expect(second).resolves.toEqual({ from: 'd2', to: 'd4' })
  })
})

describe('остановка', () => {
  it('stop прерывает поиск: ответ движка на него отбрасывается', async () => {
    const { engine, fake } = await readyEngine()
    const move = engine.bestMove(START, 5000)
    await started(fake)
    fake.take()

    engine.stop()
    expect(fake.take()).toEqual(['stop'])
    fake.say('bestmove e2e4')
    await expect(move).resolves.toBeNull()
  })

  it('запоздалый bestmove отменённого поиска не принимается за ответ на новый', async () => {
    const { engine, fake } = await readyEngine()
    const stale = engine.bestMove(START, 5000)
    await started(fake)
    engine.stop()

    const fresh = engine.bestMove('8/8/8/8/8/8/8/K1k5 w - - 0 1', 100)
    // Пока не пришёл ответ на отменённый поиск, новый не стартует
    expect(fake.sent.filter((l) => l.startsWith('go'))).toHaveLength(1)

    fake.say('bestmove e2e4')
    await expect(stale).resolves.toBeNull()
    await vi.waitFor(() => expect(fake.sent.filter((l) => l.startsWith('go'))).toHaveLength(2))
    fake.say('bestmove a1a2')
    await expect(fresh).resolves.toEqual({ from: 'a1', to: 'a2' })
  })

  it('stop отменяет и ожидающие в очереди поиски, не отправляя им go', async () => {
    const { engine, fake } = await readyEngine()
    const running = engine.bestMove(START, 5000)
    const queued = engine.bestMove(START, 5000)
    await started(fake)

    engine.stop()
    fake.say('bestmove e2e4')
    await expect(running).resolves.toBeNull()
    await expect(queued).resolves.toBeNull()
    expect(fake.sent.filter((l) => l.startsWith('go'))).toHaveLength(1)
  })

  it('stop без поиска ничего не шлёт', async () => {
    const { engine, fake } = await readyEngine()
    engine.stop()
    expect(fake.take()).toEqual([])
  })

  it('dispose гасит воркер, а поиск в процессе возвращает null', async () => {
    const { engine, fake } = await readyEngine()
    const move = engine.bestMove(START, 5000)
    await started(fake)

    engine.dispose()
    engine.dispose()
    await expect(move).resolves.toBeNull()
    expect(fake.sent).toContain('quit')
    expect(fake.terminate).toHaveBeenCalledTimes(1)
    await expect(engine.init()).rejects.toThrow('Движок остановлен')
  })

  it('сбой воркера посреди поиска отклоняет его, а следующие поиски получают ту же ошибку', async () => {
    const { engine, fake } = await readyEngine()
    const move = engine.bestMove(START, 5000)
    await started(fake)
    fake.crash(new Error('упал'))
    await expect(move).rejects.toThrow('упал')
    await expect(engine.bestMove(START, 100)).rejects.toThrow('упал')
  })
})
