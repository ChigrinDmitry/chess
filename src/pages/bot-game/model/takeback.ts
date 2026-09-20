import type { Color } from '@/entities/game'

/** Отмена возможна, если хватает ходов: свой и ответ соперника (или только свой, пока он думает). */
export function canTakeBack(plyCount: number, turn: Color, mine: Color): boolean {
  return plyCount >= (turn === mine ? 2 : 1)
}
