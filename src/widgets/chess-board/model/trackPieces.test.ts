import { createGameStore, START_FEN, piecesFromFen } from '@/entities/game'
import type { GameStoreApi, PlacedPiece } from '@/entities/game'
import { EMPTY_TRACKING, trackPieces } from './trackPieces'
import type { Tracking } from './trackPieces'

const at = (t: Tracking, square: string) => t.pieces.find((p) => p.square === square)

function playAndTrack(store: GameStoreApi, start: Tracking, moves: [string, string, string?][]) {
  let t = start
  for (const [from, to, promotion] of moves) {
    store.getState().move({ from, to, ...(promotion ? { promotion } : {}) } as never)
    t = trackPieces(t, store.getState().pieces)
  }
  return t
}

describe('trackPieces', () => {
  const start = trackPieces(EMPTY_TRACKING, piecesFromFen(START_FEN))

  it('нумерует все 32 фигуры уникальными id', () => {
    expect(start.pieces).toHaveLength(32)
    expect(new Set(start.pieces.map((p) => p.id)).size).toBe(32)
    expect(start.nextId).toBe(32)
  })

  it('результат упорядочен по id', () => {
    const ids = start.pieces.map((p) => p.id)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
  })

  it('обычный ход сохраняет id фигуры', () => {
    const id = at(start, 'e2')?.id
    const t = playAndTrack(createGameStore(), start, [['e2', 'e4']])
    expect(at(t, 'e4')?.id).toBe(id)
    expect(at(t, 'e2')).toBeUndefined()
    expect(t.nextId).toBe(32)
  })

  it('неизменённые фигуры сохраняют id', () => {
    const t = playAndTrack(createGameStore(), start, [['e2', 'e4']])
    expect(at(t, 'a1')?.id).toBe(at(start, 'a1')?.id)
  })

  it('взятие: id взявшей фигуры сохраняется, побитая исчезает', () => {
    const store = createGameStore()
    const t = playAndTrack(store, start, [
      ['e2', 'e4'],
      ['d7', 'd5'],
      ['e4', 'd5'],
    ])
    expect(at(t, 'd5')?.id).toBe(at(start, 'e2')?.id)
    expect(t.pieces).toHaveLength(31)
  })

  it('рокировка: король и ладья сохраняют id', () => {
    const store = createGameStore({ startFen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' })
    const first = trackPieces(EMPTY_TRACKING, store.getState().pieces)
    const t = playAndTrack(store, first, [['e1', 'g1']])
    expect(at(t, 'g1')?.id).toBe(at(first, 'e1')?.id)
    expect(at(t, 'f1')?.id).toBe(at(first, 'h1')?.id)
  })

  it('взятие на проходе убирает побитую пешку и не трогает остальные', () => {
    const store = createGameStore()
    const t = playAndTrack(store, start, [
      ['e2', 'e4'],
      ['a7', 'a6'],
      ['e4', 'e5'],
      ['d7', 'd5'],
      ['e5', 'd6'],
    ])
    expect(at(t, 'd6')?.id).toBe(at(start, 'e2')?.id)
    expect(at(t, 'd5')).toBeUndefined()
    expect(t.pieces).toHaveLength(31)
  })

  it('превращение: пешка заменяется новой фигурой с новым id', () => {
    const store = createGameStore({ startFen: '8/P6k/8/8/8/8/8/K7 w - - 0 1' })
    const first = trackPieces(EMPTY_TRACKING, store.getState().pieces)
    const t = playAndTrack(store, first, [['a7', 'a8', 'q']])
    const queen = at(t, 'a8')
    expect(queen?.type).toBe('q')
    expect(queen?.id).toBe(first.nextId)
    expect(t.pieces.some((p) => p.id === at(first, 'a7')?.id)).toBe(false)
  })

  it('из двух одинаковых фигур едет ближайшая', () => {
    const a: PlacedPiece[] = [
      { color: 'w', type: 'n', square: 'b1' },
      { color: 'w', type: 'n', square: 'g1' },
    ]
    const first = trackPieces(EMPTY_TRACKING, a)
    const t = trackPieces(first, [
      { color: 'w', type: 'n', square: 'b1' },
      { color: 'w', type: 'n', square: 'f3' },
    ])
    expect(at(t, 'f3')?.id).toBe(at(first, 'g1')?.id)
    expect(at(t, 'b1')?.id).toBe(at(first, 'b1')?.id)
  })

  it('откат хода возвращает прежние id', () => {
    const store = createGameStore()
    const moved = playAndTrack(store, start, [['g1', 'f3']])
    store.getState().undo()
    const back = trackPieces(moved, store.getState().pieces)
    expect(at(back, 'g1')?.id).toBe(at(start, 'g1')?.id)
  })
})
