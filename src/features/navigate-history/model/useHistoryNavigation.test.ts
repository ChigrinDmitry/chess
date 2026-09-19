import { act, renderHook } from '@testing-library/react'
import { useHistoryNavigation } from './useHistoryNavigation'

describe('useHistoryNavigation', () => {
  it('по умолчанию следит за текущей позицией и следует за новыми ходами', () => {
    const { result, rerender } = renderHook(({ total }) => useHistoryNavigation(total), {
      initialProps: { total: 3 },
    })
    expect(result.current).toMatchObject({ ply: 3, isLive: true })

    rerender({ total: 4 })
    expect(result.current).toMatchObject({ ply: 4, isLive: true })
  })

  it('уходит в прошлое и не двигается вместе с новыми ходами', () => {
    const { result, rerender } = renderHook(({ total }) => useHistoryNavigation(total), {
      initialProps: { total: 5 },
    })
    act(() => result.current.prev())
    expect(result.current).toMatchObject({ ply: 4, isLive: false })

    rerender({ total: 6 })
    expect(result.current).toMatchObject({ ply: 4, isLive: false })
  })

  it('first, next, prev, goTo зажимаются в границы', () => {
    const { result } = renderHook(() => useHistoryNavigation(4))

    act(() => result.current.first())
    expect(result.current.ply).toBe(0)
    act(() => result.current.prev())
    expect(result.current.ply).toBe(0)
    act(() => result.current.next())
    expect(result.current.ply).toBe(1)
    act(() => result.current.goTo(99))
    expect(result.current).toMatchObject({ ply: 4, isLive: true })
    act(() => result.current.goTo(-5))
    expect(result.current.ply).toBe(0)
  })

  it('дойдя до последнего хода, возвращается в «сейчас»', () => {
    const { result, rerender } = renderHook(({ total }) => useHistoryNavigation(total), {
      initialProps: { total: 2 },
    })
    act(() => result.current.first())
    act(() => result.current.goTo(2))
    expect(result.current.isLive).toBe(true)

    rerender({ total: 3 })
    expect(result.current.ply).toBe(3)
  })

  it('goLive возвращает к текущей позиции', () => {
    const { result } = renderHook(() => useHistoryNavigation(6))
    act(() => result.current.goTo(2))
    act(() => result.current.goLive())
    expect(result.current).toMatchObject({ ply: 6, isLive: true })
  })

  it('если ходов стало меньше (новая партия), ply не превышает total', () => {
    const { result, rerender } = renderHook(({ total }) => useHistoryNavigation(total), {
      initialProps: { total: 6 },
    })
    act(() => result.current.goTo(5))
    rerender({ total: 0 })
    expect(result.current).toMatchObject({ ply: 0, isLive: true })
  })
})
