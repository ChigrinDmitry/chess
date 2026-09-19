import { useCallback, useEffect, useState } from 'react'
import {
  createClockStore,
  flaggedColor,
  getTimeControl,
  watchFlag,
  type ClockStoreApi,
  type TimeControlId,
} from '@/entities/clock'
import { createGameStore, type MoveInput } from '@/entities/game'

export const DEFAULT_TIME_CONTROL: TimeControlId = '10+0'

function createClock(id: TimeControlId): ClockStoreApi | null {
  const { config } = getTimeControl(id)
  return config ? createClockStore({ config }) : null
}

/**
 * Локальная партия за одним экраном: стор игры и часы. Часы стартуют после первого хода
 * белых (он времени не тратит и инкремента не даёт), дальше каждый ход передаёт их сопернику;
 * с концом партии — любым исходом — часы останавливаются, а упавший флаг заканчивает партию.
 *
 * Это временная склейка этапа 4: с этапа 5 то же делает `features/host-game` за транспортом.
 */
export function useLocalGame() {
  const [game] = useState(() => createGameStore())
  const [timeControl, setTimeControl] = useState<TimeControlId>(DEFAULT_TIME_CONTROL)
  const [clock, setClock] = useState(() => createClock(DEFAULT_TIME_CONTROL))

  // Упавший флаг — проигрыш по времени
  useEffect(() => {
    if (!clock) return
    return watchFlag(clock, (color) => {
      game.getState().flag(color)
    })
  }, [clock, game])

  // Партия окончена (мат, сдача, ничья, флаг) — часы стоят
  useEffect(() => {
    if (!clock) return
    return game.subscribe((state) => {
      if (state.result) clock.getState().stop()
    })
  }, [clock, game])

  const move = useCallback(
    (input: MoveInput) => {
      const before = game.getState().moves.length
      if (!game.getState().move(input).ok) return
      if (!clock || game.getState().result) return

      if (before === 0) {
        clock.getState().start('b')
        return
      }
      clock.getState().press()
      // Ходил уже с упавшим флагом, а таймер не успел сработать: время вышло раньше
      const flagged = flaggedColor(clock.getState(), Date.now())
      if (flagged) game.getState().flag(flagged)
    },
    [clock, game],
  )

  const newGame = useCallback(() => {
    game.getState().reset()
    setClock(createClock(timeControl))
  }, [game, timeControl])

  /** Смена контроля времени — только до первого хода: часы создаются заново. */
  const selectTimeControl = useCallback(
    (id: TimeControlId) => {
      if (game.getState().moves.length > 0) return
      setTimeControl(id)
      setClock(createClock(id))
    },
    [game],
  )

  return { game, clock, timeControl, selectTimeControl, move, newGame }
}
