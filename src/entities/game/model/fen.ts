import type { Color, Piece, PieceType, PlacedPiece, Square } from './types'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const FILES = 'abcdefgh'
const PIECE_TYPES: readonly string[] = ['p', 'n', 'b', 'r', 'q', 'k']

/** Стоимость фигур для материального перевеса (король не считается). */
export const PIECE_VALUES: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Фигуры на доске из первого поля FEN. Порядок: от a8 к h1. */
export function piecesFromFen(fen: string): PlacedPiece[] {
  const placement = fen.split(' ')[0] ?? ''
  const pieces: PlacedPiece[] = []
  placement.split('/').forEach((row, rowIndex) => {
    let file = 0
    for (const ch of row) {
      const empty = Number(ch)
      if (Number.isInteger(empty) && empty > 0) {
        file += empty
        continue
      }
      const type = ch.toLowerCase()
      if (PIECE_TYPES.includes(type)) {
        const color: Color = ch === type ? 'b' : 'w'
        pieces.push({
          color,
          type: type as PieceType,
          square: `${FILES[file]}${8 - rowIndex}` as Square,
        })
      }
      file += 1
    }
  })
  return pieces
}

export function countMaterial(pieces: readonly Piece[], color: Color): number {
  return pieces.reduce((sum, p) => (p.color === color ? sum + PIECE_VALUES[p.type] : sum), 0)
}
