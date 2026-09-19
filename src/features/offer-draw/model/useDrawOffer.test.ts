import { act, renderHook } from '@testing-library/react'
import { useDrawOffer } from './useDrawOffer'

describe('useDrawOffer', () => {
  it('изначально предложения нет', () => {
    const { result } = renderHook(() => useDrawOffer(0))
    expect(result.current.offeredBy).toBeNull()
  })

  it('запоминает, кто предложил', () => {
    const { result } = renderHook(() => useDrawOffer(4))
    act(() => result.current.offer('b'))
    expect(result.current.offeredBy).toBe('b')
  })

  it('следующий ход снимает предложение', () => {
    const { result, rerender } = renderHook(({ ply }) => useDrawOffer(ply), {
      initialProps: { ply: 4 },
    })
    act(() => result.current.offer('w'))
    rerender({ ply: 5 })
    expect(result.current.offeredBy).toBeNull()
  })

  it('откат к тому же числу ходов не воскрешает старое предложение после clear', () => {
    const { result } = renderHook(() => useDrawOffer(2))
    act(() => result.current.offer('w'))
    act(() => result.current.clear())
    expect(result.current.offeredBy).toBeNull()
  })
})
