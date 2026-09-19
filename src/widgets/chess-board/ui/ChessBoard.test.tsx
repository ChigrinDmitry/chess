import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useStore } from 'zustand'
import { createGameStore, selectCheckedKingSquare, selectLastMove } from '@/entities/game'
import type { Color, GameStoreApi, MoveInput } from '@/entities/game'
import { ChessBoard } from './ChessBoard'

const CELL = 100

function Harness({
  game,
  orientation = 'w',
  movableColors = ['w', 'b'],
  onMove,
}: {
  game: GameStoreApi
  orientation?: Color
  movableColors?: readonly Color[]
  onMove?: (m: MoveInput) => void
}) {
  const s = useStore(game)
  return (
    <ChessBoard
      pieces={s.pieces}
      turn={s.turn}
      legalMoves={s.legalMoves}
      lastMove={selectLastMove(s)}
      checkedSquare={selectCheckedKingSquare(s)}
      orientation={orientation}
      movableColors={movableColors}
      onMove={(m) => {
        onMove?.(m)
        s.move(m)
      }}
    />
  )
}

/** Размеры в jsdom нулевые — подставляем доску 800×800 в точке (0, 0). */
function mockBoardRect() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const size = this.getAttribute('role') === 'grid' ? CELL * 8 : 0
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: size,
      height: size,
      right: size,
      bottom: size,
    } as DOMRect
  })
}

/** Центр клетки при ориентации белых внизу. */
function center(square: string) {
  const col = 'abcdefgh'.indexOf(square[0] as string)
  const row = 8 - Number(square[1])
  return { clientX: col * CELL + CELL / 2, clientY: row * CELL + CELL / 2 }
}

const pointer = { pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0 }

function drag(from: string, to: string) {
  const grid = screen.getByRole('grid')
  fireEvent.pointerDown(grid, { ...pointer, ...center(from) })
  fireEvent.pointerMove(window, { ...pointer, ...center(from), clientX: center(from).clientX + 30 })
  fireEvent.pointerMove(window, { ...pointer, ...center(to) })
  fireEvent.pointerUp(window, { ...pointer, ...center(to) })
}

function tap(square: string) {
  const grid = screen.getByRole('grid')
  fireEvent.pointerDown(grid, { ...pointer, ...center(square) })
  fireEvent.pointerUp(window, { ...pointer, ...center(square) })
}

const cell = (square: string) => screen.getByRole('gridcell', { name: new RegExp(`^${square},`) })

beforeEach(mockBoardRect)
afterEach(() => vi.restoreAllMocks())

