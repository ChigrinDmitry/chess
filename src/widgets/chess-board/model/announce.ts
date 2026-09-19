import type { MoveRecord, PieceType, PromotionPiece, Square } from '@/entities/game'
import { pieceName } from '@/entities/piece'

const PIECE_ACCUSATIVE: Record<PieceType, string> = {
  p: 'пешку',
  n: 'коня',
  b: 'слона',
  r: 'ладью',
  q: 'ферзя',
  k: 'короля',
}

const PROMOTION_NAME: Record<PromotionPiece, string> = {
  n: 'конь',
  b: 'слон',
  r: 'ладья',
  q: 'ферзь',
}

/** Ход словами для live-region: «Белый конь g1 — f3», «Чёрная пешка берёт пешку, d5», рокировка, шах. */
export function describeMove(move: MoveRecord): string {
  const who = capitalize(pieceName(move.color, move.piece))
  let text: string
  if (move.castle) {
    text = `${move.color === 'w' ? 'Белые' : 'Чёрные'}: ${move.castle === 'k' ? 'короткая' : 'длинная'} рокировка`
  } else if (move.captured) {
    const capture = move.enPassant ? 'берёт на проходе' : `берёт ${PIECE_ACCUSATIVE[move.captured]}`
    text = `${who} ${move.from} ${capture}, ${move.to}`
  } else {
    text = `${who} ${move.from} — ${move.to}`
  }
  if (move.promotion) text += `, превращение: ${PROMOTION_NAME[move.promotion]}`
  if (move.san.endsWith('#')) text += ', мат'
  else if (move.san.endsWith('+')) text += ', шах'
  return text
}

export interface CellLabelInput {
  square: Square
  piece: { color: 'w' | 'b'; type: PieceType } | undefined
  selected: boolean
  target: 'move' | 'capture' | undefined
}

/** Подпись клетки для скринридера: «e4, белая пешка, выбрана» / «e5, пусто, возможный ход». */
export function cellLabel({ square, piece, selected, target }: CellLabelInput): string {
  const parts: string[] = [square, piece ? pieceName(piece.color, piece.type) : 'пусто']
  if (selected) parts.push('выбрана')
  if (target === 'move') parts.push('возможный ход')
  if (target === 'capture') parts.push('возможное взятие')
  return parts.join(', ')
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
