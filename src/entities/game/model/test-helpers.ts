import { createGameStore } from './store'
import type { GameStoreApi } from './store'
import type { PromotionPiece, Square } from './types'

/** Хранилище с партией из FEN (или начальной). */
export function gameFrom(startFen?: string): GameStoreApi {
  return createGameStore(startFen ? { startFen } : {})
}

/** Играет ходы в координатной записи через пробел: `e2e4 e7e5 a7a8q`. Все должны быть легальны. */
export function play(store: GameStoreApi, moves: string): void {
  for (const m of moves.split(' ')) {
    const promotion = m[4] as PromotionPiece | undefined
    const outcome = store.getState().move({
      from: m.slice(0, 2) as Square,
      to: m.slice(2, 4) as Square,
      ...(promotion ? { promotion } : {}),
    })
    if (!outcome.ok) throw new Error(`Нелегальный ход ${m}: ${outcome.error}`)
  }
}
