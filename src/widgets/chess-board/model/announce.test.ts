import { createGameStore } from '@/entities/game'
import type { MoveRecord } from '@/entities/game'
import { cellLabel, describeMove } from './announce'

function last(fen: string | undefined, from: string, to: string, promotion?: 'q'): MoveRecord {
  const store = createGameStore(fen ? { startFen: fen } : {})
  const out = store.getState().move({ from, to, ...(promotion ? { promotion } : {}) } as never)
  if (!out.ok) throw new Error('illegal')
  return out.move
}

describe('describeMove', () => {
  it('тихий ход', () => {
    expect(describeMove(last(undefined, 'g1', 'f3'))).toBe('Белый конь g1 — f3')
  })

  it('взятие', () => {
    expect(describeMove(last('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'e4', 'd5'))).toBe(
      'Белая пешка e4 берёт пешку, d5',
    )
  })

  it('взятие на проходе', () => {
    expect(describeMove(last('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5', 'd6'))).toBe(
      'Белая пешка e5 берёт на проходе, d6',
    )
  })

  it('рокировки', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'
    expect(describeMove(last(fen, 'e1', 'g1'))).toBe('Белые: короткая рокировка')
    expect(describeMove(last(fen, 'e1', 'c1'))).toBe('Белые: длинная рокировка')
  })

  it('превращение с шахом', () => {
    expect(describeMove(last('7k/P7/8/8/8/8/8/K7 w - - 0 1', 'a7', 'a8', 'q'))).toBe(
      'Белая пешка a7 — a8, превращение: ферзь, шах',
    )
  })

  it('мат', () => {
    expect(describeMove(last('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1', 'a8'))).toBe(
      'Белая ладья a1 — a8, мат',
    )
  })
})

describe('cellLabel', () => {
  it('пустая, занятая, выбранная и целевые клетки', () => {
    expect(cellLabel({ square: 'e4', piece: undefined, selected: false, target: undefined })).toBe(
      'e4, пусто',
    )
    expect(
      cellLabel({
        square: 'e2',
        piece: { color: 'w', type: 'p' },
        selected: true,
        target: undefined,
      }),
    ).toBe('e2, белая пешка, выбрана')
    expect(cellLabel({ square: 'e4', piece: undefined, selected: false, target: 'move' })).toBe(
      'e4, пусто, возможный ход',
    )
    expect(
      cellLabel({
        square: 'd5',
        piece: { color: 'b', type: 'p' },
        selected: false,
        target: 'capture',
      }),
    ).toBe('d5, чёрная пешка, возможное взятие')
  })
})
