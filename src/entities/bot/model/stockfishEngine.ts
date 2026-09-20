import { getBotLevel, levelCommands, DEFAULT_BOT_LEVEL } from './levels'
import type { BotLevelId, ChessEngine, EngineMove } from './types'
import { parseBestMove } from './uci'

/** Строки UCI туда и обратно: так говорит воркер `stockfish.js`. */
export interface EngineWorker {
  postMessage(line: string): void
  onLine(handler: (line: string) => void): void
  onError(handler: (error: unknown) => void): void
  terminate(): void
}

/** Сколько ждём загрузку движка (wasm скачивается и компилируется) до сообщения об ошибке. */
export const INIT_TIMEOUT_MS = 20_000

/** Движок лежит в `public/engine` (lite, однопоточный) и в основной бандл не входит. */
export const ENGINE_SCRIPT = 'engine/stockfish-19-lite-single.js'

export function createBrowserEngineWorker(
  url: string = `${import.meta.env.BASE_URL}${ENGINE_SCRIPT}`,
): EngineWorker {
  const worker = new Worker(url)
  return {
    postMessage: (line) => worker.postMessage(line),
    onLine: (handler) => {
      worker.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (typeof event.data === 'string') handler(event.data)
      })
    },
    onError: (handler) => {
      worker.addEventListener('error', (event) => handler(event.error ?? event.message))
      worker.addEventListener('messageerror', handler)
    },
    terminate: () => worker.terminate(),
  }
}

export interface StockfishEngineOptions {
  /** Создаёт воркер при первом `init`; в тестах подменяется. */
  createWorker?: () => EngineWorker
}

interface Waiter {
  matches: (line: string) => boolean
  resolve: (line: string) => void
  reject: (error: unknown) => void
}

/**
 * Stockfish в Web Worker: `init` загружает движок, `bestMove` ставит позицию и ждёт `bestmove`.
 * Поиски идут строго по очереди — пока не пришёл `bestmove` от прежнего, новый не начинается,
 * иначе запоздалый ответ на отменённый поиск приняли бы за ответ на новый.
 */
export function createStockfishEngine(options: StockfishEngineOptions = {}): ChessEngine {
  const createWorker = options.createWorker ?? (() => createBrowserEngineWorker())

  let worker: EngineWorker | null = null
  let ready: Promise<void> | null = null
  let disposed = false
  let failure: unknown = null
  let waiters: Waiter[] = []

  let level: BotLevelId = DEFAULT_BOT_LEVEL
  let appliedLevel: BotLevelId | null = null

  /** Поиски отменяются сменой эпохи: то, что стартовало раньше, вернёт `null`. */
  let epoch = 0
  let searching = false
  let queue: Promise<unknown> = Promise.resolve()

  const send = (line: string) => worker?.postMessage(line)

  const fail = (error: unknown) => {
    failure ??= error instanceof Error ? error : new Error('Сбой движка')
    const pending = waiters
    waiters = []
    for (const waiter of pending) waiter.reject(failure)
  }

  const waitFor = (matches: (line: string) => boolean) =>
    new Promise<string>((resolve, reject) => {
      if (failure) return reject(failure)
      waiters.push({ matches, resolve, reject })
    })

  const dispatch = (line: string) => {
    const waiter = waiters.find((candidate) => candidate.matches(line))
    if (!waiter) return
    waiters = waiters.filter((candidate) => candidate !== waiter)
    waiter.resolve(line)
  }

  const init = () => {
    if (disposed) return Promise.reject(new Error('Движок остановлен'))
    ready ??= (async () => {
      worker = createWorker()
      worker.onLine(dispatch)
      worker.onError(fail)
      const timeout = setTimeout(() => fail(new Error('Движок не ответил')), INIT_TIMEOUT_MS)
      try {
        send('uci')
        await waitFor((line) => line === 'uciok')
        send('isready')
        await waitFor((line) => line === 'readyok')
      } finally {
        clearTimeout(timeout)
      }
    })()
    return ready
  }

  const search = async (fen: string, timeMs: number, startedIn: number) => {
    try {
      await init()
      if (startedIn !== epoch) return null

      if (appliedLevel !== level) {
        for (const command of levelCommands(getBotLevel(level))) send(command)
        appliedLevel = level
      }
      const { depth } = getBotLevel(level)
      send(`position fen ${fen}`)
      send(`go depth ${depth} movetime ${Math.max(1, Math.round(timeMs))}`)
      searching = true
      const line = await waitFor((candidate) => candidate.startsWith('bestmove'))
      return startedIn === epoch ? parseBestMove(line) : null
    } catch (error) {
      // Остановленный поиск — не ошибка
      if (startedIn !== epoch) return null
      throw error
    } finally {
      searching = false
    }
  }

  return {
    init,

    setLevel: (next) => {
      level = next
    },

    bestMove: (fen, timeMs) => {
      const startedIn = epoch
      const result: Promise<EngineMove | null> = queue.then(() => search(fen, timeMs, startedIn))
      // Ошибка одного поиска не должна ломать очередь: её получит только вызвавший
      queue = result.catch(() => null)
      return result
    },

    stop: () => {
      epoch++
      if (searching) send('stop')
    },

    dispose: () => {
      if (disposed) return
      disposed = true
      epoch++
      if (searching) send('stop')
      send('quit')
      worker?.terminate()
      worker = null
      fail(new Error('Движок остановлен'))
    },
  }
}