describe('ChessBoard: разметка', () => {
  it('64 клетки в 8 рядах с подписями и 32 фигуры', () => {
    const { container } = render(<Harness game={createGameStore()} />)
    expect(screen.getByRole('grid', { name: 'Шахматная доска' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(8)
    expect(screen.getAllByRole('gridcell')).toHaveLength(64)
    expect(cell('e2')).toHaveAccessibleName('e2, белая пешка')
    expect(cell('e4')).toHaveAccessibleName('e4, пусто')
    expect(container.querySelectorAll('svg[viewBox="0 0 100 100"]')).toHaveLength(32)
  })

  it('белые внизу: первый ряд начинается с a8; чёрные внизу — с h1', () => {
    const { rerender } = render(<Harness game={createGameStore()} />)
    expect(within(screen.getAllByRole('row')[0]!).getAllByRole('gridcell')[0]).toHaveAttribute(
      'data-square',
      'a8',
    )
    rerender(<Harness game={createGameStore()} orientation="b" />)
    expect(within(screen.getAllByRole('row')[0]!).getAllByRole('gridcell')[0]).toHaveAttribute(
      'data-square',
      'h1',
    )
  })

  it('координаты: буквы на нижнем ряду, цифры на левой колонке', () => {
    render(<Harness game={createGameStore()} />)
    expect(cell('a1')).toHaveTextContent('1a')
    expect(cell('h1')).toHaveTextContent('h')
    expect(cell('a5')).toHaveTextContent('5')
    expect(cell('e4')).toHaveTextContent('')
  })

  it('только один tabbable-элемент (roving tabindex)', () => {
    render(<Harness game={createGameStore()} />)
    expect(screen.getAllByRole('gridcell').filter((c) => c.tabIndex === 0)).toHaveLength(1)
  })
})

describe('ChessBoard: клик-клик', () => {
  it('выбор фигуры показывает возможные ходы, второй клик делает ход', async () => {
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} onMove={onMove} />)

    tap('e2')
    expect(cell('e2')).toHaveAttribute('aria-selected', 'true')
    expect(cell('e4')).toHaveAccessibleName('e4, пусто, возможный ход')
    expect(cell('e5')).toHaveAccessibleName('e5, пусто')

    tap('e4')
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
    expect(cell('e4')).toHaveAccessibleName('e4, белая пешка')
    expect(cell('e2')).toHaveAttribute('aria-selected', 'false')
  })

  it('взятие помечается отдельно', () => {
    const game = createGameStore()
    render(<Harness game={game} />)
    tap('e2')
    tap('e4')
    tap('d7')
    tap('d5')
    tap('e4')
    expect(cell('d5')).toHaveAccessibleName('d5, чёрная пешка, возможное взятие')
  })

  it('повторный клик по выбранной фигуре снимает выбор', () => {
    render(<Harness game={createGameStore()} />)
    tap('g1')
    tap('g1')
    expect(cell('g1')).toHaveAttribute('aria-selected', 'false')
  })

  it('клик по другой своей фигуре переносит выбор', () => {
    render(<Harness game={createGameStore()} />)
    tap('g1')
    tap('b1')
    expect(cell('g1')).toHaveAttribute('aria-selected', 'false')
    expect(cell('b1')).toHaveAttribute('aria-selected', 'true')
  })

  it('чужую фигуру и фигуру без ходов выбрать нельзя', () => {
    render(<Harness game={createGameStore()} />)
    tap('e7')
    expect(cell('e7')).toHaveAttribute('aria-selected', 'false')
    tap('a1')
    expect(cell('a1')).toHaveAttribute('aria-selected', 'false')
  })

  it('клик на недоступную клетку снимает выбор без хода', () => {
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} onMove={onMove} />)
    tap('e2')
    tap('e5')
    expect(onMove).not.toHaveBeenCalled()
    expect(cell('e2')).toHaveAttribute('aria-selected', 'false')
  })

  it('после хода соперника выбор сбрасывается', () => {
    const game = createGameStore()
    render(<Harness game={game} />)
    tap('e2')
    act(() => {
      game.getState().load({ moves: ['e4'] })
    })
    expect(cell('e2')).toHaveAttribute('aria-selected', 'false')
  })

  it('movableColors без текущего цвета блокирует ввод', () => {
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} movableColors={['b']} onMove={onMove} />)
    tap('e2')
    expect(cell('e2')).toHaveAttribute('aria-selected', 'false')
    expect(onMove).not.toHaveBeenCalled()
  })

  it('клик вне доски ничего не делает', () => {
    render(<Harness game={createGameStore()} />)
    fireEvent.pointerDown(screen.getByRole('grid'), { ...pointer, clientX: -5, clientY: -5 })
    fireEvent.pointerUp(window, { ...pointer, clientX: -5, clientY: -5 })
    expect(screen.getAllByRole('gridcell').filter((c) => c.ariaSelected === 'true')).toHaveLength(0)
  })

  it('правая кнопка мыши не выбирает фигуру', () => {
    render(<Harness game={createGameStore()} />)
    fireEvent.pointerDown(screen.getByRole('grid'), { ...pointer, button: 2, ...center('e2') })
    fireEvent.pointerUp(window, { ...pointer, button: 2, ...center('e2') })
    expect(cell('e2')).toHaveAttribute('aria-selected', 'false')
  })

  it('чёрные внизу: клик считается по перевёрнутой доске', () => {
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} orientation="b" onMove={onMove} />)
    const grid = screen.getByRole('grid')
    // e2 при ориентации чёрных: колонка 7-4=3, строка 1
    const at = (col: number, row: number) => ({
      clientX: col * CELL + CELL / 2,
      clientY: row * CELL + CELL / 2,
    })
    fireEvent.pointerDown(grid, { ...pointer, ...at(3, 1) })
    fireEvent.pointerUp(window, { ...pointer, ...at(3, 1) })
    expect(cell('e2')).toHaveAttribute('aria-selected', 'true')
    // e4 — колонка 3, строка 3
    fireEvent.pointerDown(grid, { ...pointer, ...at(3, 3) })
    fireEvent.pointerUp(window, { ...pointer, ...at(3, 3) })
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
  })
})

