import { useEffect, useMemo, useRef } from 'react'
import type { MoveRecord } from '@/entities/game'
import { toMoveRows } from '../model/moveRows'
import styles from './MoveList.module.css'

export interface MoveListProps {
  moves: readonly MoveRecord[]
  /** Показываемая позиция: число полуходов от начала. */
  viewPly: number
  onSelect: (ply: number) => void
}

/** Список ходов в SAN; клик по ходу показывает позицию после него. */
export function MoveList({ moves, viewPly, onSelect }: MoveListProps) {
  const rows = useMemo(() => toMoveRows(moves), [moves])
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // jsdom не реализует scrollIntoView
    activeRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [viewPly, moves.length])

  const cell = (entry: { san: string; ply: number } | undefined) => {
    if (!entry) return <span className={styles.empty}>…</span>
    const active = entry.ply === viewPly
    return (
      <button
        ref={active ? activeRef : undefined}
        type="button"
        className={[styles.move, active && styles.active].filter(Boolean).join(' ')}
        aria-current={active ? 'step' : undefined}
        onClick={() => onSelect(entry.ply)}
      >
        {entry.san}
      </button>
    )
  }

  if (rows.length === 0) return <p className={styles.placeholder}>Ходов пока нет</p>

  return (
    <ol className={styles.list} aria-label="Ходы партии">
      {rows.map((row) => (
        <li key={row.number} className={styles.row}>
          <span className={styles.number}>{row.number}.</span>
          {cell(row.white)}
          {cell(row.black)}
        </li>
      ))}
    </ol>
  )
}
