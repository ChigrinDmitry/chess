import { parseBestMove } from './uci'

describe('parseBestMove', () => {
  it('обычный ход и ход с превращением', () => {
    expect(parseBestMove('bestmove e2e4')).toEqual({ from: 'e2', to: 'e4' })
    expect(parseBestMove('bestmove e7e8n')).toEqual({ from: 'e7', to: 'e8', promotion: 'n' })
  })

  it('игнорирует ponder', () => {
    expect(parseBestMove('bestmove g1f3 ponder g8f6')).toEqual({ from: 'g1', to: 'f3' })
  })

  it('нет хода или не тот формат — null', () => {
    expect(parseBestMove('bestmove (none)')).toBeNull()
    expect(parseBestMove('bestmove 0000')).toBeNull()
    expect(parseBestMove('info depth 5')).toBeNull()
    expect(parseBestMove('')).toBeNull()
  })
})
