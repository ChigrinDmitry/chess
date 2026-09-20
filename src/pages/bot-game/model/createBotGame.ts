import { createStockfishEngine, type BotLevelId, type ChessEngine } from '@/entities/bot'
import { getTimeControl, type TimeControlId } from '@/entities/clock'
import { START_FEN, type Color } from '@/entities/game'
import type { PlayerIdentity } from '@/entities/player'
import { createGameClient, type GameClient } from '@/features/game-client'
import { createGameHost } from '@/features/host-game'
import { createBotPlayer, type BotPlayer } from '@/features/play-vs-bot'
import { createLocalRoom, type StateMessage } from '@/shared/api'

/** Человек за экраном; настоящий гость с ником появится вместе с `entities/session` (этап 8). */
export const HUMAN_PLAYER: PlayerIdentity = {
  kind: 'guest',
  id: 'human',
  displayName: 'Вы',
  avatar: { hue: 200, initials: 'В' },
}

export interface BotGameSettings {
  level: BotLevelId
  /** За какой цвет играет человек. */
  color: Color
  timeControl: TimeControlId
}

export interface BotGameOptions {
  /** Создаёт движок бота; в тестах подменяется. */
  createEngine?: () => ChessEngine
}

export interface BotGame {
  client: GameClient
  bot: BotPlayer
  settings: BotGameSettings
  /** Запускает хост, бота и клиента. Можно вызвать снова после `stop`. */
  start(): void
  stop(): void
}

/**
 * Партия с ботом: хост, бот и человек сидят в одной комнате в памяти. Бот — такой же клиент,
 * как и человек, поэтому партия не знает, кто её соперник. Хост здесь без hot-seat:
 * места заняты двумя разными игроками.
 */
export function createBotGame(settings: BotGameSettings, options: BotGameOptions = {}): BotGame {
  const { createEngine = () => createStockfishEngine() } = options
  const botColor: Color = settings.color === 'w' ? 'b' : 'w'
  const clock = getTimeControl(settings.timeControl).config

  const room = createLocalRoom()
  const host = createGameHost({ transport: room.host, clock })
  const bot = createBotPlayer({
    transport: room.createClient(),
    gameId: 'bot',
    level: settings.level,
    color: botColor,
    createEngine,
  })

  // Экран сразу показывает игроков и часы, а не ждёт входа в комнату
  const initial: StateMessage = {
    type: 'state',
    status: 'playing',
    startFen: START_FEN,
    fen: START_FEN,
    moves: [],
    clock: clock
      ? {
          config: clock,
          remaining: { w: clock.initialMs, b: clock.initialMs },
          running: null,
        }
      : null,
    result: null,
    players: {
      w: settings.color === 'w' ? HUMAN_PLAYER : bot.identity,
      b: settings.color === 'w' ? bot.identity : HUMAN_PLAYER,
    },
    you: [settings.color],
    drawOffer: null,
  }
  const client = createGameClient({
    transport: room.createClient(),
    gameId: 'bot',
    identity: HUMAN_PLAYER,
    color: settings.color,
    initial,
  })

  return {
    client,
    bot,
    settings,
    start: () => {
      host.start()
      // Бот садится первым: он получает цвет, который оставил человек
      bot.start()
      client.start()
    },
    stop: () => {
      client.stop()
      bot.stop()
      host.stop()
    },
  }
}
