import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GameResult } from '@/entities/game'
import { GameResultModal } from './GameResultModal'

const MATE: GameResult = { result: '1-0', reason: 'checkmate' }

describe('GameResultModal', () => {
  it('закрыто, пока партия идёт', () => {
    render(<GameResultModal result={null} getPgn={() => ''} onNewGame={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('показывает итог и причину', () => {
    render(<GameResultModal result={MATE} getPgn={() => ''} onNewGame={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Партия окончена' })
    expect(dialog).toHaveTextContent('Победили белые')
    expect(dialog).toHaveTextContent('мат')
    expect(dialog).toHaveTextContent('1-0')
  })

  it('«Рассмотреть партию» закрывает окно, новый итог открывает снова', async () => {
    const { rerender } = render(
      <GameResultModal result={MATE} getPgn={() => ''} onNewGame={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Рассмотреть партию' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<GameResultModal result={null} getPgn={() => ''} onNewGame={() => {}} />)
    rerender(
      <GameResultModal
        result={{ result: '1/2-1/2', reason: 'stalemate' }}
        getPgn={() => ''}
        onNewGame={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toHaveTextContent('Ничья')
  })

  it('«Новая партия» закрывает окно и просит начать заново', async () => {
    const onNewGame = vi.fn()
    render(<GameResultModal result={MATE} getPgn={() => ''} onNewGame={onNewGame} />)
    await userEvent.click(screen.getByRole('button', { name: 'Новая партия' }))
    expect(onNewGame).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('копирование PGN', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('кладёт PGN в буфер и подтверждает', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })
      render(<GameResultModal result={MATE} getPgn={() => '1. e4 e5'} onNewGame={() => {}} />)

      await userEvent.click(screen.getByRole('button', { name: 'Скопировать PGN' }))
      expect(writeText).toHaveBeenCalledWith('1. e4 e5')
      expect(await screen.findByRole('button', { name: 'PGN скопирован ✓' })).toBeInTheDocument()
    })

    it('сообщает, если скопировать не удалось', async () => {
      vi.stubGlobal('navigator', {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      })
      Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true })
      render(<GameResultModal result={MATE} getPgn={() => 'x'} onNewGame={() => {}} />)

      await userEvent.click(screen.getByRole('button', { name: 'Скопировать PGN' }))
      expect(
        await screen.findByRole('button', { name: 'Не удалось скопировать' }),
      ).toBeInTheDocument()
      Reflect.deleteProperty(document, 'execCommand')
    })
  })
})
