import type { MoveRecord } from '@/entities/game'

export interface MoveRow {
  /** Номер хода (1, 2, …). */
  number: number
  white: { san: string; ply: number } | undefined
  black: { san: string; ply: number } | undefined
}

/** Раскладывает ходы по строкам «номер — белые — чёрные»; `ply` — число полуходов после хода. */
export function toMoveRows(moves: readonly MoveRecord[]): MoveRow[] {
  const rows: MoveRow[] = []
  moves.forEach((move, index) => {
    const ply = index + 1
    const entry = { san: move.san, ply }
    if (move.color === 'w') {
      rows.push({ number: rows.length + 1, white: entry, black: undefined })
    } else {
      const last = rows.at(-1)
      // Партия с чёрных (FEN): первая строка начинается с многоточия
      if (last && !last.black) last.black = entry
      else rows.push({ number: rows.length + 1, white: undefined, black: entry })
    }
  })
  return rows
}
