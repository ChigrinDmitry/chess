import { createChessJsRules } from './rules'
import { createGameStore } from './store'
import { START_FEN } from './fen'
import { gameFrom, play } from './test-helpers'

describe('createGameStore', () => {
  it('начальное состояние', () => {
    const state = gameFrom().getState()

    expect(state).toMatchObject({
      startFen: START_FEN,
      fen: START_FEN,
      turn: 'w',
      moves: [],
      inCheck: false,
      result: null,
    })
    expect(state.pieces).toHaveLength(32)
  })

  it('принимает подмену фабрики правил', () => {
    const rulesFactory = vi.fn(createChessJsRules)
    const store = createGameStore({ rulesFactory })
    store.getState().move({ from: 'e2', to: 'e4' })
    store.getState().reset()

    expect(rulesFactory).toHaveBeenCalledTimes(2)
  })

  describe('move', () => {
    it('записывает ход и передаёт очередь', () => {
      const game = gameFrom()
      const outcome = game.getState().move({ from: 'e2', to: 'e4' })

      expect(outcome).toMatchObject({
        ok: true,
        move: { color: 'w', from: 'e2', to: 'e4', piece: 'p', san: 'e4', enPassant: false },
      })
      expect(game.getState().turn).toBe('b')
      expect(game.getState().moves.map((m) => m.san)).toEqual(['e4'])
      expect(game.getState().fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
    })

    it('отклоняет нелегальный ход и не меняет состояние', () => {
      const game = gameFrom()
      const before = game.getState()

      expect(game.getState().move({ from: 'e2', to: 'e5' })).toEqual({
        ok: false,
        error: 'illegal',
      })
      expect(game.getState().move({ from: 'e7', to: 'e5' })).toEqual({
        ok: false,
        error: 'illegal',
      })
      expect(game.getState().fen).toBe(before.fen)
      expect(game.getState().moves).toHaveLength(0)
    })

    it('отклоняет ход, оставляющий короля под шахом', () => {
      const game = gameFrom('4r2k/8/8/8/8/8/4B3/4K3 w - - 0 1')
      expect(game.getState().move({ from: 'e2', to: 'd3' }).ok).toBe(false)
    })

    it('после конца партии ходы не принимаются', () => {
      const game = gameFrom()
      game.getState().resign('w')

      expect(game.getState().move({ from: 'e2', to: 'e4' })).toEqual({
        ok: false,
        error: 'game-over',
      })
    })

    it('фиксирует взятие', () => {
      const game = gameFrom()
      play(game, 'e2e4 d7d5')

      expect(game.getState().move({ from: 'e4', to: 'd5' })).toMatchObject({
        ok: true,
        move: { captured: 'p', san: 'exd5' },
      })
    })
  })

  describe('завершение вне позиции', () => {
    it('сдача: побеждает соперник', () => {
      const game = gameFrom()
      expect(game.getState().resign('w')).toBe(true)
      expect(game.getState().result).toEqual({ result: '0-1', reason: 'resignation' })
      expect(game.getState().legalMoves).toEqual([])
    })

    it('сдача чёрных', () => {
      const game = gameFrom()
      game.getState().resign('b')
      expect(game.getState().result).toEqual({ result: '1-0', reason: 'resignation' })
    })

    it('ничья по соглашению', () => {
      const game = gameFrom()
      expect(game.getState().agreeDraw()).toBe(true)
      expect(game.getState().result).toEqual({ result: '1/2-1/2', reason: 'agreement' })
    })

    it('падение флага: побеждает соперник', () => {
      const white = gameFrom()
      white.getState().flag('b')
      expect(white.getState().result).toEqual({ result: '1-0', reason: 'timeout' })

      const black = gameFrom()
      black.getState().flag('w')
      expect(black.getState().result).toEqual({ result: '0-1', reason: 'timeout' })
    })

    it('падение флага, когда у соперника нет материала для мата, — ничья', () => {
      // у белых упал флаг, у чёрных один король
      const game = gameFrom('8/8/8/4k3/8/8/4K3/R7 w - - 0 1')
      game.getState().flag('w')
      expect(game.getState().result).toEqual({
        result: '1/2-1/2',
        reason: 'timeout-vs-insufficient-material',
      })
    })

    it('первый исход окончателен', () => {
      const game = gameFrom()
      game.getState().resign('w')

      expect(game.getState().resign('b')).toBe(false)
      expect(game.getState().flag('b')).toBe(false)
      expect(game.getState().agreeDraw()).toBe(false)
      expect(game.getState().result).toEqual({ result: '0-1', reason: 'resignation' })
    })

    it('сдача после мата ничего не меняет', () => {
      const game = gameFrom()
      play(game, 'f2f3 e7e5 g2g4 d8h4')

      expect(game.getState().resign('b')).toBe(false)
      expect(game.getState().result?.reason).toBe('checkmate')
    })
  })

  describe('undo (takeback)', () => {
    it('откатывает последний полуход', () => {
      const game = gameFrom()
      play(game, 'e2e4 e7e5')

      expect(game.getState().undo()).toBe(true)
      expect(game.getState().moves.map((m) => m.san)).toEqual(['e4'])
      expect(game.getState().turn).toBe('b')
    })

    it('откатывает несколько полуходов (свой и ответ бота)', () => {
      const game = gameFrom()
      play(game, 'e2e4 e7e5')

      expect(game.getState().undo(2)).toBe(true)
      expect(game.getState().fen).toBe(START_FEN)
      expect(game.getState().legalMoves).toHaveLength(20)
    })

    it('после отката можно пойти иначе', () => {
      const game = gameFrom()
      play(game, 'e2e4')
      game.getState().undo()
      play(game, 'd2d4')

      expect(game.getState().moves.map((m) => m.san)).toEqual(['d4'])
    })

    it('не откатывает больше, чем сыграно, и ноль ходов', () => {
      const game = gameFrom()
      play(game, 'e2e4')

      expect(game.getState().undo(2)).toBe(false)
      expect(game.getState().undo(0)).toBe(false)
      expect(game.getState().moves).toHaveLength(1)
    })

    it('не работает после окончания партии', () => {
      const game = gameFrom()
      play(game, 'f2f3 e7e5 g2g4 d8h4')

      expect(game.getState().undo()).toBe(false)
      expect(game.getState().result?.reason).toBe('checkmate')
    })

    it('учитывает историю позиций при повторении', () => {
      const game = gameFrom()
      play(game, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1')
      game.getState().undo()
      play(game, 'f3g1')
      expect(game.getState().result).toBeNull()
      play(game, 'f6g8')
      expect(game.getState().result?.reason).toBe('threefold-repetition')
    })
  })

  describe('load (resync)', () => {
    it('восстанавливает партию из списка SAN', () => {
      const source = gameFrom()
      play(source, 'e2e4 e7e5 g1f3 b8c6')
      const target = gameFrom()

      const ok = target.getState().load({ moves: source.getState().moves.map((m) => m.san) })

      expect(ok).toBe(true)
      expect(target.getState().fen).toBe(source.getState().fen)
      expect(target.getState().moves).toEqual(source.getState().moves)
    })

    it('с нестандартной начальной позиции', () => {
      const game = gameFrom()
      const ok = game.getState().load({ startFen: '8/P6k/8/8/8/8/8/K7 w - - 0 1', moves: ['a8=Q'] })

      expect(ok).toBe(true)
      expect(game.getState().startFen).toBe('8/P6k/8/8/8/8/8/K7 w - - 0 1')
      expect(game.getState().pieces).toContainEqual({ color: 'w', type: 'q', square: 'a8' })
    })

    it('определяет исход по позиции', () => {
      const game = gameFrom()
      game.getState().load({ moves: ['f3', 'e5', 'g4', 'Qh4#'] })
      expect(game.getState().result).toEqual({ result: '0-1', reason: 'checkmate' })
    })

    it('принимает исход, определённый хостом', () => {
      const game = gameFrom()
      const result = { result: '1-0', reason: 'resignation' } as const
      game.getState().load({ moves: ['e4', 'e5'], result })

      expect(game.getState().result).toEqual(result)
      expect(game.getState().legalMoves).toEqual([])
    })

    it('явный null снимает исход', () => {
      const game = gameFrom()
      game.getState().resign('w')
      game.getState().load({ moves: ['e4'], result: null })

      expect(game.getState().result).toBeNull()
      expect(game.getState().legalMoves.length).toBeGreaterThan(0)
    })

    it('нелегальный список не меняет состояние', () => {
      const game = gameFrom()
      play(game, 'e2e4')
      const before = game.getState()

      expect(game.getState().load({ moves: ['e4', 'e4'] })).toBe(false)
      expect(game.getState().fen).toBe(before.fen)
      expect(game.getState().moves).toEqual(before.moves)
    })

    it('некорректный FEN не меняет состояние', () => {
      const game = gameFrom()
      expect(game.getState().load({ startFen: 'not a fen', moves: [] })).toBe(false)
      expect(game.getState().fen).toBe(START_FEN)
    })
  })

  describe('reset', () => {
    it('начинает заново', () => {
      const game = gameFrom()
      play(game, 'e2e4')
      game.getState().resign('b')
      game.getState().reset()

      expect(game.getState().fen).toBe(START_FEN)
      expect(game.getState().moves).toEqual([])
      expect(game.getState().result).toBeNull()
    })

    it('с другой позиции', () => {
      const game = gameFrom()
      game.getState().reset('8/8/8/4k3/8/8/4K3/R7 w - - 0 1')
      expect(game.getState().pieces).toHaveLength(3)
    })
  })

  describe('pgn', () => {
    it('содержит ходы и незавершённый результат', () => {
      const game = gameFrom()
      play(game, 'e2e4 e7e5')
      const pgn = game.getState().pgn()

      expect(pgn).toContain('1. e4 e5')
      expect(pgn).toContain('[Result "*"]')
    })

    it('подставляет результат партии и заголовки', () => {
      const game = gameFrom()
      play(game, 'f2f3 e7e5 g2g4 d8h4')
      const pgn = game.getState().pgn({ White: 'Аня', Black: 'Боря' })

      expect(pgn).toContain('[White "Аня"]')
      expect(pgn).toContain('[Black "Боря"]')
      expect(pgn).toContain('[Result "0-1"]')
      expect(pgn).toContain('2. g4 Qh4# 0-1')
    })

    it('результат сдачи', () => {
      const game = gameFrom()
      play(game, 'e2e4')
      game.getState().resign('b')
      expect(game.getState().pgn()).toContain('[Result "1-0"]')
    })

    it('не портит текущую партию', () => {
      const game = gameFrom()
      play(game, 'e2e4')
      const fen = game.getState().fen
      game.getState().pgn({ White: 'x' })
      play(game, 'e7e5')

      expect(game.getState().fen).not.toBe(fen)
      expect(game.getState().moves).toHaveLength(2)
    })

    it('для нестандартной позиции содержит FEN', () => {
      const game = gameFrom('8/P6k/8/8/8/8/8/K7 w - - 0 1')
      expect(game.getState().pgn()).toContain('[FEN "8/P6k/8/8/8/8/8/K7 w - - 0 1"]')
    })
  })
})
