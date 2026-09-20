import type { BotLevelId } from './types'

export interface BotLevel {
  id: BotLevelId
  name: string
  /** Ориентир силы для интерфейса, а не измеренный рейтинг. */
  elo: number
  /** `Skill Level` Stockfish, 0–20: чем ниже, тем чаще движок выбирает не лучший ход. */
  skill: number
  /** Потолок глубины поиска: главный рычаг силы на слабых уровнях. */
  depth: number
  /** Потолок времени на ход (страховка: обычно поиск заканчивается по глубине раньше). */
  maxMoveTimeMs: number
  /** «Человеческая» пауза перед ходом: случайное значение из диапазона. */
  delayMs: readonly [min: number, max: number]
}

/**
 * Уровни 1–8: от новичка до ~2000 Elo (ТЗ §3.5). Сила растёт вместе с `skill` и `depth`.
 * `UCI_Elo` не используем: он откалиброван под длинный контроль и при 100–500 мс на ход играет
 * слабее уровня на `Skill Level`. Лестница подобрана матчами между соседними уровнями (каждый
 * следующий выигрывает у предыдущего в ~70–85% партий); абсолютные Elo в `elo` — оценка.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  { id: 1, name: 'Новичок', elo: 800, skill: 0, depth: 1, maxMoveTimeMs: 50, delayMs: [500, 1200] },
  {
    id: 2,
    name: 'Любитель',
    elo: 1000,
    skill: 2,
    depth: 1,
    maxMoveTimeMs: 50,
    delayMs: [500, 1300],
  },
  {
    id: 3,
    name: 'Игрок',
    elo: 1150,
    skill: 4,
    depth: 2,
    maxMoveTimeMs: 80,
    delayMs: [500, 1400],
  },
  {
    id: 4,
    name: 'Клубный',
    elo: 1300,
    skill: 6,
    depth: 3,
    maxMoveTimeMs: 120,
    delayMs: [600, 1500],
  },
  {
    id: 5,
    name: 'Разрядник',
    elo: 1450,
    skill: 8,
    depth: 4,
    maxMoveTimeMs: 200,
    delayMs: [600, 1600],
  },
  {
    id: 6,
    name: 'Уверенный',
    elo: 1600,
    skill: 10,
    depth: 5,
    maxMoveTimeMs: 300,
    delayMs: [600, 1600],
  },
  {
    id: 7,
    name: 'Сильный',
    elo: 1800,
    skill: 12,
    depth: 6,
    maxMoveTimeMs: 500,
    delayMs: [500, 1500],
  },
  {
    id: 8,
    name: 'Эксперт',
    elo: 2000,
    skill: 14,
    depth: 8,
    maxMoveTimeMs: 800,
    delayMs: [500, 1500],
  },
]

export const DEFAULT_BOT_LEVEL: BotLevelId = 3

export function getBotLevel(id: BotLevelId): BotLevel {
  const found = BOT_LEVELS.find((level) => level.id === id)
  if (!found) throw new Error(`Unknown bot level: ${id}`)
  return found
}

/** Команды UCI, настраивающие движок на уровень. */
export function levelCommands(level: BotLevel): string[] {
  return [
    'setoption name UCI_LimitStrength value false',
    `setoption name Skill Level value ${level.skill}`,
  ]
}
