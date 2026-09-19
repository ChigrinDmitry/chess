import { useCallback, useMemo, useState } from 'react'
import type { Color, LegalMove, MoveInput, PromotionPiece, Square } from '@/entities/game'

export interface MoveTarget {
  square: Square
  /** Ход со взятием (в т.ч. на проходе) — рисуется кольцом, а не точкой. */
  capture: boolean
}

export interface PendingPromotion {
  from: Square
  to: Square
}

export interface UseMoveInputOptions {
  /** Чей ход в отображаемой позиции. */
  turn: Color
  /**
   * Легальные ходы стороны, которая ходит. Ссылка должна меняться вместе с позицией —
   * по ней сбрасывается выбор фигуры.
   */
  legalMoves: readonly LegalMove[]
  /** Цвета, за которые пользователь может ходить (пусто — только просмотр). */
  movableColors: readonly Color[]
  onMove: (move: MoveInput) => void
}

export interface MoveInputApi {
  selected: Square | null
  /** Клетки, куда может пойти выбранная фигура. */
  targets: ReadonlyMap<Square, MoveTarget>
  /** Ход-превращение ждёт выбора фигуры. */
  pendingPromotion: PendingPromotion | null
  /** Можно ли взять фигуру с клетки (её ход, есть ходы, пользователь ходит за неё). */
  canMoveFrom: (square: Square) => boolean
  /** Клик/тап/Enter по клетке: выбрать фигуру, сделать ход или снять выбор. */
  activate: (square: Square) => void
  /** Фигуру начали тащить — выбираем её (как при клике). */
  startDrag: (square: Square) => void
  /** Фигуру отпустили над клеткой (`null` — за доской). */
  drop: (square: Square | null) => void
  /** Снять выбор и отменить превращение. */
  cancel: () => void
  /** Выбор фигуры для превращения; `null` — отмена. */
  resolvePromotion: (piece: PromotionPiece | null) => void
}

interface Selection {
  square: Square
  /** `legalMoves`, при которых сделан выбор: новая позиция инвалидирует выбор. */
  basis: readonly LegalMove[]
}

interface Pending extends PendingPromotion {
  basis: readonly LegalMove[]
}

/** Ввод хода: клик-клик и drag&drop, превращение пешки. Без DOM — только состояние. */
export function useMoveInput({
  turn,
  legalMoves,
  movableColors,
  onMove,
}: UseMoveInputOptions): MoveInputApi {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const canMove = movableColors.includes(turn)
  const selected = canMove && selection?.basis === legalMoves ? selection.square : null
  const pendingPromotion = pending?.basis === legalMoves ? pending : null

  const targets = useMemo(() => {
    const map = new Map<Square, MoveTarget>()
    if (!selected) return map
    for (const m of legalMoves) {
      if (m.from !== selected) continue
      const capture = m.captured !== undefined || m.enPassant
      map.set(m.to, { square: m.to, capture })
    }
    return map
  }, [legalMoves, selected])

  const canMoveFrom = useCallback(
    (square: Square) => canMove && legalMoves.some((m) => m.from === square),
    [canMove, legalMoves],
  )

  const select = useCallback(
    (square: Square | null) => setSelection(square ? { square, basis: legalMoves } : null),
    [legalMoves],
  )

  const tryMove = useCallback(
    (from: Square, to: Square) => {
      const candidates = legalMoves.filter((m) => m.from === from && m.to === to)
      if (candidates.length === 0) return false
      if (candidates.some((m) => m.promotion !== undefined)) {
        setPending({ from, to, basis: legalMoves })
        return true
      }
      setSelection(null)
      onMove({ from, to })
      return true
    },
    [legalMoves, onMove],
  )

  const activate = useCallback(
    (square: Square) => {
      if (pendingPromotion) return
      if (selected && tryMove(selected, square)) return
      if (square !== selected && canMoveFrom(square)) select(square)
      else select(null)
    },
    [pendingPromotion, selected, tryMove, canMoveFrom, select],
  )

  const startDrag = useCallback(
    (square: Square) => {
      if (pendingPromotion || !canMoveFrom(square)) return
      select(square)
    },
    [pendingPromotion, canMoveFrom, select],
  )

  const drop = useCallback(
    (square: Square | null) => {
      if (!selected || square === selected) return
      if (!square || !tryMove(selected, square)) select(null)
    },
    [selected, tryMove, select],
  )

  const cancel = useCallback(() => {
    setSelection(null)
    setPending(null)
  }, [])

  const resolvePromotion = useCallback(
    (piece: PromotionPiece | null) => {
      if (!pendingPromotion) return
      const { from, to } = pendingPromotion
      setPending(null)
      if (!piece) return
      setSelection(null)
      onMove({ from, to, promotion: piece })
    },
    [pendingPromotion, onMove],
  )

  return {
    selected,
    targets,
    pendingPromotion,
    canMoveFrom,
    activate,
    startDrag,
    drop,
    cancel,
    resolvePromotion,
  }
}
