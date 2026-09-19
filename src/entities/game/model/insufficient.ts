import type { Color, Piece } from './types'

/**
 * Может ли `color` поставить мат сопернику хоть какой-то серией легальных ходов.
 * Нужна для падения флага у соперника (ст. 6.9 FIDE): если мат невозможен — ничья.
 *
 * Пешка, ладья, ферзь или два и более коня/слонов — мат возможен всегда. Один конь или
 * слон мат ставит только в связке с материалом соперника (кооперативный мат: соперник сам
 * загораживает своего короля).
 */
export function canDeliverMate(pieces: readonly Piece[], color: Color): boolean {
  let minors = 0
  let opponentHasMaterial = false
  for (const p of pieces) {
    if (p.color !== color) {
      if (p.type !== 'k') opponentHasMaterial = true
      continue
    }
    if (p.type === 'p' || p.type === 'r' || p.type === 'q') return true
    if (p.type === 'n' || p.type === 'b') minors += 1
  }
  if (minors >= 2) return true
  return minors === 1 && opponentHasMaterial
}
