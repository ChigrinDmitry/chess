import { useCallback, useState } from 'react'
import type { Color } from '@/entities/game'

export interface DrawOffer {
  /** Кто предложил ничью; `null` — предложения нет. */
  offeredBy: Color | null
  offer: (color: Color) => void
  /** Снять предложение (отклонено или принято). */
  clear: () => void
}

/**
 * Предложение ничьей живёт до ответа или до следующего хода: ход соперника — это отказ.
 * Предложение помнит, на каком полуходе сделано, поэтому сбрасывается само, без эффектов.
 */
export function useDrawOffer(plyCount: number): DrawOffer {
  const [offer, setOffer] = useState<{ by: Color; atPly: number } | null>(null)
  const active = offer !== null && offer.atPly === plyCount ? offer : null

  return {
    offeredBy: active?.by ?? null,
    offer: useCallback((color) => setOffer({ by: color, atPly: plyCount }), [plyCount]),
    clear: useCallback(() => setOffer(null), []),
  }
}
