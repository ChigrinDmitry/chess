import { fromView, isLightSquare, toView } from './geometry'

describe('geometry', () => {
  it('белые внизу: a1 — левый нижний угол, h8 — правый верхний', () => {
    expect(toView('a1', 'w')).toEqual({ col: 0, row: 7 })
    expect(toView('h8', 'w')).toEqual({ col: 7, row: 0 })
  })

  it('чёрные внизу: доска повёрнута на 180°', () => {
    expect(toView('a1', 'b')).toEqual({ col: 7, row: 0 })
    expect(toView('h8', 'b')).toEqual({ col: 0, row: 7 })
  })

  it('fromView обратна toView для всех клеток в обеих ориентациях', () => {
    for (const orientation of ['w', 'b'] as const) {
      for (const f of 'abcdefgh') {
        for (const r of '12345678') {
          const sq = `${f}${r}` as never
          const { col, row } = toView(sq, orientation)
          expect(fromView(col, row, orientation)).toBe(sq)
        }
      }
    }
  })

  it('fromView: вне доски и нецелые — null', () => {
    expect(fromView(-1, 0, 'w')).toBeNull()
    expect(fromView(0, 8, 'w')).toBeNull()
    expect(fromView(1.5, 0, 'w')).toBeNull()
  })

  it('a1 тёмная, h1 светлая, a8 светлая', () => {
    expect(isLightSquare('a1')).toBe(false)
    expect(isLightSquare('h1')).toBe(true)
    expect(isLightSquare('a8')).toBe(true)
    expect(isLightSquare('e5')).toBe(false)
    expect(isLightSquare('e4')).toBe(true)
  })
})
