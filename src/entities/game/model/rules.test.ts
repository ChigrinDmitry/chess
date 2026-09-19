import { START_FEN } from './fen'
import { gameFrom, play } from './test-helpers'

describe('рокировка', () => {
  const FEN = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'

  it('короткая: король на g1, ладья на f1', () => {
    const game = gameFrom(FEN)
    const outcome = game.getState().move({ from: 'e1', to: 'g1' })

    expect(outcome).toMatchObject({ ok: true, move: { san: 'O-O', castle: 'k' } })
    const { pieces } = game.getState()
    expect(pieces).toContainEqual({ color: 'w', type: 'k', square: 'g1' })
    expect(pieces).toContainEqual({ color: 'w', type: 'r', square: 'f1' })
  })

  it('длинная: король на c1, ладья на d1', () => {
    const game = gameFrom(FEN)
    const outcome = game.getState().move({ from: 'e1', to: 'c1' })

    expect(outcome).toMatchObject({ ok: true, move: { san: 'O-O-O', castle: 'q' } })
    const { pieces } = game.getState()
    expect(pieces).toContainEqual({ color: 'w', type: 'k', square: 'c1' })
    expect(pieces).toContainEqual({ color: 'w', type: 'r', square: 'd1' })
  })

  it('чёрные тоже рокируются', () => {
    const game = gameFrom(FEN.replace(' w ', ' b '))
    expect(game.getState().move({ from: 'e8', to: 'g8' })).toMatchObject({
      ok: true,
      move: { san: 'O-O', castle: 'k' },
    })
  })

  it('нельзя через атакованное поле', () => {
    // ладья f2 бьёт f1: короткая рокировка запрещена, длинная разрешена
    const game = gameFrom('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1')
    expect(game.getState().move({ from: 'e1', to: 'g1' })).toEqual({ ok: false, error: 'illegal' })
    expect(game.getState().move({ from: 'e1', to: 'c1' }).ok).toBe(true)
  })

  it('нельзя из-под шаха', () => {
    const game = gameFrom('4r2k/8/8/8/8/8/8/R3K2R w KQ - 0 1')
    expect(game.getState().inCheck).toBe(true)
    expect(game.getState().move({ from: 'e1', to: 'g1' }).ok).toBe(false)
    expect(game.getState().move({ from: 'e1', to: 'c1' }).ok).toBe(false)
  })

  it('право теряется после хода королём', () => {
    const game = gameFrom(FEN)
    play(game, 'e1e2 e8e7 e2e1 e7e8')
    expect(game.getState().move({ from: 'e1', to: 'g1' }).ok).toBe(false)
    expect(game.getState().move({ from: 'e1', to: 'c1' }).ok).toBe(false)
  })

  it('право на одну сторону теряется после хода ладьёй', () => {
    const game = gameFrom(FEN)
    play(game, 'h1h2 e8e7 h2h1 e7e8')
    expect(game.getState().move({ from: 'e1', to: 'g1' }).ok).toBe(false)
    expect(game.getState().move({ from: 'e1', to: 'c1' }).ok).toBe(true)
  })
})

describe('взятие на проходе', () => {
  it('бьёт пешку, прошедшую два поля, и убирает её с доски', () => {
    const game = gameFrom()
    play(game, 'e2e4 a7a6 e4e5 d7d5')
    const outcome = game.getState().move({ from: 'e5', to: 'd6' })

    expect(outcome).toMatchObject({
      ok: true,
      move: { san: 'exd6', enPassant: true, captured: 'p' },
    })
    const { pieces } = game.getState()
    expect(pieces).toContainEqual({ color: 'w', type: 'p', square: 'd6' })
    expect(pieces.find((p) => p.square === 'd5')).toBeUndefined()
  })

  it('доступно только сразу же', () => {
    const game = gameFrom()
    play(game, 'e2e4 a7a6 e4e5 d7d5 g1f3 g8f6')
    expect(game.getState().move({ from: 'e5', to: 'd6' })).toEqual({ ok: false, error: 'illegal' })
  })

  it('отмечено в списке легальных ходов', () => {
    const game = gameFrom()
    play(game, 'e2e4 a7a6 e4e5 d7d5')
    expect(game.getState().legalMoves).toContainEqual(
      expect.objectContaining({ from: 'e5', to: 'd6', enPassant: true }),
    )
  })
})

