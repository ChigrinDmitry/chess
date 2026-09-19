import type { Color, File, Rank, Square } from '@/entities/game'

export const FILES: readonly File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
export const RANKS: readonly Rank[] = ['1', '2', '3', '4', '5', '6', '7', '8']

/** Позиция клетки на экране: колонка и строка слева-сверху, 0–7. */
export interface ViewCoords {
  col: number
  row: number
}

export function fileIndex(square: Square): number {
  return FILES.indexOf(square[0] as File)
}

export function rankIndex(square: Square): number {
  return RANKS.indexOf(square[1] as Rank)
}

/** Колонка/строка клетки при данной ориентации (`orientation` — чьи фигуры внизу). */
export function toView(square: Square, orientation: Color): ViewCoords {
  const file = fileIndex(square)
  const rank = rankIndex(square)
  return orientation === 'w' ? { col: file, row: 7 - rank } : { col: 7 - file, row: rank }
}

/** Обратное к `toView`; `null`, если точка вне доски. */
export function fromView(col: number, row: number, orientation: Color): Square | null {
  if (!Number.isInteger(col) || !Number.isInteger(row)) return null
  if (col < 0 || col > 7 || row < 0 || row > 7) return null
  const file = orientation === 'w' ? col : 7 - col
  const rank = orientation === 'w' ? 7 - row : row
  return `${FILES[file]}${RANKS[rank]}` as Square
}

/** a1 — тёмная клетка. */
export function isLightSquare(square: Square): boolean {
  return (fileIndex(square) + rankIndex(square)) % 2 === 1
}
