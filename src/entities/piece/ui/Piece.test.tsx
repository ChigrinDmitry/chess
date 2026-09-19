import { render } from '@testing-library/react'
import type { Color, PieceType } from '@/entities/game/@x/piece'
import { pieceName } from '../model/names'
import { PIECE_SHAPES } from '../model/shapes'
import { Piece } from './Piece'
import { PieceDefs } from './PieceDefs'

const TYPES: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k']

describe('Piece', () => {
  it.each(TYPES.flatMap((t) => (['w', 'b'] as Color[]).map((c) => [c, t] as const)))(
    'рисует фигуру %s%s в сетке 100×100',
    (color, type) => {
      const { container } = render(<Piece color={color} type={type} />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('viewBox', '0 0 100 100')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg?.querySelectorAll('path').length).toBeGreaterThanOrEqual(
        PIECE_SHAPES[type].fills.length * 3,
      )
    },
  )

  it('заливка ссылается на градиент своего цвета', () => {
    const { container } = render(<Piece color="b" type="q" />)
    expect(container.querySelector('[fill="url(#piece-grad-b)"]')).not.toBeNull()
  })

  it('у коня есть глаз', () => {
    const { container } = render(<Piece color="w" type="n" />)
    expect(container.querySelector('circle')).not.toBeNull()
  })

  it('PieceDefs определяет все три градиента', () => {
    const { container } = render(<PieceDefs />)
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(ids).toEqual(['piece-grad-w', 'piece-grad-b', 'piece-sheen'])
  })
})

describe('pieceName', () => {
  it('склоняет по роду', () => {
    expect(pieceName('w', 'p')).toBe('белая пешка')
    expect(pieceName('b', 'n')).toBe('чёрный конь')
    expect(pieceName('w', 'r')).toBe('белая ладья')
    expect(pieceName('b', 'q')).toBe('чёрный ферзь')
  })
})
