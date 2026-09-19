import { countMaterial } from './fen'
import type { GameState } from './store'
import type { Color, MoveRecord, PieceType, Square } from './types'

export const selectIsGameOver = (s: GameState): boolean => s.result !== null

export const selectWinner = (s: GameState): Color | null => {
  if (s.result?.result === '1-0') return 'w'
  if (s.result?.result === '0-1') return 'b'
  return null
}

export const selectLastMove = (s: GameState): MoveRecord | undefined => s.moves.at(-1)

/** Клетка короля под шахом (для подсветки); при мате тоже возвращается. */
export const selectCheckedKingSquare = (s: GameState): Square | null => {
  if (!s.inCheck) return null
  return s.pieces.find((p) => p.type === 'k' && p.color === s.turn)?.square ?? null
}

/** Легальные ходы фигуры на `from`. Новый массив при каждом вызове — не для zustand-селектора. */
export const selectLegalMovesFrom = (s: GameState, from: Square) =>
  s.legalMoves.filter((m) => m.from === from)

/** Требует ли ход выбора фигуры для превращения. */
export const selectIsPromotion = (s: GameState, from: Square, to: Square): boolean =>
  s.legalMoves.some((m) => m.from === from && m.to === to && m.promotion !== undefined)

/** Фигуры, взятые каждой стороной, в порядке взятия. */
export const selectCaptured = (s: GameState): Record<Color, PieceType[]> => {
  const captured: Record<Color, PieceType[]> = { w: [], b: [] }
  for (const m of s.moves) {
    if (m.captured) captured[m.color].push(m.captured)
  }
  return captured
}

/** Материальный перевес по фигурам на доске: > 0 — впереди белые, < 0 — чёрные. */
export const selectMaterialBalance = (s: GameState): number =>
  countMaterial(s.pieces, 'w') - countMaterial(s.pieces, 'b')

/** FEN после `ply` полуходов (0 — начальная позиция); для просмотра истории. */
export const selectFenAt = (s: GameState, ply: number): string | undefined => {
  if (ply === 0) return s.startFen
  return s.moves[ply - 1]?.fen
}
