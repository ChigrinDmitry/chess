import { useCallback, useEffect, useState } from 'react'
import type { ChessEngine } from '@/entities/bot'
import type { Color } from '@/entities/game'
import { DEFAULT_BOT_SETTINGS, type BotSettings } from '@/widgets/bot-settings-panel'
import { createBotGame, type BotGame } from './createBotGame'

export function resolveColor(choice: BotSettings['color'], random: () => number): Color {
  if (choice === 'random') return random() < 0.5 ? 'w' : 'b'
  return choice
}

export interface UseBotGameOptions {
  createEngine?: (() => ChessEngine) | undefined
  random?: (() => number) | undefined
}

/**
 * Настройки и текущая партия с ботом. Пока партии нет, страница показывает настройки;
 * жизненный цикл хоста, бота и клиента (`createBotGame`) привязан к компоненту.
 */
export function useBotGame({ createEngine, random = Math.random }: UseBotGameOptions = {}) {
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_BOT_SETTINGS)
  const [game, setGame] = useState<BotGame | null>(null)

  useEffect(() => {
    if (!game) return
    game.start()
    return game.stop
  }, [game])

  const start = useCallback(() => {
    setGame(
      createBotGame(
        {
          level: settings.level,
          color: resolveColor(settings.color, random),
          timeControl: settings.timeControl,
        },
        createEngine ? { createEngine } : {},
      ),
    )
  }, [settings, createEngine, random])

  /** Назад к настройкам: текущая партия отбрасывается. */
  const exit = useCallback(() => setGame(null), [])

  return { settings, setSettings, game, start, exit }
}
