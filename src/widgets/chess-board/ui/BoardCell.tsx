import { memo } from 'react'
import type { Square } from '@/entities/game'
import styles from './ChessBoard.module.css'

export interface BoardCellProps {
  square: Square
  light: boolean
  label: string
  focusable: boolean
  selected: boolean
  target: 'move' | 'capture' | undefined
  last: boolean
  check: boolean
  /** Буква вертикали — на нижнем ряду экрана. */
  fileLabel: string | undefined
  /** Цифра горизонтали — на левой колонке экрана. */
  rankLabel: string | undefined
}

export const BoardCell = memo(function BoardCell({
  square,
  light,
  label,
  focusable,
  selected,
  target,
  last,
  check,
  fileLabel,
  rankLabel,
}: BoardCellProps) {
  const classes = [
    styles.cell,
    light ? styles.light : styles.dark,
    last && styles.last,
    selected && styles.selected,
    check && styles.check,
    target && styles[target],
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      role="gridcell"
      className={classes}
      data-square={square}
      aria-label={label}
      aria-selected={selected}
      tabIndex={focusable ? 0 : -1}
    >
      {rankLabel && (
        <span className={`${styles.coord} ${styles.rank}`} aria-hidden="true">
          {rankLabel}
        </span>
      )}
      {fileLabel && (
        <span className={`${styles.coord} ${styles.file}`} aria-hidden="true">
          {fileLabel}
        </span>
      )}
    </div>
  )
})
