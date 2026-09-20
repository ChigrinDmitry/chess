import { canTakeBack } from './takeback'

describe('canTakeBack', () => {
  it('ход игрока: нужны его ход и ответ бота', () => {
    expect(canTakeBack(0, 'w', 'w')).toBe(false)
    expect(canTakeBack(1, 'w', 'w')).toBe(false)
    expect(canTakeBack(2, 'w', 'w')).toBe(true)
    // Чёрными первый ход сделал бот: своего хода ещё нет
    expect(canTakeBack(1, 'b', 'b')).toBe(false)
    expect(canTakeBack(3, 'b', 'b')).toBe(true)
  })

  it('пока бот думает, достаточно одного своего хода', () => {
    expect(canTakeBack(0, 'b', 'w')).toBe(false)
    expect(canTakeBack(1, 'b', 'w')).toBe(true)
    expect(canTakeBack(2, 'w', 'b')).toBe(true)
  })
})
