import { colorOf, emptySeats, freeColor, isFull, playersOf, seat } from './seats'
import type { PlayerIdentity } from './types'

const identity = (id: string): PlayerIdentity => ({
  kind: 'guest',
  id,
  displayName: `Игрок ${id}`,
  avatar: { hue: 10, initials: 'И' },
})

describe('места в партии', () => {
  it('изначально свободны', () => {
    const seats = emptySeats()
    expect(seats).toEqual({ w: null, b: null })
    expect(isFull(seats)).toBe(false)
    expect(playersOf(seats)).toEqual([])
  })

  it('seat занимает цвет и не мутирует исходные места', () => {
    const empty = emptySeats()
    const seated = seat(empty, 'w', identity('a'))

    expect(seated?.w?.id).toBe('a')
    expect(empty.w).toBeNull()
  })

  it('чужой цвет занять нельзя', () => {
    const seats = seat(emptySeats(), 'w', identity('a'))!
    expect(seat(seats, 'w', identity('b'))).toBeNull()
  })

  it('тот же игрок может сесть повторно (переподключение)', () => {
    const seats = seat(emptySeats(), 'w', identity('a'))!
    expect(seat(seats, 'w', identity('a'))?.w?.id).toBe('a')
  })

  describe('freeColor', () => {
    it('предпочитаемый, если свободен', () => {
      expect(freeColor(emptySeats())).toBe('w')
      expect(freeColor(emptySeats(), 'b')).toBe('b')
    })

    it('другой, если предпочитаемый занят', () => {
      const seats = seat(emptySeats(), 'w', identity('a'))!
      expect(freeColor(seats, 'w')).toBe('b')
    })

    it('null, если заняты оба', () => {
      let seats = seat(emptySeats(), 'w', identity('a'))!
      seats = seat(seats, 'b', identity('b'))!
      expect(freeColor(seats)).toBeNull()
      expect(isFull(seats)).toBe(true)
    })
  })

  it('colorOf и playersOf', () => {
    let seats = seat(emptySeats(), 'b', identity('a'))!
    expect(colorOf(seats, 'a')).toBe('b')
    expect(colorOf(seats, 'zzz')).toBeNull()

    seats = seat(seats, 'w', identity('b'))!
    expect(colorOf(seats, 'b')).toBe('w')
    expect(playersOf(seats).map((p) => [p.color, p.identity.id])).toEqual([
      ['w', 'b'],
      ['b', 'a'],
    ])
  })
})
