import { getTimeControl, type TimeControlId } from '@/entities/clock'
import type { Color } from '@/entities/game'
import type { PlayerIdentity } from '@/entities/player'
import { createGameClient, type GameClient } from '@/features/game-client'
import { createGameHost } from '@/features/host-game'
import { createLocalRoom } from '@/shared/api'

export const LOCAL_PLAYERS: Record<Color, PlayerIdentity> = {
  w: {
    kind: 'guest',
    id: 'local-white',
    displayName: 'Белые',
    avatar: { hue: 220, initials: 'Б' },
  },
  b: {
    kind: 'guest',
    id: 'local-black',
    displayName: 'Чёрные',
    avatar: { hue: 20, initials: 'Ч' },
  },
}

/** За экраном сидит один человек, он ходит за обе стороны. */
const LOCAL_CLIENT: PlayerIdentity = {
  kind: 'guest',
  id: 'local',
  displayName: 'Локальная партия',
  avatar: { hue: 200, initials: 'Л' },
}

export interface LocalGame {
  client: GameClient
  /** Запускает хост и подключает клиента. Можно вызвать снова после `stop`. */
  start(): void
  stop(): void
}

/**
 * Локальная партия идёт тем же путём, что и любая другая: клиент → транспорт → хост.
 * Отличается только транспорт — комната в памяти без сети.
 */
export function createLocalGame(timeControl: TimeControlId): LocalGame {
  const room = createLocalRoom()
  const host = createGameHost({
    transport: room.host,
    clock: getTimeControl(timeControl).config,
    hotSeat: LOCAL_PLAYERS,
  })
  const client = createGameClient({
    transport: room.createClient(),
    gameId: 'local',
    identity: LOCAL_CLIENT,
    // Экран сразу показывает партию и часы, а не ждёт ответа хоста
    initial: host.snapshot(),
  })

  return {
    client,
    start: () => {
      host.start()
      client.start()
    },
    stop: () => {
      client.stop()
      host.stop()
    },
  }
}
