import {
  selectCaptured,
  selectCheckedKingSquare,
  selectFenAt,
  selectIsGameOver,
  selectIsPromotion,
  selectLastMove,
  selectLegalMovesFrom,
  selectMaterialBalance,
  selectWinner,
} from './selectors'
import { START_FEN } from './fen'
import { gameFrom, play } from './test-helpers'

describe('селекторы', () => {
  it('selectLastMove', () => {
    const game = gameFrom()
    expect(selectLastMove(game.getState())).toBeUndefined()
    play(game, 'e2e4')
    expect(selectLastMove(game.getState())).toMatchObject({ from: 'e2', to: 'e4' })
  })

  it('selectLegalMovesFrom', () => {
    const state = gameFrom().getState()
    expect(
      selectLegalMovesFrom(state, 'e2')
        .map((m) => m.to)
        .sort(),
    ).toEqual(['e3', 'e4'])
    expect(selectLegalMovesFrom(state, 'e7')).toEqual([])
    expect(selectLegalMovesFrom(state, 'e4')).toEqual([])
  })

  it('selectIsPromotion', () => {
    const state = gameFrom('8/P6k/8/8/8/8/8/K7 w - - 0 1').getState()
    expect(selectIsPromotion(state, 'a7', 'a8')).toBe(true)
    expect(selectIsPromotion(state, 'a1', 'a2')).toBe(false)
    expect(selectIsPromotion(gameFrom().getState(), 'e2', 'e4')).toBe(false)
  })

  describe('selectCheckedKingSquare', () => {
    it('нет шаха', () => {
      expect(selectCheckedKingSquare(gameFrom().getState())).toBeNull()
    })

    it('шах — клетка короля стороны на ходу', () => {
      const game = gameFrom()
      play(game, 'e2e4 f7f5 d1h5')
      expect(selectCheckedKingSquare(game.getState())).toBe('e8')
    })

    it('мат', () => {
      const game = gameFrom()
      play(game, 'f2f3 e7e5 g2g4 d8h4')
      expect(selectCheckedKingSquare(game.getState())).toBe('e1')
    })
  })

  it('selectIsGameOver и selectWinner', () => {
    const game = gameFrom()
    expect(selectIsGameOver(game.getState())).toBe(false)
    expect(selectWinner(game.getState())).toBeNull()

    game.getState().resign('b')
    expect(selectIsGameOver(game.getState())).toBe(true)
    expect(selectWinner(game.getState())).toBe('w')

    const black = gameFrom()
    play(black, 'f2f3 e7e5 g2g4 d8h4')
    expect(selectWinner(black.getState())).toBe('b')

    const draw = gameFrom()
    draw.getState().agreeDraw()
    expect(selectIsGameOver(draw.getState())).toBe(true)
    expect(selectWinner(draw.getState())).toBeNull()
  })

  describe('взятые фигуры и перевес', () => {
    it('без взятий', () => {
      const state = gameFrom().getState()
      expect(selectCaptured(state)).toEqual({ w: [], b: [] })
      expect(selectMaterialBalance(state)).toBe(0)
    })

    it('фиксирует, кто что взял, и считает перевес', () => {
      const game = gameFrom()
      play(game, 'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5')

      expect(selectCaptured(game.getState())).toEqual({ w: ['p'], b: ['p'] })
      expect(selectMaterialBalance(game.getState())).toBe(0)

      play(game, 'a2a3 a5c3 d2c3')
      expect(selectCaptured(game.getState())).toEqual({ w: ['p', 'q'], b: ['p', 'n'] })
      // белые: -пешка(e), -конь; чёрные: -пешка(d), -ферзь → у белых +9 −3 −1 +1
      expect(selectMaterialBalance(game.getState())).toBe(6)
    })

    it('превращение увеличивает перевес', () => {
      const game = gameFrom('8/P6k/8/8/8/8/8/K7 w - - 0 1')
      expect(selectMaterialBalance(game.getState())).toBe(1)
      play(game, 'a7a8q')
      expect(selectMaterialBalance(game.getState())).toBe(9)
    })

    it('перевес чёрных отрицателен', () => {
      const game = gameFrom('8/8/8/4k3/8/8/3rK3/8 b - - 0 1')
      expect(selectMaterialBalance(game.getState())).toBe(-5)
    })
  })

  it('selectFenAt', () => {
    const game = gameFrom()
    play(game, 'e2e4 e7e5')
    const state = game.getState()

    expect(selectFenAt(state, 0)).toBe(START_FEN)
    expect(selectFenAt(state, 1)).toBe(state.moves[0]?.fen)
    expect(selectFenAt(state, 2)).toBe(state.fen)
    expect(selectFenAt(state, 3)).toBeUndefined()
  })
})
