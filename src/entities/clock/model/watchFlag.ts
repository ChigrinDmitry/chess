import type { Color } from '@/entities/game/@x/clock'
import { flaggedColor, msUntilFlag, type ClockState } from './clock'
import type { ClockStoreApi } from './store'

/**
 * Следит за часами одним точным `setTimeout` до падения флага и перевзводит его при каждом
 * изменении стора (ход, пауза, resync). Возвращает функцию отписки.
 * Если таймер сработал чуть раньше времени, он перевзводится, а не роняет флаг преждевременно.
 */
export function watchFlag(
  store: ClockStoreApi,
  onFlag: (color: Color) => void,
  now: () => number = Date.now,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const arm = (state: ClockState) => {
    clearTimeout(timer)
    timer = undefined
    const wait = msUntilFlag(state, now())
    if (wait === null) return
    timer = setTimeout(() => {
      const current = store.getState()
      const flagged = flaggedColor(current, now())
      if (flagged && current.running === flagged) onFlag(flagged)
      else arm(current)
    }, wait)
  }

  arm(store.getState())
  const unsubscribe = store.subscribe(arm)
  return () => {
    unsubscribe()
    clearTimeout(timer)
  }
}
