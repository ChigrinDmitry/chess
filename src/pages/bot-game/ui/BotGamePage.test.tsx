import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import type { ChessEngine, EngineMove } from '@/entities/bot'
import { createGameStore } from '@/entities/game'
import { BotGamePage } from '../index'

const cell = (square: string) => screen.getByRole('gridcell', { name: new RegExp(`^${square},`) })

/** Клик без указателя (detail = 0) — так работает и скринридер, и не нужна геометрия. */
function move(from: string, to: string) {
  fireEvent.click(cell(from), { detail: 0 })
  fireEvent.click(cell(to), { detail: 0 })
}

const uci = (line: string): EngineMove => ({
  from: line.slice(0, 2) as EngineMove['from'],
  to: line.slice(2, 4) as EngineMove['to'],
})

/** Движок-двойник: отвечает заранее заготовленными ходами, по очереди. */
function scriptedEngines(...script: string[]) {
  const queue = [...script]
  const created: ChessEngine[] = []
  const createEngine = (): ChessEngine => {
    const engine: ChessEngine = {
      init: vi.fn(() => Promise.resolve()),
      setLevel: vi.fn(),
      bestMove: vi.fn((fen: string) => {
        // Как настоящий движок, в позиции без ходов (мат) отвечает «хода нет»
        if (createGameStore({ startFen: fen }).getState().legalMoves.length === 0) {
          return Promise.resolve(null)
        }
        const next = queue.shift()
        return Promise.resolve(next ? uci(next) : null)
      }),
      stop: vi.fn(),
      dispose: vi.fn(),
    }
    created.push(engine)
    return engine
  }
  return { createEngine, created }
}

const renderPage = (createEngine: () => ChessEngine, strict = false) => {
  const page = (
    <MemoryRouter>
      <BotGamePage createEngine={createEngine} />
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{page}</StrictMode> : page)
}

/** Время идёт вперёд: бот выдерживает «человеческую» паузу перед ходом. */
const botMoves = () => act(() => vi.advanceTimersByTimeAsync(2500))