describe('ChessBoard: перетаскивание', () => {
  it('drag фигуры на легальную клетку делает ход', () => {
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} onMove={onMove} />)
    drag('e2', 'e4')
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
    expect(cell('e4')).toHaveAccessibleName('e4, белая пешка')
  })

  it('во время перетаскивания фигура следует за указателем', () => {
    const { container } = render(<Harness game={createGameStore()} />)
    const grid = screen.getByRole('grid')
    fireEvent.pointerDown(grid, { ...pointer, ...center('e2') })
    fireEvent.pointerMove(window, { ...pointer, clientX: 450, clientY: 350 })
    const dragged = container.querySelector<HTMLElement>('[class*="dragging"]')
    expect(dragged).not.toBeNull()
    // центр в (450, 350) → левый верхний угол в клетках (4, 3)
    expect(dragged?.style.transform).toContain('translate(400%, 300%)')
    fireEvent.pointerUp(window, { ...pointer, clientX: 450, clientY: 350 })
    expect(container.querySelector('[class*="dragging"]')).toBeNull()
  })

  it('drop на недоступную клетку — хода нет, выбор снят', () => {
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} onMove={onMove} />)
    drag('e2', 'e5')
    expect(onMove).not.toHaveBeenCalled()
    expect(cell('e2')).toHaveAttribute('aria-selected', 'false')
    expect(cell('e2')).toHaveAccessibleName('e2, белая пешка')
  })

  it('drop за пределами доски отменяет ход', () => {
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} onMove={onMove} />)
    const grid = screen.getByRole('grid')
    fireEvent.pointerDown(grid, { ...pointer, ...center('e2') })
    fireEvent.pointerMove(window, { ...pointer, clientX: 900, clientY: 900 })
    fireEvent.pointerUp(window, { ...pointer, clientX: 900, clientY: 900 })
    expect(onMove).not.toHaveBeenCalled()
  })

  it('drop на исходную клетку оставляет фигуру выбранной', () => {
    render(<Harness game={createGameStore()} />)
    drag('e2', 'e2')
    expect(cell('e2')).toHaveAttribute('aria-selected', 'true')
  })

  it('Escape во время перетаскивания отменяет его', () => {
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} onMove={onMove} />)
    fireEvent.pointerDown(screen.getByRole('grid'), { ...pointer, ...center('e2') })
    fireEvent.pointerMove(window, { ...pointer, ...center('e4') })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(window, { ...pointer, ...center('e4') })
    expect(onMove).not.toHaveBeenCalled()
    expect(cell('e2')).toHaveAttribute('aria-selected', 'false')
  })

  it('чужую фигуру тащить нельзя — жест остаётся тапом', () => {
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} onMove={onMove} />)
    drag('e7', 'e5')
    expect(onMove).not.toHaveBeenCalled()
  })
})

