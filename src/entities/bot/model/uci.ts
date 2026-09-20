import type { EngineMove } from './types'

const BEST_MOVE = /^bestmove ([a-h][1-8])([a-h][1-8])([nbrq])?(?:\s|$)/

/**
 * Разбор строки `bestmove e2e4 [ponder …]`. `null` — хода нет (`bestmove (none)`, мат или пат)
 * или строка не похожа на ответ движка.
 */
export function parseBestMove(line: string): EngineMove | null {
  const match = BEST_MOVE.exec(line)
  if (!match) return null
  const [, from, to, promotion] = match
  return {
    from: from as EngineMove['from'],
    to: to as EngineMove['to'],
    ...(promotion ? { promotion: promotion as NonNullable<EngineMove['promotion']> } : {}),
  }
}
