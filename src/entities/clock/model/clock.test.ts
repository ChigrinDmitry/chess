import {
  createClock,
  flaggedColor,
  msUntilFlag,
  pressClock,
  remainingMs,
  snapshotClock,
  startClock,
  stopClock,
  syncClock,
} from './clock'

const CONFIG = { initialMs: 60_000, incrementMs: 2000 }
const T0 = 1_000_000

describe('часы', () => {
  it('создаются остановленными с полным временем', () => {
    const clock = createClock(CONFIG, T0)

    expect(clock.running).toBeNull()
    expect(remainingMs(clock, 'w', T0 + 10_000)).toBe(60_000)
    expect(remainingMs(clock, 'b', T0 + 10_000)).toBe(60_000)
  })

  it('идут только у той стороны, чьи часы запущены', () => {
    const clock = startClock(createClock(CONFIG, T0), 'w', T0)

    expect(remainingMs(clock, 'w', T0 + 5000)).toBe(55_000)
    expect(remainingMs(clock, 'b', T0 + 5000)).toBe(60_000)
  })

  it('считают по timestamp: пропущенные тики не дают дрейфа', () => {
    const clock = startClock(createClock(CONFIG, T0), 'w', T0)
    // ни одного «тика» между — остаток зависит только от now
    expect(remainingMs(clock, 'w', T0 + 12_345)).toBe(60_000 - 12_345)
    expect(remainingMs(clock, 'w', T0 + 12_345)).toBe(60_000 - 12_345)
  })

  it('now раньше updatedAt не увеличивает время', () => {
    const clock = startClock(createClock(CONFIG, T0), 'w', T0)
    expect(remainingMs(clock, 'w', T0 - 5000)).toBe(60_000)
  })

  it('повторный запуск не сбрасывает отсчёт', () => {
    const started = startClock(createClock(CONFIG, T0), 'w', T0)
    const again = startClock(started, 'b', T0 + 5000)

    expect(again).toBe(started)
  })

  describe('pressClock', () => {
    it('списывает время, начисляет инкремент и передаёт часы сопернику', () => {
      const clock = pressClock(startClock(createClock(CONFIG, T0), 'w', T0), T0 + 10_000)

      expect(clock.running).toBe('b')
      expect(remainingMs(clock, 'w', T0 + 10_000)).toBe(60_000 - 10_000 + 2000)
      expect(remainingMs(clock, 'b', T0 + 10_000)).toBe(60_000)
      expect(remainingMs(clock, 'b', T0 + 13_000)).toBe(57_000)
    })

    it('несколько ходов подряд', () => {
      let clock = startClock(createClock(CONFIG, T0), 'w', T0)
      clock = pressClock(clock, T0 + 3000) // белые: 60 − 3 + 2
      clock = pressClock(clock, T0 + 8000) // чёрные: 60 − 5 + 2
      clock = pressClock(clock, T0 + 9000) // белые: 59 − 1 + 2

      expect(clock.running).toBe('b')
      expect(remainingMs(clock, 'w', T0 + 9000)).toBe(60_000)
      expect(remainingMs(clock, 'b', T0 + 9000)).toBe(57_000)
    })

    it('без инкремента', () => {
      const clock = pressClock(
        startClock(createClock({ initialMs: 60_000, incrementMs: 0 }, T0), 'w', T0),
        T0 + 4000,
      )
      expect(remainingMs(clock, 'w', T0 + 4000)).toBe(56_000)
    })

    it('на остановленных часах ничего не меняет', () => {
      const clock = createClock(CONFIG, T0)
      expect(pressClock(clock, T0 + 5000)).toBe(clock)
    })

    it('если время уже вышло: без инкремента, часы стоят, флаг виден', () => {
      const clock = pressClock(startClock(createClock(CONFIG, T0), 'w', T0), T0 + 61_000)

      expect(clock.running).toBeNull()
      expect(remainingMs(clock, 'w', T0 + 61_000)).toBe(0)
      expect(flaggedColor(clock, T0 + 61_000)).toBe('w')
    })
  })

  describe('stopClock', () => {
    it('фиксирует остаток и останавливает часы', () => {
      const clock = stopClock(startClock(createClock(CONFIG, T0), 'b', T0), T0 + 7000)

      expect(clock.running).toBeNull()
      expect(remainingMs(clock, 'b', T0 + 99_000)).toBe(53_000)
    })

    it('остановленные часы можно запустить снова (пауза)', () => {
      let clock = stopClock(startClock(createClock(CONFIG, T0), 'w', T0), T0 + 7000)
      clock = startClock(clock, 'w', T0 + 20_000)

      expect(remainingMs(clock, 'w', T0 + 25_000)).toBe(48_000)
    })
  })

  describe('флаг', () => {
    it('не падает, пока есть время', () => {
      const clock = startClock(createClock(CONFIG, T0), 'w', T0)
      expect(flaggedColor(clock, T0 + 59_999)).toBeNull()
    })

    it('падает у идущей стороны ровно по истечении времени', () => {
      const clock = startClock(createClock(CONFIG, T0), 'b', T0)

      expect(flaggedColor(clock, T0 + 60_000)).toBe('b')
      expect(flaggedColor(clock, T0 + 120_000)).toBe('b')
      expect(remainingMs(clock, 'b', T0 + 120_000)).toBe(0)
    })

    it('падает у белых', () => {
      const clock = startClock(createClock(CONFIG, T0), 'w', T0)
      expect(flaggedColor(clock, T0 + 60_000)).toBe('w')
    })

    it('msUntilFlag — для одного точного таймера', () => {
      const clock = startClock(createClock(CONFIG, T0), 'w', T0)

      expect(msUntilFlag(clock, T0 + 10_000)).toBe(50_000)
      expect(msUntilFlag(clock, T0 + 70_000)).toBe(0)
      expect(msUntilFlag(createClock(CONFIG, T0), T0)).toBeNull()
    })
  })

  describe('синхронизация с хостом', () => {
    it('syncClock принимает авторитетный срез', () => {
      const local = startClock(createClock(CONFIG, T0), 'w', T0)
      const synced = syncClock(
        local,
        { remaining: { w: 30_000, b: 45_000 }, running: 'b' },
        T0 + 9000,
      )

      expect(synced.running).toBe('b')
      expect(remainingMs(synced, 'w', T0 + 9000)).toBe(30_000)
      expect(remainingMs(synced, 'b', T0 + 9000)).toBe(45_000)
      expect(remainingMs(synced, 'b', T0 + 14_000)).toBe(40_000)
    })

    it('syncClock не делит массив остатков со срезом', () => {
      const remaining = { w: 1000, b: 2000 }
      const synced = syncClock(createClock(CONFIG, T0), { remaining, running: null }, T0)
      remaining.w = 0

      expect(remainingMs(synced, 'w', T0)).toBe(1000)
    })

    it('snapshotClock даёт срез на момент now, который принимает syncClock', () => {
      const host = pressClock(startClock(createClock(CONFIG, T0), 'w', T0), T0 + 4000)
      const snapshot = snapshotClock(host, T0 + 6000)

      expect(snapshot).toEqual({ remaining: { w: 58_000, b: 58_000 }, running: 'b' })

      const client = syncClock(createClock(CONFIG, T0), snapshot, T0 + 6100)
      expect(remainingMs(client, 'b', T0 + 8100)).toBe(56_000)
    })
  })
})
