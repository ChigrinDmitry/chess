import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalGamePage } from '../index'

const cell = (square: string) => screen.getByRole('gridcell', { name: new RegExp(`^${square},`) })

/** Клик без указателя (detail = 0) — так работает и скринридер, и не нужна геометрия. */
function move(from: string, to: string) {
  fireEvent.click(cell(from), { detail: 0 })
  fireEvent.click(cell(to), { detail: 0 })
}

describe('LocalGamePage', () => {
  it('показывает доску и чей ход', () => {
    render(<LocalGamePage />)
    expect(screen.getByRole('grid', { name: 'Шахматная доска' })).toBeInTheDocument()
    expect(screen.getByText('Ход белых')).toBeInTheDocument()
  })

  it('играет ходы за обе стороны по очереди', () => {
    render(<LocalGamePage />)
    move('e2', 'e4')
    expect(screen.getByText('Ход чёрных')).toBeInTheDocument()
    move('e7', 'e5')
    expect(screen.getByText('Ход белых')).toBeInTheDocument()
    expect(cell('e5')).toHaveAccessibleName('e5, чёрная пешка')
  })

  it('детский мат: итог, доска блокируется, «Новая партия» начинает заново', async () => {
    render(<LocalGamePage />)
    move('e2', 'e4')
    move('e7', 'e5')
    move('f1', 'c4')
    move('b8', 'c6')
    move('d1', 'h5')
    move('g8', 'f6')
    move('h5', 'f7')

    expect(screen.getByText('Победили белые — мат')).toBeInTheDocument()

    fireEvent.click(cell('a2'), { detail: 0 })
    expect(cell('a2')).toHaveAttribute('aria-selected', 'false')

    await userEvent.click(screen.getByRole('button', { name: 'Новая партия' }))
    expect(screen.getByText('Ход белых')).toBeInTheDocument()
    expect(cell('e2')).toHaveAccessibleName('e2, белая пешка')
  })

  it('«Перевернуть доску» меняет ориентацию', async () => {
    render(<LocalGamePage />)
    expect(screen.getAllByRole('row')[0]?.firstElementChild).toHaveAttribute('data-square', 'a8')
    await userEvent.click(screen.getByRole('button', { name: /Перевернуть/ }))
    expect(screen.getAllByRole('row')[0]?.firstElementChild).toHaveAttribute('data-square', 'h1')
  })

  it('превращение через диалог', async () => {
    render(<LocalGamePage />)
    // Быстрая линия до превращения: h-пешка идёт на g8 со взятием
    for (const [f, t] of [
      ['h2', 'h4'],
      ['g7', 'g5'],
      ['h4', 'g5'],
      ['h7', 'h6'],
      ['g5', 'h6'],
      ['f8', 'g7'],
      ['h6', 'g7'],
      ['a7', 'a6'],
    ] as const) {
      move(f, t)
    }
    move('g7', 'h8')
    await userEvent.click(screen.getByRole('button', { name: 'белый ферзь' }))
    expect(cell('h8')).toHaveAccessibleName('h8, белый ферзь')
  })
})
