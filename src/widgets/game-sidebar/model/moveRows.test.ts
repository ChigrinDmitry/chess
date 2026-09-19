import { createGameStore } from '@/entities/game'
import { toMoveRows } from './moveRows'

function movesOf(startFen?: string, ...uci: string[]) {
  const game = createGameStore(startFen ? { startFen } : {})
  for (const m of uci) {
    game.getState().move({ from: m.slice(0, 2) as never, to: m.slice(2, 4) as never })
  }
  return game.getState().moves
}

describe('toMoveRows', () => {
  it('пусто без ходов', () => {
    expect(toMoveRows([])).toEqual([])
  })

  it('парует полуходы в строки и нумерует полуходы', () => {
    const rows = toMoveRows(movesOf(undefined, 'e2e4', 'e7e5', 'g1f3'))
    expect(rows).toEqual([
      { number: 1, white: { san: 'e4', ply: 1 }, black: { san: 'e5', ply: 2 } },
      { number: 2, white: { san: 'Nf3', ply: 3 }, black: undefined },
    ])
  })

  it('партия с хода чёрных начинается со строки без белого хода', () => {
    const rows = toMoveRows(
      movesOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1', 'e7e5', 'e2e4'),
    )
    expect(rows).toEqual([
      { number: 1, white: undefined, black: { san: 'e5', ply: 1 } },
      { number: 2, white: { san: 'e4', ply: 2 }, black: undefined },
    ])
  })
})
