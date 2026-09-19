import { act, render, screen } from '@testing-library/react'
import { createClockStore } from '../model/store'
import { ClockFace } from './ClockFace'

describe('ClockFace', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('показывает остаток и имя стороны', () => {
    const store = createClockStore({ config: { initialMs: 600_000, incrementMs: 0 } })
    render(<ClockFace store={store} color="b" />)

    const timer = screen.getByRole('timer', { name: 'Часы чёрных' })
    expect(timer).toHaveTextContent('10:00')
    expect(timer).toHaveAttribute('data-running', 'false')
  })

  it('тикает, пока часы идут, и останавливается вместе с ними', () => {
    const store = createClockStore({ config: { initialMs: 600_000, incrementMs: 0 } })
    render(<ClockFace store={store} color="w" />)

    act(() => store.getState().start('w'))
    expect(screen.getByRole('timer')).toHaveAttribute('data-running', 'true')

    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('9:55')

    act(() => store.getState().stop())
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('9:55')
    expect(screen.getByRole('timer')).toHaveAttribute('data-running', 'false')
  })

  it('часы соперника не тикают', () => {
    const store = createClockStore({ config: { initialMs: 600_000, incrementMs: 0 } })
    render(<ClockFace store={store} color="b" />)

    act(() => store.getState().start('w'))
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent('10:00')
  })

  it('при нехватке времени помечается классом low', () => {
    const store = createClockStore({ config: { initialMs: 15_000, incrementMs: 0 } })
    render(<ClockFace store={store} color="w" />)
    expect(screen.getByRole('timer')).toHaveClass('low')
  })
})
