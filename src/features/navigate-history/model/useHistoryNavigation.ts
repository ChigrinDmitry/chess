import { useCallback, useState } from 'react'

export interface HistoryNavigation {
  /** Сколько полуходов сыграно. */
  total: number
  /** Показываемая позиция: число полуходов от начала (0 — начальная). */
  ply: number
  /** Показывается текущая позиция партии, а не прошлая. */
  isLive: boolean
  goTo: (ply: number) => void
  first: () => void
  prev: () => void
  next: () => void
  /** К текущей позиции. */
  goLive: () => void
}

/**
 * Просмотр истории: `null` означает «слежу за текущей позицией», поэтому новые ходы
 * не сдвигают позицию, пока пользователь не ушёл в прошлое. Число полуходов `total`
 * приходит извне; при новой партии вызывающий возвращает просмотр в «сейчас» через `goLive`.
 */
export function useHistoryNavigation(total: number): HistoryNavigation {
  const [viewed, setViewed] = useState<number | null>(null)
  const ply = viewed === null ? total : Math.min(viewed, total)

  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.min(Math.max(Math.trunc(target), 0), total)
      setViewed(clamped >= total ? null : clamped)
    },
    [total],
  )

  return {
    total,
    ply,
    isLive: ply >= total,
    goTo,
    first: useCallback(() => goTo(0), [goTo]),
    prev: useCallback(() => goTo(ply - 1), [goTo, ply]),
    next: useCallback(() => goTo(ply + 1), [goTo, ply]),
    goLive: useCallback(() => setViewed(null), []),
  }
}
