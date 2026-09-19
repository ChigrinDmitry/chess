import type { Color } from '@/entities/game/@x/player'

export type PlayerKind = 'guest' | 'user'

/** Внешность игрока: градиент из id + инициалы (генерирует `entities/session`, этап 8). */
export interface PlayerAvatar {
  /** Оттенок 0–359 для градиента. */
  hue: number
  initials: string
}

/** Идентичность игрока. `'user'` заложен в контракте, в MVP используется только `'guest'`. */
export interface PlayerIdentity {
  kind: PlayerKind
  id: string
  displayName: string
  avatar: PlayerAvatar
}

/** Игрок, севший за цвет в конкретной партии. */
export interface Player {
  identity: PlayerIdentity
  color: Color
}

/** Места в партии; `null` — цвет свободен (ждём соперника). */
export type Seats = Record<Color, PlayerIdentity | null>
