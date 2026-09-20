import { BOT_LEVELS, DEFAULT_BOT_LEVEL, getBotLevel, levelCommands } from './levels'
import { moveTimeBudget } from './moveTime'

describe('уровни бота', () => {
  it('их восемь, идут по порядку и усиливаются', () => {
    expect(BOT_LEVELS.map((level) => level.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    for (const [index, level] of BOT_LEVELS.slice(1).entries()) {
      const previous = BOT_LEVELS[index]!
      expect(level.elo).toBeGreaterThan(previous.elo)
      expect(level.skill).toBeGreaterThanOrEqual(previous.skill)
      expect(level.depth).toBeGreaterThanOrEqual(previous.depth)
      expect(level.maxMoveTimeMs).toBeGreaterThanOrEqual(previous.maxMoveTimeMs)
    }
  })

  it('параметры укладываются в границы UCI', () => {
    for (const level of BOT_LEVELS) {
      expect(level.skill).toBeGreaterThanOrEqual(0)
      expect(level.skill).toBeLessThanOrEqual(20)
      expect(level.delayMs[0]).toBeLessThanOrEqual(level.delayMs[1])
    }
    expect(getBotLevel(DEFAULT_BOT_LEVEL).id).toBe(DEFAULT_BOT_LEVEL)
  })

  it('getBotLevel на неизвестный уровень бросает', () => {
    expect(() => getBotLevel(99 as never)).toThrow('Unknown bot level')
  })

  it('команды: обычный Skill Level без ограничения силы по Elo', () => {
    expect(levelCommands(getBotLevel(1))).toEqual([
      'setoption name UCI_LimitStrength value false',
      'setoption name Skill Level value 0',
    ])
    expect(levelCommands(getBotLevel(8))[1]).toBe('setoption name Skill Level value 14')
  })
})

describe('moveTimeBudget', () => {
  const level = getBotLevel(8)

  it('без часов — потолок уровня', () => {
    expect(moveTimeBudget(level, null)).toBe(level.maxMoveTimeMs)
  })

  it('на длинной партии не превышает потолок', () => {
    expect(moveTimeBudget(level, { remainingMs: 600_000, incrementMs: 0 })).toBe(
      level.maxMoveTimeMs,
    )
  })

  it('в цейтноте берёт долю остатка, но не меньше минимума', () => {
    expect(moveTimeBudget(level, { remainingMs: 15_000, incrementMs: 0 })).toBe(500)
    expect(moveTimeBudget(level, { remainingMs: 300, incrementMs: 0 })).toBe(30)
  })

  it('инкремент добавляет времени', () => {
    expect(moveTimeBudget(level, { remainingMs: 3000, incrementMs: 0 })).toBe(100)
    expect(moveTimeBudget(level, { remainingMs: 3000, incrementMs: 200 })).toBe(260)
  })
})
