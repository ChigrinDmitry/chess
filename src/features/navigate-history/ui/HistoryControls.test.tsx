import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryControls } from './HistoryControls'
import type { HistoryNavigation } from '../model/useHistoryNavigation'

function makeNav(patch: Partial<HistoryNavigation> = {}): HistoryNavigation {
  return {
    total: 4,
    ply: 4,
    isLive: true,
    goTo: vi.fn(),
    first: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
    goLive: vi.fn(),
    ...patch,
  }
}

describe('HistoryControls', () => {
  it('в текущей позиции недоступны «вперёд» и «к текущей»', () => {
    render(<HistoryControls nav={makeNav()} />)
    expect(screen.getByRole('button', { name: 'Следующий ход' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'К текущей позиции' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Предыдущий ход' })).toBeEnabled()
  })

  it('в начале недоступны «назад» и «в начало»', () => {
    render(<HistoryControls nav={makeNav({ ply: 0, isLive: false })} />)
    expect(screen.getByRole('button', { name: 'В начало партии' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Предыдущий ход' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Следующий ход' })).toBeEnabled()
  })

  it('кнопки вызывают навигацию', async () => {
    const nav = makeNav({ ply: 2, isLive: false })
    render(<HistoryControls nav={nav} />)

    await userEvent.click(screen.getByRole('button', { name: 'В начало партии' }))
    await userEvent.click(screen.getByRole('button', { name: 'Предыдущий ход' }))
    await userEvent.click(screen.getByRole('button', { name: 'Следующий ход' }))
    await userEvent.click(screen.getByRole('button', { name: 'К текущей позиции' }))

    expect(nav.first).toHaveBeenCalledOnce()
    expect(nav.prev).toHaveBeenCalledOnce()
    expect(nav.next).toHaveBeenCalledOnce()
    expect(nav.goLive).toHaveBeenCalledOnce()
  })

  it('стрелки, Home и End листают историю', () => {
    const nav = makeNav({ ply: 2, isLive: false })
    render(<HistoryControls nav={nav} />)

    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    fireEvent.keyDown(document.body, { key: 'Home' })
    fireEvent.keyDown(document.body, { key: 'End' })

    expect(nav.prev).toHaveBeenCalledOnce()
    expect(nav.next).toHaveBeenCalledOnce()
    expect(nav.first).toHaveBeenCalledOnce()
    expect(nav.goLive).toHaveBeenCalledOnce()
  })

  it('стрелки внутри доски и полей ввода не листают историю', () => {
    const nav = makeNav({ ply: 2, isLive: false })
    render(
      <>
        <HistoryControls nav={nav} />
        <div role="grid">
          <div role="gridcell" tabIndex={0} data-testid="cell" />
        </div>
        <input aria-label="ник" />
      </>,
    )

    fireEvent.keyDown(screen.getByTestId('cell'), { key: 'ArrowLeft' })
    fireEvent.keyDown(screen.getByLabelText('ник'), { key: 'ArrowRight' })
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', ctrlKey: true })

    expect(nav.prev).not.toHaveBeenCalled()
    expect(nav.next).not.toHaveBeenCalled()
  })
})
