import { remainingMs } from './clock'
import { createClockStore } from './store'
import { getTimeControl, TIME_CONTROLS } from './timeControls'

const CONFIG = { initialMs: 60_000, incrementMs: 1000 }

function setup() {
  let now = 5000
  const store = createClockStore({ config: CONFIG, now: () => now })
  return {
    store,
    advance: (ms: number) => {
      now += ms
    },
    at: () => now,
  }
}

describe('createClockStore', () => {
  it('стартует остановленным', () => {
    const { store } = setup()
    expect(store.getState().running).toBeNull()
    expect(store.getState().remaining).toEqual({ w: 60_000, b: 60_000 })
  })

  it('start → press → stop по заданным часам', () => {
    const { store, advance, at } = setup()

    store.getState().start('w')
    advance(4000)
    store.getState().press()
    expect(store.getState().running).toBe('b')
    expect(remainingMs(store.getState(), 'w', at())).toBe(57_000)

    advance(2000)
    store.getState().stop()
    expect(store.getState().running).toBeNull()
    expect(remainingMs(store.getState(), 'b', at() + 99_000)).toBe(58_000)
  })

  it('sync принимает срез хоста', () => {
    const { store, at } = setup()
    store.getState().sync({ remaining: { w: 10_000, b: 20_000 }, running: 'w' })

    expect(remainingMs(store.getState(), 'w', at())).toBe(10_000)
    expect(store.getState().running).toBe('w')
  })

  it('reset возвращает исходное время, можно с новым контролем', () => {
    const { store } = setup()
    store.getState().start('w')
    store.getState().reset()
    expect(store.getState().running).toBeNull()
    expect(store.getState().remaining.w).toBe(60_000)

    store.getState().reset({ initialMs: 5000, incrementMs: 0 })
    expect(store.getState().remaining).toEqual({ w: 5000, b: 5000 })
    expect(store.getState().config).toEqual({ initialMs: 5000, incrementMs: 0 })
  })

  it('по умолчанию берёт Date.now', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(10_000)
      const store = createClockStore({ config: CONFIG })
      store.getState().start('w')
      expect(store.getState().updatedAt).toBe(10_000)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('контроли времени', () => {
  it('соответствуют ТЗ', () => {
    expect(TIME_CONTROLS.map((tc) => tc.id)).toEqual(['3+2', '5+0', '10+0', '15+10', 'none'])
    expect(getTimeControl('3+2').config).toEqual({ initialMs: 180_000, incrementMs: 2000 })
    expect(getTimeControl('5+0').config).toEqual({ initialMs: 300_000, incrementMs: 0 })
    expect(getTimeControl('10+0').config).toEqual({ initialMs: 600_000, incrementMs: 0 })
    expect(getTimeControl('15+10').config).toEqual({ initialMs: 900_000, incrementMs: 10_000 })
  })

  it('«без часов» — конфиг null', () => {
    expect(getTimeControl('none').config).toBeNull()
  })

  it('неизвестный id — ошибка', () => {
    expect(() => getTimeControl('1+0' as never)).toThrow('Unknown time control')
  })
})
