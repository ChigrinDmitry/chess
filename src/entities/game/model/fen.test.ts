import { countMaterial, piecesFromFen, START_FEN } from './fen'
import { canDeliverMate } from './insufficient'

describe('piecesFromFen', () => {
  it('раскладывает начальную позицию', () => {
    const pieces = piecesFromFen(START_FEN)

    expect(pieces).toHaveLength(32)
    expect(pieces).toContainEqual({ color: 'b', type: 'r', square: 'a8' })
    expect(pieces).toContainEqual({ color: 'w', type: 'k', square: 'e1' })
    expect(pieces).toContainEqual({ color: 'w', type: 'p', square: 'h2' })
    expect(pieces).toContainEqual({ color: 'b', type: 'q', square: 'd8' })
  })

  it('пустые клетки и ряды', () => {
    expect(piecesFromFen('8/8/8/4k3/8/8/4K3/R7 w - - 0 1')).toEqual([
      { color: 'b', type: 'k', square: 'e5' },
      { color: 'w', type: 'k', square: 'e2' },
      { color: 'w', type: 'r', square: 'a1' },
    ])
  })

  it('пустая строка — нет фигур', () => {
    expect(piecesFromFen('')).toEqual([])
  })
})

describe('countMaterial', () => {
  it('король не считается', () => {
    const pieces = piecesFromFen(START_FEN)
    expect(countMaterial(pieces, 'w')).toBe(39)
    expect(countMaterial(pieces, 'b')).toBe(39)
  })
})

describe('canDeliverMate', () => {
  const mate = (fen: string, color: 'w' | 'b') => canDeliverMate(piecesFromFen(fen), color)

  it('один король — нет', () => {
    expect(mate('8/8/8/4k3/8/8/4K3/8 w', 'w')).toBe(false)
  })

  it.each([
    ['пешка', '8/8/8/4k3/8/8/3PK3/8 w'],
    ['ладья', '8/8/8/4k3/8/8/3RK3/8 w'],
    ['ферзь', '8/8/8/4k3/8/8/3QK3/8 w'],
    ['два коня', '8/8/8/4k3/8/8/2NNK3/8 w'],
    ['слон и конь', '8/8/8/4k3/8/8/2NBK3/8 w'],
  ])('%s — да', (_name, fen) => {
    expect(mate(fen, 'w')).toBe(true)
  })

  it('один конь или слон против голого короля — нет', () => {
    expect(mate('8/8/8/4k3/8/8/3NK3/8 w', 'w')).toBe(false)
    expect(mate('8/8/8/4k3/8/8/3BK3/8 w', 'w')).toBe(false)
  })

  it('один конь против короля с материалом — кооперативный мат возможен', () => {
    expect(mate('8/8/8/4k3/8/p7/3NK3/8 w', 'w')).toBe(true)
  })
})
