import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { Color, LegalMove, MoveInput, MoveRecord, PlacedPiece, Square } from '@/entities/game'
import { PieceDefs } from '@/entities/piece'
import { useMoveInput } from '@/features/make-move'
import { PromotionDialog } from '@/features/promote-pawn'
import { beginPointerGesture } from '@/shared/lib/pointer-drag'
import { cellLabel, describeMove } from '../model/announce'
import { FILES, RANKS, fromView, isLightSquare, toView } from '../model/geometry'
import { EMPTY_TRACKING, trackPieces, type Tracking } from '../model/trackPieces'
import { BoardCell } from './BoardCell'
import { BoardPiece } from './BoardPiece'
import styles from './ChessBoard.module.css'

export interface ChessBoardProps {
  pieces: readonly PlacedPiece[]
  /** Чей ход в показанной позиции. */
  turn: Color
  /** Легальные ходы стороны, которая ходит; ссылка меняется вместе с позицией. */
  legalMoves: readonly LegalMove[]
  lastMove?: MoveRecord | undefined
  /** Клетка короля под шахом. */
  checkedSquare?: Square | null | undefined
  /** Чьи фигуры внизу. */
  orientation: Color
  /** Цвета, за которые пользователь может ходить; пусто — доска только для просмотра. */
  movableColors: readonly Color[]
  onMove: (move: MoveInput) => void
  className?: string | undefined
}

/** Положение перетаскиваемой фигуры в клетках доски (левый верхний угол). */
interface DragState {
  square: Square
  x: number
  y: number
}

function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

/** Хранит `id` фигур между позициями, чтобы ход анимировался, а не пересоздавал фигуру. */
function useTrackedPieces(pieces: readonly PlacedPiece[]) {
  const [state, setState] = useState<{ source: readonly PlacedPiece[]; tracking: Tracking }>(
    () => ({
      source: pieces,
      tracking: trackPieces(EMPTY_TRACKING, pieces),
    }),
  )
  if (state.source === pieces) return state.tracking
  const tracking = trackPieces(state.tracking, pieces)
  setState({ source: pieces, tracking })
  return tracking
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

export function ChessBoard({
  pieces,
  turn,
  legalMoves,
  lastMove,
  checkedSquare,
  orientation,
  movableColors,
  onMove,
  className,
}: ChessBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const moveInput = useMoveInput({ turn, legalMoves, movableColors, onMove })
  // Жест живёт дольше рендера, поэтому обращается к свежему состоянию через ref
  const inputRef = useLatest(moveInput)
  const orientationRef = useLatest(orientation)

  const tracking = useTrackedPieces(pieces)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [focusSquare, setFocusSquare] = useState<Square>(orientation === 'w' ? 'e2' : 'e7')

  const pieceAt = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces])
  const { selected, targets, pendingPromotion } = moveInput

  /** Клетка под точкой экрана и её дробные координаты в клетках. */
  const locate = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    const x = ((clientX - rect.left) / rect.width) * 8
    const y = ((clientY - rect.top) / rect.height) * 8
    return { x, y, square: fromView(Math.floor(x), Math.floor(y), orientationRef.current) }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const start = locate(event.clientX, event.clientY)
    if (!start?.square) return
    const square = start.square
    beginPointerGesture(event.nativeEvent, {
      draggable: inputRef.current.canMoveFrom(square) && !inputRef.current.pendingPromotion,
      onDragStart: () => inputRef.current.startDrag(square),
      onDragMove: ({ x, y }) => {
        const at = locate(x, y)
        if (at) setDrag({ square, x: at.x - 0.5, y: at.y - 0.5 })
      },
      onDrop: ({ x, y }) => {
        setDrag(null)
        inputRef.current.drop(locate(x, y)?.square ?? null)
      },
      onTap: () => {
        setFocusSquare(square)
        inputRef.current.activate(square)
      },
      onCancel: () => {
        setDrag(null)
        inputRef.current.cancel()
      },
    })
  }

  // Клик без указателя (скринридер, «нажать» с ассистивных технологий): detail === 0
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.detail !== 0) return
    const square = squareOf(event.target)
    if (square) moveInput.activate(square)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const square = squareOf(event.target)
    if (!square) return
    const arrow = ARROWS[event.key]
    if (arrow) {
      event.preventDefault()
      const { col, row } = toView(square, orientation)
      const next = fromView(
        Math.min(7, Math.max(0, col + arrow[0])),
        Math.min(7, Math.max(0, row + arrow[1])),
        orientation,
      )
      if (!next) return
      setFocusSquare(next)
      boardRef.current?.querySelector<HTMLElement>(`[data-square="${next}"]`)?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      moveInput.activate(square)
    } else if (event.key === 'Escape') {
      moveInput.cancel()
    }
  }

  const rows = []
  for (let row = 0; row < 8; row++) {
    const cells = []
    for (let col = 0; col < 8; col++) {
      const square = fromView(col, row, orientation)
      if (!square) continue
      const target = targets.get(square)
      const isSelected = selected === square
      cells.push(
        <BoardCell
          key={square}
          square={square}
          light={isLightSquare(square)}
          label={cellLabel({
            square,
            piece: pieceAt.get(square),
            selected: isSelected,
            target: target ? (target.capture ? 'capture' : 'move') : undefined,
          })}
          focusable={square === focusSquare}
          selected={isSelected}
          target={target ? (target.capture ? 'capture' : 'move') : undefined}
          last={lastMove?.from === square || lastMove?.to === square}
          check={checkedSquare === square}
          fileLabel={row === 7 ? square[0] : undefined}
          rankLabel={col === 0 ? square[1] : undefined}
        />,
      )
    }
    rows.push(
      <div key={row} role="row" className={styles.row}>
        {cells}
      </div>,
    )
  }

  const boardClasses = [styles.board, movableColors.length > 0 && styles.interactive]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={[styles.frame, className].filter(Boolean).join(' ')}>
      <PieceDefs />
      <div
        ref={boardRef}
        role="grid"
        aria-label="Шахматная доска"
        aria-rowcount={RANKS.length}
        aria-colcount={FILES.length}
        className={boardClasses}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {rows}
        <div className={styles.pieces} aria-hidden="true">
          {tracking.pieces.map((piece) => {
            const dragging = drag?.square === piece.square
            const view = toView(piece.square, orientation)
            return (
              <BoardPiece
                key={piece.id}
                color={piece.color}
                type={piece.type}
                x={dragging ? drag.x : view.col}
                y={dragging ? drag.y : view.row}
                dragging={dragging}
                movable={piece.color === turn && moveInput.canMoveFrom(piece.square)}
              />
            )
          })}
        </div>
      </div>
      <div role="status" aria-live="polite" className={styles.status}>
        {lastMove ? describeMove(lastMove) : ''}
      </div>
      <PromotionDialog
        open={pendingPromotion !== null}
        color={turn}
        onSelect={moveInput.resolvePromotion}
        onCancel={() => moveInput.resolvePromotion(null)}
      />
    </div>
  )
}

function squareOf(target: EventTarget): Square | null {
  const cell = (target as HTMLElement).closest?.<HTMLElement>('[data-square]')
  return (cell?.dataset.square as Square | undefined) ?? null
}