/** Нажимает «Начать партию» и даёт движку загрузиться. */
const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Начать партию' }))
  await act(() => Promise.resolve())
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BotGamePage', () => {
  it('сначала настройки; «Начать партию» показывает доску и игроков', async () => {
    const { createEngine } = scriptedEngines()
    renderPage(createEngine)
    expect(screen.getByRole('heading', { name: 'Партия с ботом' })).toBeInTheDocument()
    expect(screen.getByText(/Игрок · ориентировочно 1150 Elo/)).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()

    await start()
    expect(screen.getByRole('grid', { name: 'Шахматная доска' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Вы, белые' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Бот Игрок, чёрные' })).toBeInTheDocument()
    await botMoves()
  })

  it('уровень и цвет из настроек попадают в партию', async () => {
    const { createEngine, created } = scriptedEngines('e2e4')
    renderPage(createEngine)
    fireEvent.click(screen.getByRole('radio', { name: '8' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Чёрные' }))
    expect(screen.getByText(/Эксперт · ориентировочно 2000 Elo/)).toBeInTheDocument()
    await start()

    expect(screen.getByRole('region', { name: 'Бот Эксперт, белые' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Вы, чёрные' })).toBeInTheDocument()
    expect(created[0]?.setLevel).toHaveBeenCalledWith(8)

    // Бот ходит первым: пока он думает, доска показывает индикатор
    expect(screen.getByText('Бот думает')).toBeInTheDocument()
    await botMoves()
    expect(cell('e4')).toHaveAccessibleName('e4, белая пешка')
    expect(screen.queryByText('Бот думает')).not.toBeInTheDocument()
    expect(screen.getByText('Ход чёрных')).toBeInTheDocument()
  })

  it('человек ходит, бот отвечает, отмена хода возвращает начальную позицию', async () => {
    const { createEngine } = scriptedEngines('e7e5')
    renderPage(createEngine)
    await start()
    const takeback = () => screen.getByRole('button', { name: 'Отменить ход' })
    expect(takeback()).toBeDisabled()

    move('e2', 'e4')
    expect(screen.getByText('Бот думает')).toBeInTheDocument()
    expect(screen.getByText('Ход чёрных')).toBeInTheDocument()
    await botMoves()
    expect(cell('e5')).toHaveAccessibleName('e5, чёрная пешка')
    expect(screen.getByText('Ход белых')).toBeInTheDocument()

    expect(takeback()).toBeEnabled()
    fireEvent.click(takeback())
    expect(screen.getByText('Ходов пока нет')).toBeInTheDocument()
    expect(cell('e2')).toHaveAccessibleName('e2, белая пешка')
    expect(cell('e5')).toHaveAccessibleName('e5, пусто')
    expect(takeback()).toBeDisabled()
  })

  it('ход человека во время раздумий бота можно отменить: расчёт бота отбрасывается', async () => {
    const { createEngine } = scriptedEngines('e7e5', 'c7c5')
    renderPage(createEngine)
    await start()
    move('e2', 'e4')
    fireEvent.click(screen.getByRole('button', { name: 'Отменить ход' }))
    await botMoves()
    // Бот не сходил в позиции, которой уже нет
    expect(cell('e5')).toHaveAccessibleName('e5, пусто')
    expect(screen.getByText('Ходов пока нет')).toBeInTheDocument()
  })

  it('мат: итог в модалке; «Новая партия» — реванш с обменом цветов', async () => {
    const { createEngine } = scriptedEngines('e7e5', 'b8c6', 'g8f6', 'e2e4')
    renderPage(createEngine)
    await start()
    move('e2', 'e4')
    await botMoves()
    move('f1', 'c4')
    await botMoves()
    move('d1', 'h5')
    await botMoves()
    move('h5', 'f7')

    const result = screen.getByRole('dialog', { name: 'Партия окончена' })
    expect(result).toHaveTextContent('Победили белые')
    fireEvent.click(within(result).getByRole('button', { name: 'Новая партия' }))
    await botMoves()

    // Бот теперь за белых и уже сходил
    expect(screen.getByRole('region', { name: 'Вы, чёрные' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^Бот .*, белые$/ })).toBeInTheDocument()
    expect(cell('e4')).toHaveAccessibleName('e4, белая пешка')
    expect(screen.getByText('Ход чёрных')).toBeInTheDocument()
  })

  it('«Настройки бота» возвращают к настройкам и останавливают движок', async () => {
    const { createEngine, created } = scriptedEngines()
    renderPage(createEngine)
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'Настройки бота' }))
    expect(screen.getByRole('heading', { name: 'Партия с ботом' })).toBeInTheDocument()
    expect(created[0]?.dispose).toHaveBeenCalled()

    // Новая партия — новый движок
    await start()
    expect(created).toHaveLength(2)
    await botMoves()
  })

  it('«Новая партия» посреди партии просит подтверждения и возвращает к настройкам', async () => {
    const { createEngine } = scriptedEngines('e7e5')
    renderPage(createEngine)
    await start()
    move('e2', 'e4')
    await botMoves()

    fireEvent.click(screen.getByRole('button', { name: 'Новая партия' }))
    fireEvent.click(screen.getByRole('button', { name: 'Начать заново' }))
    expect(screen.getByRole('heading', { name: 'Партия с ботом' })).toBeInTheDocument()
  })

  it('движок не запустился: сообщение и заблокированная доска', async () => {
    const createEngine = (): ChessEngine => ({
      init: () => Promise.reject(new Error('нет wasm')),
      setLevel: vi.fn(),
      bestMove: () => Promise.reject(new Error('нет wasm')),
      stop: vi.fn(),
      dispose: vi.fn(),
    })
    renderPage(createEngine)
    await start()
    await botMoves()
    expect(screen.getByText('Бот недоступен: не удалось запустить движок')).toBeInTheDocument()
    move('e2', 'e4')
    expect(cell('e4')).toHaveAccessibleName('e4, пусто')
  })

  it('работает в StrictMode (двойной запуск эффектов)', async () => {
    const { createEngine } = scriptedEngines('e7e5')
    renderPage(createEngine, true)
    await start()
    move('e2', 'e4')
    await botMoves()
    expect(cell('e5')).toHaveAccessibleName('e5, чёрная пешка')
  })
})
