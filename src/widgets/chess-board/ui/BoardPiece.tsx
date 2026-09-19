import { memo } from 'react'
import type { Color, PieceType } from '@/entities/game'
import { Piece } from '@/entities/piece'
import styles from './ChessBoard.module.css'

export interface BoardPieceProps {
  color: Color
  type: PieceType
  /** Положение левого верхнего угла в клетках; при перетаскивании — дробное. */
  x: number
  y: number
  dragging: boolean
  movable: boolean
}

export const BoardPiece = memo(function BoardPiece({
  color,
  type,
  x,
  y,
  dragging,
  movable,
}: BoardPieceProps) {
  const classes = [styles.piece, movable && styles.movable, dragging && styles.dragging]
    .filter(Boolean)
    .join(' ')
  const scale = dragging ? ' scale(1.12)' : ''

  return (
    <div className={classes} style={{ transform: `translate(${x * 100}%, ${y * 100}%)${scale}` }}>
      <Piece color={color} type={type} />
    </div>
  )
})