describe('ChessBoard: клавиатура', () => {
  it('стрелки двигают фокус по визуальной сетке, Enter выбирает и ходит', async () => {
    const user = userEvent.setup()
    const onMove = vi.fn()
    render(<Harness game={createGameStore()} onMove={onMove} />)

    await user.tab()
    expect(cell('e2')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(cell('e2')).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(cell('e4')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4' })
  })

  it('стрелки не выходят за край доски', async () => {
    const user = userEvent.setup()
    render(<Harness game={createGameStore()} />)
    await user.tab()
    await user.keyboard(
      '{ArrowDown}{ArrowDown}{ArrowDown}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}',
    )
    expect(cell('a1')).toHaveFocus()
  })

  it('на доске чёрных стрелка вверх идёт к первой горизонтали', async () => {
    const user = userEvent.setup()
    render(<Harness game={createGameStore()} orientation="b" />)
    await user.tab()
    expect(cell('e7')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(cell('e6')).toHaveFocus()
  })

  it('пробел работает как Enter, Escape снимает выбор', async () => {
    const user = userEvent.setup()
    render(<Harness game={createGameStore()} />)
    await user.tab()
    await user.keyboard(' ')
    expect(cell('e2')).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Escape}')
    expect(cell('e2')).toHaveAttribute('aria-selected', 'false')
  })

  it('«клик» скринридера (detail = 0) выбирает клетку', () => {
    render(<Harness game={createGameStore()} />)
    fireEvent.click(cell('e2'), { detail: 0 })
    expect(cell('e2')).toHaveAttribute('aria-selected', 'true')
  })

  it('обычный клик мыши не дублирует pointer-жест', () => {
    render(<Harness game={createGameStore()} />)
    tap('e2')
    fireEvent.click(cell('e2'), { detail: 1 })
    expect(cell('e2')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('ChessBoard: превращение', () => {
  const promoGame = () => createGameStore({ startFen: '8/P6k/8/8/8/8/8/K7 w - - 0 1' })

  it('ход на последнюю горизонталь открывает диалог; выбор фигуры делает ход', async () => {
    const onMove = vi.fn()
    render(<Harness game={promoGame()} onMove={onMove} />)
    tap('a7')
    tap('a8')

    const dialog = screen.getByRole('dialog', { name: 'Превращение пешки' })
    expect(dialog).toBeInTheDocument()
    expect(onMove).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'белый конь' }))
    expect(onMove).toHaveBeenCalledWith({ from: 'a7', to: 'a8', promotion: 'n' })
    expect(cell('a8')).toHaveAccessibleName('a8, белый конь')
  })

  it('drag на последнюю горизонталь тоже открывает диалог', () => {
    render(<Harness game={promoGame()} />)
    drag('a7', 'a8')
    expect(screen.getByRole('dialog', { name: 'Превращение пешки' })).toBeInTheDocument()
  })

  it('отмена диалога — хода нет, пешка на месте', async () => {
    const onMove = vi.fn()
    render(<Harness game={promoGame()} onMove={onMove} />)
    tap('a7')
    tap('a8')
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onMove).not.toHaveBeenCalled()
    expect(cell('a7')).toHaveAccessibleName('a7, белая пешка, выбрана')
  })

  it('чёрные превращаются в чёрные фигуры', () => {
    render(<Harness game={createGameStore({ startFen: '7k/8/8/8/8/8/p7/7K b - - 0 1' })} />)
    tap('a2')
    tap('a1')
    expect(screen.getByRole('button', { name: 'чёрный ферзь' })).toBeInTheDocument()
  })
})

describe('ChessBoard: подсветки и объявления', () => {
  it('live-region объявляет последний ход', () => {
    const game = createGameStore()
    render(<Harness game={game} />)
    expect(screen.getByRole('status')).toHaveTextContent('')
    act(() => {
      game.getState().move({ from: 'g1', to: 'f3' })
    })
    expect(screen.getByRole('status')).toHaveTextContent('Белый конь g1 — f3')
  })

  it('подсвечивает последний ход и короля под шахом', () => {
    const game = createGameStore()
    render(<Harness game={game} />)
    act(() => {
      for (const [from, to] of [
        ['f2', 'f3'],
        ['e7', 'e5'],
        ['g2', 'g4'],
        ['d8', 'h4'],
      ] as const) {
        game.getState().move({ from, to })
      }
    })
    expect(cell('d8').className).toContain('last')
    expect(cell('h4').className).toContain('last')
    expect(cell('e1').className).toContain('check')
    expect(cell('a1').className).not.toContain('check')
  })
})
