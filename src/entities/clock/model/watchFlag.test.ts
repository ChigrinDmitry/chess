import { createClockStore } from './store'
import { watchFlag } from './watchFlag'

const CONFIG = { initialMs: 5_000, incrementMs: 0 }

describe('watchFlag', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('роняет флаг у идущих часов ровно по истечении времени', () => {
    const store = createClockStore({ config: CONFIG })
    const onFlag = vi.fn()
    watchFlag(store, onFlag)

    store.getState().start('w')
    vi.advanceTimersByTime(4_999)
    expect(onFlag).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onFlag).toHaveBeenCalledExactlyOnceWith('w')
  })

  it('пока часы стоят, ничего не происходит', () => {
    const store = createClockStore({ config: CONFIG })
    const onFlag = vi.fn()
    watchFlag(store, onFlag)

    vi.advanceTimersByTime(60_000)
    expect(onFlag).not.toHaveBeenCalled()
  })

  it('ход перевзводит таймер на часы соперника', () => {
    const store = createClockStore({ config: CONFIG })
    const onFlag = vi.fn()
    watchFlag(store, onFlag)

    store.getState().start('w')
    vi.advanceTimersByTime(3_000)
    store.getState().press()
    // у чёрных полные 5 с, у белых осталось 2 с — но идут часы чёрных
    vi.advanceTimersByTime(4_999)
    expect(onFlag).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onFlag).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('остановка часов снимает таймер', () => {
    const store = createClockStore({ config: CONFIG })
    const onFlag = vi.fn()
    watchFlag(store, onFlag)

    store.getState().start('w')
    vi.advanceTimersByTime(2_000)
    store.getState().stop()
    vi.advanceTimersByTime(60_000)
    expect(onFlag).not.toHaveBeenCalled()
  })

  it('отписка снимает таймер и подписку', () => {
    const store = createClockStore({ config: CONFIG })
    const onFlag = vi.fn()
    const stop = watchFlag(store, onFlag)

    store.getState().start('w')
    stop()
    vi.advanceTimersByTime(60_000)
    expect(onFlag).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('уже запущенные часы подхватываются сразу', () => {
    const store = createClockStore({ config: CONFIG })
    store.getState().start('b')
    const onFlag = vi.fn()
    watchFlag(store, onFlag)

    vi.advanceTimersByTime(5_000)
    expect(onFlag).toHaveBeenCalledExactlyOnceWith('b')
  })
})
