import type { Color } from '@/entities/game/@x/player'
import type { Player, PlayerIdentity, Seats } from './types'

export function emptySeats(): Seats {
  return { w: null, b: null }
}

/** Занимает цвет; `false`, если он занят другим игроком. Тот же игрок (по id) может сесть повторно. */
export function seat(seats: Seats, color: Color, identity: PlayerIdentity): Seats | null {
  const current = seats[color]
  if (current && current.id !== identity.id) return null
  return { ...seats, [color]: identity }
}

/** Свободный цвет; при двух свободных — `preferred`. */
export function freeColor(seats: Seats, preferred: Color = 'w'): Color | null {
  if (!seats[preferred]) return preferred
  const other: Color = preferred === 'w' ? 'b' : 'w'
  return seats[other] ? null : other
}

export function colorOf(seats: Seats, playerId: string): Color | null {
  if (seats.w?.id === playerId) return 'w'
  if (seats.b?.id === playerId) return 'b'
  return null
}

export function playersOf(seats: Seats): Player[] {
  const players: Player[] = []
  if (seats.w) players.push({ identity: seats.w, color: 'w' })
  if (seats.b) players.push({ identity: seats.b, color: 'b' })
  return players
}

export function isFull(seats: Seats): boolean {
  return seats.w !== null && seats.b !== null
}
