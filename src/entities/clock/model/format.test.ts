import { formatClock } from './format'

describe('formatClock', () => {
  it('минуты и секунды', () => {
    expect(formatClock(10 * 60_000)).toBe('10:00')
    expect(formatClock(3 * 60_000 + 5_000)).toBe('3:05')
    expect(formatClock(59_000)).toBe('0:59')
  })

  it('округляет вверх до секунды', () => {
    expect(formatClock(59_001)).toBe('1:00')
    expect(formatClock(10_400)).toBe('0:11')
  })

  it('от часа показывает часы', () => {
    expect(formatClock(3_600_000)).toBe('1:00:00')
    expect(formatClock(3_600_000 + 65_000)).toBe('1:01:05')
  })

  it('в последние 10 секунд — десятые', () => {
    expect(formatClock(9_999)).toBe('0:10.0')
    expect(formatClock(7_250)).toBe('0:07.3')
    expect(formatClock(100)).toBe('0:00.1')
  })

  it('ноль и отрицательные значения', () => {
    expect(formatClock(0)).toBe('0:00.0')
    expect(formatClock(-500)).toBe('0:00.0')
  })
})
