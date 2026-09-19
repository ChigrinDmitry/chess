import type { PlacedPiece } from '@/entities/game'
import { fileIndex, rankIndex } from './geometry'

/** Фигура с устойчивой личностью: пока она жива, её `id` не меняется — на этом держится анимация хода. */
export interface TrackedPiece extends PlacedPiece {
  id: number
}

export interface Tracking {
  pieces: TrackedPiece[]
  nextId: number
}

function distance(a: PlacedPiece, b: PlacedPiece): number {
  return Math.hypot(
    fileIndex(a.square) - fileIndex(b.square),
    rankIndex(a.square) - rankIndex(b.square),
  )
}

/**
 * Присваивает фигурам новой позиции `id` фигур прошлой: сначала те, что не сдвинулись,
 * затем — ближайшая фигура того же вида (ход, рокировка, взятие, откат). Остальные
 * (превращение) получают новые `id`. Результат упорядочен по `id`, чтобы DOM не переставлялся.
 */
export function trackPieces(prev: Tracking, next: readonly PlacedPiece[]): Tracking {
  let nextId = prev.nextId
  const free = new Set(prev.pieces)
  const assigned = new Map<PlacedPiece, TrackedPiece>()

  for (const piece of next) {
    const same = prev.pieces.find(
      (p) =>
        free.has(p) &&
        p.square === piece.square &&
        p.type === piece.type &&
        p.color === piece.color,
    )
    if (same) {
      free.delete(same)
      assigned.set(piece, { ...piece, id: same.id })
    }
  }

  for (const piece of next) {
    if (assigned.has(piece)) continue
    let best: TrackedPiece | undefined
    for (const p of free) {
      if (p.type !== piece.type || p.color !== piece.color) continue
      if (!best || distance(p, piece) < distance(best, piece)) best = p
    }
    if (best) free.delete(best)
    assigned.set(piece, { ...piece, id: best ? best.id : nextId++ })
  }

  const pieces = [...assigned.values()].sort((a, b) => a.id - b.id)
  return { pieces, nextId }
}

export const EMPTY_TRACKING: Tracking = { pieces: [], nextId: 0 }
