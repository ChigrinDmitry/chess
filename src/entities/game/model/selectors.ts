import { countMaterial, piecesFromFen } from './fen'
import type { GameState } from './store'
import type { Color, MoveRecord, PieceType, PlacedPiece, Square } from './types'

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

/** Позиция после `ply` полуходов — то, что показывает доска при просмотре истории. */
export interface PositionView {
  fen: string
  turn: Color
  pieces: PlacedPiece[]
  lastMove: MoveRecord | undefined
  checkedSquare: Square | null
}

/**
 * Позиция для показа на доске после `ply` полуходов (0 — начальная; значение зажимается в
 * допустимые границы). Шах определяется по SAN хода (`+`/`#`), поэтому правила не нужны.
 */
export const selectPositionAt = (s: GameState, ply: number): PositionView => {
  const at = Math.min(Math.max(ply, 0), s.moves.length)
  const fen = selectFenAt(s, at) ?? s.startFen
  const pieces = piecesFromFen(fen)
  const turn: Color = fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const lastMove = at > 0 ? s.moves[at - 1] : undefined
  const inCheck = lastMove ? /[+#]$/.test(lastMove.san) : at === s.moves.length && s.inCheck
  const checkedSquare = inCheck
    ? (pieces.find((p) => p.type === 'k' && p.color === turn)?.square ?? null)
    : null
  return { fen, turn, pieces, lastMove, checkedSquare }
}
