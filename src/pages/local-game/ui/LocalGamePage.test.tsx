import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { LocalGamePage } from '../index'

const cell = (square: string) => screen.getByRole('gridcell', { name: new RegExp(`^${square},`) })

/** Клик без указателя (detail = 0) — так работает и скринридер, и не нужна геометрия. */
function move(from: string, to: string) {
  fireEvent.click(cell(from), { detail: 0 })
  fireEvent.click(cell(to), { detail: 0 })
}

function moves(...pairs: (readonly [string, string])[]) {
  for (const [from, to] of pairs) move(from, to)
}

/** Детский мат: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# */
const FOOLS_MATE = [
  ['e2', 'e4'],
  ['e7', 'e5'],
  ['f1', 'c4'],
  ['b8', 'c6'],
  ['d1', 'h5'],
  ['g8', 'f6'],
  ['h5', 'f7'],
] as const

const renderPage = () =>
  render(
    <MemoryRouter>
      <LocalGamePage />
    </MemoryRouter>,
  )

const dialog = (name: string) => screen.getByRole('dialog', { name })

describe('LocalGamePage', () => {
  it('показывает доску, шапку, панели игроков и чей ход', () => {
    renderPage()
    expect(screen.getByRole('grid', { name: 'Шахматная доска' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Chess Online/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Белые, белые' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Чёрные, чёрные' })).toBeInTheDocument()
    expect(screen.getByText('Ход белых')).toBeInTheDocument()
  })

  it('играет ходы за обе стороны по очереди и пишет их в список', () => {
    renderPage()
    move('e2', 'e4')
    expect(screen.getByText('Ход чёрных')).toBeInTheDocument()
    move('e7', 'e5')
    expect(screen.getByText('Ход белых')).toBeInTheDocument()
    expect(cell('e5')).toHaveAccessibleName('e5, чёрная пешка')

    const list = screen.getByRole('list', { name: 'Ходы партии' })
    expect(within(list).getByRole('button', { name: 'e4' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'e5' })).toHaveAttribute('aria-current', 'step')
  })

  it('детский мат: итог в модалке, доска блокируется, «Новая партия» начинает заново', async () => {
    renderPage()
    moves(...FOOLS_MATE)

    expect(screen.getByText('Победили белые — мат')).toBeInTheDocument()
    const result = dialog('Партия окончена')
    expect(result).toHaveTextContent('Победили белые')

    fireEvent.click(cell('a2'), { detail: 0 })
    expect(cell('a2')).toHaveAttribute('aria-selected', 'false')

    await userEvent.click(within(result).getByRole('button', { name: 'Новая партия' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Ход белых')).toBeInTheDocument()
    expect(cell('e2')).toHaveAccessibleName('e2, белая пешка')
    expect(screen.getByText('Ходов пока нет')).toBeInTheDocument()
  })

  it('«Рассмотреть партию» закрывает итог, а ходы остаются доступны для просмотра', async () => {
    renderPage()
    moves(...FOOLS_MATE)
    await userEvent.click(screen.getByRole('button', { name: 'Рассмотреть партию' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'e4' }))
    expect(cell('e4')).toHaveAccessibleName('e4, белая пешка')
    expect(cell('f7')).toHaveAccessibleName('f7, чёрная пешка')
  })

  it('«Перевернуть доску» меняет ориентацию', async () => {
    renderPage()
    expect(screen.getAllByRole('row')[0]?.firstElementChild).toHaveAttribute('data-square', 'a8')
    await userEvent.click(screen.getByRole('button', { name: /Перевернуть/ }))
    expect(screen.getAllByRole('row')[0]?.firstElementChild).toHaveAttribute('data-square', 'h1')
  })

  it('превращение через диалог', async () => {
    renderPage()
    // Быстрая линия до превращения: h-пешка идёт на g8 со взятием
    moves(
      ['h2', 'h4'],
      ['g7', 'g5'],
      ['h4', 'g5'],
      ['h7', 'h6'],
      ['g5', 'h6'],
      ['f8', 'g7'],
      ['h6', 'g7'],
      ['a7', 'a6'],
    )
    move('g7', 'h8')
    await userEvent.click(screen.getByRole('button', { name: 'белый ферзь' }))
    expect(cell('h8')).toHaveAccessibleName('h8, белый ферзь')
  })

  it('переживает двойной запуск эффектов StrictMode', () => {
    render(
      <StrictMode>
        <MemoryRouter>
          <LocalGamePage />
        </MemoryRouter>
      </StrictMode>,
    )
    move('e2', 'e4')
    move('e7', 'e5')
    expect(cell('e5')).toHaveAccessibleName('e5, чёрная пешка')
    expect(screen.getByText('Ход белых')).toBeInTheDocument()
  })

  describe('история', () => {
    it('клик по ходу показывает прошлую позицию и блокирует доску до возврата', async () => {
      renderPage()
      moves(['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'])

      await userEvent.click(screen.getByRole('button', { name: 'e4' }))
      expect(cell('e4')).toHaveAccessibleName('e4, белая пешка')
      expect(cell('e5')).toHaveAccessibleName('e5, пусто')
      expect(cell('g1')).toHaveAccessibleName('g1, белый конь')

      // В прошлой позиции ходить нельзя
      fireEvent.click(cell('a2'), { detail: 0 })
      expect(cell('a2')).toHaveAttribute('aria-selected', 'false')

      await userEvent.click(screen.getByRole('button', { name: 'К текущей позиции' }))
      expect(cell('f3')).toHaveAccessibleName('f3, белый конь')
      // Ход чёрных: их фигура выбирается, белая — нет
      fireEvent.click(cell('a7'), { detail: 0 })
      expect(cell('a7')).toHaveAttribute('aria-selected', 'true')
    })

    it('стрелки листают историю', () => {
      renderPage()
      moves(['e2', 'e4'], ['e7', 'e5'])

      fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
      expect(cell('e5')).toHaveAccessibleName('e5, пусто')
      fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
      expect(cell('e4')).toHaveAccessibleName('e4, пусто')
      expect(cell('e2')).toHaveAccessibleName('e2, белая пешка')
      fireEvent.keyDown(document.body, { key: 'End' })
      expect(cell('e5')).toHaveAccessibleName('e5, чёрная пешка')
    })

    it('новая партия возвращает просмотр к текущей позиции', async () => {
      renderPage()
      moves(['e2', 'e4'], ['e7', 'e5'])
      await userEvent.click(screen.getByRole('button', { name: 'e4' }))

      await userEvent.click(screen.getByRole('button', { name: 'Новая партия' }))
      await userEvent.click(screen.getByRole('button', { name: 'Начать заново' }))
      moves(['d2', 'd4'])
      expect(cell('d4')).toHaveAccessibleName('d4, белая пешка')
    })
  })

  describe('сдача', () => {
    it('сдаётся сторона, чей ход', async () => {
      renderPage()
      move('e2', 'e4')
      await userEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
      expect(dialog('Сдаться?')).toHaveTextContent('Чёрные сдают партию')
      await userEvent.click(within(dialog('Сдаться?')).getByRole('button', { name: 'Сдаться' }))

      expect(screen.getByText('Победили белые — сдача')).toBeInTheDocument()
      expect(dialog('Партия окончена')).toBeInTheDocument()
    })
  })

  describe('ничья по соглашению', () => {
    it('принятое предложение заканчивает партию вничью', async () => {
      renderPage()
      moves(['e2', 'e4'], ['e7', 'e5'])
      await userEvent.click(screen.getByRole('button', { name: 'Предложить ничью' }))
      expect(dialog('Предложение ничьей')).toHaveTextContent('Белые предлагают ничью')
      await userEvent.click(screen.getByRole('button', { name: 'Принять ничью' }))

      expect(screen.getByText('Ничья — по соглашению')).toBeInTheDocument()
    })

    it('отклонённое предложение — партия продолжается', async () => {
      renderPage()
      move('e2', 'e4')
      await userEvent.click(screen.getByRole('button', { name: 'Предложить ничью' }))
      await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Ход чёрных')).toBeInTheDocument()
    })
  })

  describe('часы', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(0)
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const clockOf = (color: 'белых' | 'чёрных') =>
      screen.getByRole('timer', { name: `Часы ${color}` })
    const advance = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms)
      })
    const pickTimeControl = (label: string) =>
      fireEvent.click(screen.getByRole('radio', { name: label }))

    it('по умолчанию 10+0; часы стоят до первого хода белых', () => {
      renderPage()
      expect(clockOf('белых')).toHaveTextContent('10:00')
      expect(clockOf('чёрных')).toHaveTextContent('10:00')
      advance(30_000)
      expect(clockOf('белых')).toHaveTextContent('10:00')
    })

    it('после хода белых идут часы чёрных, затем белых', () => {
      renderPage()
      move('e2', 'e4')
      advance(5_000)
      expect(clockOf('чёрных')).toHaveTextContent('9:55')
      expect(clockOf('белых')).toHaveTextContent('10:00')

      move('e7', 'e5')
      advance(3_000)
      expect(clockOf('белых')).toHaveTextContent('9:57')
      expect(clockOf('чёрных')).toHaveTextContent('9:55')
    })

    it('инкремент начисляется ходившему (3+2)', () => {
      renderPage()
      pickTimeControl('3+2')
      expect(clockOf('белых')).toHaveTextContent('3:00')
      move('e2', 'e4')
      advance(10_000)
      move('e7', 'e5')
      advance(4_000)
      move('g1', 'f3')
      // у чёрных: 3:00 − 10 с + 2 с
      expect(clockOf('чёрных')).toHaveTextContent('2:52')
    })

    it('флаг: время вышло — победа соперника', () => {
      renderPage()
      pickTimeControl('3+2')
      moves(['e2', 'e4'], ['e7', 'e5'])
      advance(3 * 60_000 + 2_000)

      expect(screen.getByText('Победили чёрные — время вышло')).toBeInTheDocument()
      expect(dialog('Партия окончена')).toHaveTextContent('Победили чёрные')
      expect(clockOf('белых')).toHaveTextContent('0:00.0')
    })

    it('после окончания партии часы останавливаются', () => {
      renderPage()
      move('e2', 'e4')
      advance(5_000)
      fireEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
      fireEvent.click(within(dialog('Сдаться?')).getByRole('button', { name: 'Сдаться' }))
      advance(60_000)
      expect(clockOf('чёрных')).toHaveTextContent('9:55')
    })

    it('«Без часов» скрывает циферблаты', () => {
      renderPage()
      pickTimeControl('Без часов')
      expect(screen.queryByRole('timer')).not.toBeInTheDocument()
      moves(['e2', 'e4'], ['e7', 'e5'])
      advance(60 * 60_000)
      expect(screen.getByText('Ход белых')).toBeInTheDocument()
    })

    it('контроль времени меняется только до первого хода', () => {
      renderPage()
      expect(screen.getByRole('radiogroup', { name: 'Контроль времени' })).toBeInTheDocument()
      move('e2', 'e4')
      expect(screen.queryByRole('radiogroup', { name: 'Контроль времени' })).not.toBeInTheDocument()
    })

    it('новая партия сбрасывает часы на выбранный контроль', () => {
      renderPage()
      pickTimeControl('5+0')
      move('e2', 'e4')
      advance(20_000)
      fireEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
      fireEvent.click(within(dialog('Сдаться?')).getByRole('button', { name: 'Сдаться' }))
      fireEvent.click(
        within(dialog('Партия окончена')).getByRole('button', { name: 'Новая партия' }),
      )

      expect(clockOf('белых')).toHaveTextContent('5:00')
      expect(clockOf('чёрных')).toHaveTextContent('5:00')
      expect(screen.getByText('Ход белых')).toBeInTheDocument()
    })
  })
})
