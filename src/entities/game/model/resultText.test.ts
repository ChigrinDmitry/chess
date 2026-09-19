import { describeOutcome, describeReason, describeStatus } from './resultText'

describe('тексты результата', () => {
  it('итог по коду результата', () => {
    expect(describeOutcome({ result: '1-0', reason: 'checkmate' })).toBe('Победили белые')
    expect(describeOutcome({ result: '0-1', reason: 'resignation' })).toBe('Победили чёрные')
    expect(describeOutcome({ result: '1/2-1/2', reason: 'stalemate' })).toBe('Ничья')
  })

  it('причина', () => {
    expect(describeReason('checkmate')).toBe('мат')
    expect(describeReason('threefold-repetition')).toBe('троекратное повторение')
  })

  it('статус: очередь, шах и итог', () => {
    expect(describeStatus({ turn: 'w', inCheck: false, result: null })).toBe('Ход белых')
    expect(describeStatus({ turn: 'b', inCheck: true, result: null })).toBe('Ход чёрных, шах')
    expect(
      describeStatus({ turn: 'b', inCheck: true, result: { result: '1-0', reason: 'checkmate' } }),
    ).toBe('Победили белые — мат')
  })
})
