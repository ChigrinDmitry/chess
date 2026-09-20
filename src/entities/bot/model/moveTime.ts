import type { BotLevel } from './levels'

export interface BotClock {
  /** Сколько времени осталось у бота. */
  remainingMs: number
  incrementMs: number
}

/** Меньше этого на ход не даём: за 10 мс движок не успеет даже инициализировать поиск. */
const MIN_MOVE_TIME_MS = 30
/** Считаем, что партия длится ещё примерно столько ходов бота. */
const EXPECTED_MOVES_LEFT = 30

/**
 * Время на ход: потолок уровня, но не больше доли остатка на часах, чтобы бот не проигрывал
 * по времени в блице. Без часов — потолок уровня.
 */
export function moveTimeBudget(level: BotLevel, clock: BotClock | null): number {
  if (!clock) return level.maxMoveTimeMs
  const share = clock.remainingMs / EXPECTED_MOVES_LEFT + clock.incrementMs * 0.8
  return Math.max(MIN_MOVE_TIME_MS, Math.min(level.maxMoveTimeMs, Math.floor(share)))
}
