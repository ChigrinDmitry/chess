import type { TimeControlId } from '@/entities/clock'
import { DEFAULT_BOT_LEVEL, type BotLevelId } from '@/entities/bot'

/** Цвет игрока: `random` разрешается при старте партии. */
export type ColorChoice = 'w' | 'b' | 'random'

export interface BotSettings {
  level: BotLevelId
  color: ColorChoice
  timeControl: TimeControlId
}

export const DEFAULT_BOT_SETTINGS: BotSettings = {
  level: DEFAULT_BOT_LEVEL,
  color: 'w',
  timeControl: '10+0',
}