describe('превращение пешки', () => {
  const FEN = '8/P6k/8/8/8/8/8/K7 w - - 0 1'

  it('без выбора фигуры ход нелегален', () => {
    const game = gameFrom(FEN)
    expect(game.getState().move({ from: 'a7', to: 'a8' })).toEqual({ ok: false, error: 'illegal' })
  })

  it.each([
    ['q', 'a8=Q'],
    ['r', 'a8=R'],
    ['b', 'a8=B'],
    ['n', 'a8=N'],
  ] as const)('в %s: %s', (promotion, san) => {
    const game = gameFrom(FEN)
    const outcome = game.getState().move({ from: 'a7', to: 'a8', promotion })

    expect(outcome).toMatchObject({ ok: true, move: { san, promotion } })
    expect(game.getState().pieces).toContainEqual({ color: 'w', type: promotion, square: 'a8' })
    expect(game.getState().pieces.filter((p) => p.type === 'p')).toHaveLength(0)
  })

  it('со взятием', () => {
    const game = gameFrom('1n5k/P7/8/8/8/8/8/K7 w - - 0 1')
    expect(game.getState().move({ from: 'a7', to: 'b8', promotion: 'q' })).toMatchObject({
      ok: true,
      move: { captured: 'n', promotion: 'q' },
    })
  })
})

describe('окончание партии по правилам', () => {
  it('мат: детский мат чёрными', () => {
    const game = gameFrom()
    play(game, 'f2f3 e7e5 g2g4 d8h4')

    expect(game.getState().result).toEqual({ result: '0-1', reason: 'checkmate' })
    expect(game.getState().legalMoves).toEqual([])
    expect(game.getState().inCheck).toBe(true)
  })

  it('мат белыми', () => {
    const game = gameFrom()
    play(game, 'e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7')
    expect(game.getState().result).toEqual({ result: '1-0', reason: 'checkmate' })
  })

  it('пат', () => {
    const game = gameFrom('k7/8/2K5/8/8/8/8/1Q6 w - - 0 1')
    expect(game.getState().result).toBeNull()
    play(game, 'b1b6')

    expect(game.getState().inCheck).toBe(false)
    expect(game.getState().result).toEqual({ result: '1/2-1/2', reason: 'stalemate' })
  })

  it('троекратное повторение', () => {
    const game = gameFrom()
    play(game, 'g1f3 g8f6 f3g1 f6g8')
    expect(game.getState().result).toBeNull()
    play(game, 'g1f3 g8f6 f3g1 f6g8')

    expect(game.getState().result).toEqual({ result: '1/2-1/2', reason: 'threefold-repetition' })
  })

  it('правило 50 ходов', () => {
    const game = gameFrom('8/8/8/4k3/8/8/4K3/R7 w - - 98 80')
    play(game, 'a1a2')
    expect(game.getState().result).toBeNull()
    play(game, 'e5d5')

    expect(game.getState().result).toEqual({ result: '1/2-1/2', reason: 'fifty-moves' })
  })

  it('взятие пешки или ход пешкой обнуляет счётчик 50 ходов', () => {
    const game = gameFrom('8/8/8/4k3/8/8/P3K3/R7 w - - 99 80')
    play(game, 'a2a3')
    expect(game.getState().result).toBeNull()
  })

  it('мат важнее 50 ходов', () => {
    const game = gameFrom('7k/8/6K1/8/8/8/8/R7 w - - 99 80')
    play(game, 'a1a8')
    expect(game.getState().result).toEqual({ result: '1-0', reason: 'checkmate' })
  })

  describe('недостаточный материал', () => {
    it.each([
      ['король против короля', '8/8/8/4k3/8/8/4K3/8 w - - 0 1'],
      ['король и слон против короля', '8/8/8/4k3/8/8/3BK3/8 w - - 0 1'],
      ['король и конь против короля', '8/8/8/4k3/8/8/3NK3/8 w - - 0 1'],
      ['слоны одного цвета', '8/8/4k3/4b3/8/2B5/4K3/8 w - - 0 1'],
    ])('%s', (_name, fen) => {
      expect(gameFrom(fen).getState().result).toEqual({
        result: '1/2-1/2',
        reason: 'insufficient-material',
      })
    })

    it.each([
      ['слоны разных цветов', '8/8/4k3/3b4/8/2B5/4K3/8 w - - 0 1'],
      ['король и ладья против короля', '8/8/8/4k3/8/8/3RK3/8 w - - 0 1'],
      ['король и пешка против короля', '8/8/8/4k3/8/8/3PK3/8 w - - 0 1'],
      ['слон против коня', '8/8/4k3/4n3/8/2B5/4K3/8 w - - 0 1'],
    ])('%s — партия продолжается', (_name, fen) => {
      expect(gameFrom(fen).getState().result).toBeNull()
    })

    it('возникает после взятия последней фигуры', () => {
      const game = gameFrom('8/8/8/4k3/8/8/3rK3/8 w - - 0 1')
      play(game, 'e2d2')
      expect(game.getState().result).toEqual({ result: '1/2-1/2', reason: 'insufficient-material' })
    })
  })

  it('начальная позиция — партия идёт', () => {
    const game = gameFrom(START_FEN)
    expect(game.getState().result).toBeNull()
    expect(game.getState().legalMoves).toHaveLength(20)
  })
})
