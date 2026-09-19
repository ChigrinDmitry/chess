import type { Color } from '@/entities/game/@x/clock'
import { LOW_TIME_MS, formatClock } from '../model/format'
import type { ClockStoreApi } from '../model/store'
import { useClockRemaining } from '../model/useClockRemaining'
import styles from './ClockFace.module.css'

export interface ClockFaceProps {
  store: ClockStoreApi
  color: Color
  className?: string | undefined
}

/** Циферблат одной стороны. Подсвечивается, пока часы идут, и краснеет при нехватке времени. */
export function ClockFace({ store, color, className }: ClockFaceProps) {
  const remaining = useClockRemaining(store, color)
  const running = store.getState().running === color

  const classes = [
    styles.clock,
    running && styles.running,
    remaining < LOW_TIME_MS && styles.low,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      role="timer"
      aria-label={`Часы ${color === 'w' ? 'белых' : 'чёрных'}`}
      className={classes}
      data-running={running}
    >
      {formatClock(remaining)}
    </span>
  )
}
