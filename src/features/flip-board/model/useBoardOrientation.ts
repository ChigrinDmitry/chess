import { useCallback, useState } from 'react'
import type { Color } from '@/entities/game'

export interface BoardOrientation {
  /** Чьи фигуры внизу. */
  orientation: Color
  flipped: boolean
  flip: () => void
}

/** Ориентация доски: по умолчанию — цвет игрока, «Перевернуть» меняет её на противоположную. */
export function useBoardOrientation(base: Color): BoardOrientation {
  const [flipped, setFlipped] = useState(false)
  const flip = useCallback(() => setFlipped((f) => !f), [])
  const orientation: Color = flipped ? (base === 'w' ? 'b' : 'w') : base
  return { orientation, flipped, flip }
}
