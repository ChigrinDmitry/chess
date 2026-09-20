import type { PromotionPiece, Square } from '@/entities/game/@x/bot'

/** Ход, который выбрал движок. */
export interface EngineMove {
  from: Square
  to: Square
  promotion?: PromotionPiece
}

/** Номер уровня бота: 1 — новичок, 8 — сильный любитель. */
export type BotLevelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/**
 * Шахматный движок за интерфейсом: Stockfish в Web Worker или любая другая реализация
 * (в том числе собственный движок) подменяются без изменений остального кода.
 */
export interface ChessEngine {
  /** Загружает движок; безопасно вызывать повторно. `bestMove` сам дожидается загрузки. */
  init(): Promise<void>
  /** Сила игры для следующих поисков. */
  setLevel(level: BotLevelId): void
  /**
   * Лучший ход в позиции `fen`, не дольше `timeMs`. `null` — поиск отменён `stop`/`dispose`
   * или в позиции нет ходов. Поиски выполняются по очереди.
   */
  bestMove(fen: string, timeMs: number): Promise<EngineMove | null>
  /** Отменяет текущий и ожидающие поиски: их `bestMove` вернёт `null`. */
  stop(): void
  /** Останавливает движок и освобождает воркер. После этого использовать его нельзя. */
  dispose(): void
}
