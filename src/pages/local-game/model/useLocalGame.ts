import { useCallback, useEffect, useState } from 'react'
import type { TimeControlId } from '@/entities/clock'
import { createLocalGame } from './createLocalGame'

export const DEFAULT_TIME_CONTROL: TimeControlId = '10+0'

/**
 * Локальная партия за одним экраном: жизненный цикл хоста и клиента (`createLocalGame`)
 * привязан к компоненту. Смена контроля времени создаёт партию заново, «новая партия» — реванш.
 */
export function useLocalGame() {
  const [timeControl, setTimeControl] = useState<TimeControlId>(DEFAULT_TIME_CONTROL)
  const [local, setLocal] = useState(() => createLocalGame(DEFAULT_TIME_CONTROL))

  useEffect(() => {
    local.start()
    return local.stop
  }, [local])

  /** Смена контроля времени — только до первого хода: хост создаётся заново. */
  const selectTimeControl = useCallback(
    (id: TimeControlId) => {
      if (local.client.game.getState().moves.length > 0) return
      setTimeControl(id)
      setLocal(createLocalGame(id))
    },
    [local],
  )

  const newGame = useCallback(() => local.client.rematch(), [local])

  return { client: local.client, timeControl, selectTimeControl, newGame }
}
