import type { Color, GameOverReason, GameResult } from './types'

const REASONS: Record<GameOverReason, string> = {
  checkmate: 'мат',
  timeout: 'время вышло',
  resignation: 'сдача',
  stalemate: 'пат',
  'insufficient-material': 'недостаточно материала',
  'threefold-repetition': 'троекратное повторение',
  'fifty-moves': 'правило 50 ходов',
  agreement: 'по соглашению',
  'timeout-vs-insufficient-material': 'время вышло, у соперника недостаточно материала',
}

/** Причина окончания партии строчными буквами: «мат», «сдача». */
export function describeReason(reason: GameOverReason): string {
  return REASONS[reason]
}

/** Итог партии: «Победили белые», «Победили чёрные», «Ничья». */
export function describeOutcome(result: GameResult): string {
  if (result.result === '1-0') return 'Победили белые'
  if (result.result === '0-1') return 'Победили чёрные'
  return 'Ничья'
}

/** Строка состояния партии: чей ход (и шах) или итог с причиной. */
export function describeStatus(state: {
  turn: Color
  inCheck: boolean
  result: GameResult | null
}): string {
  const { turn, inCheck, result } = state
  if (result) return `${describeOutcome(result)} — ${describeReason(result.reason)}`
  const side = turn === 'w' ? 'белых' : 'чёрных'
  return inCheck ? `Ход ${side}, шах` : `Ход ${side}`
}
