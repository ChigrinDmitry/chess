import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import type { Color } from '@/entities/game/@x/clock'
import { remainingMs } from './clock'
import type { ClockStoreApi } from './store'

/** Как часто перерисовывать идущие часы, мс. Точность самого времени от этого не зависит. */
const TICK_MS = 100

/** Остаток времени `color` для отображения; пока часы идут, обновляется по таймеру. */
export function useClockRemaining(store: ClockStoreApi, color: Color): number {
  const state = useStore(store)
  const [now, setNow] = useState(Date.now)
  const ticking = state.running !== null

  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [ticking])

  return remainingMs(state, color, Math.max(now, state.updatedAt))
}
