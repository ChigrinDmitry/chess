import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameControls, type GameControlsProps } from './GameControls'

function setup(patch: Partial<GameControlsProps> = {}) {
  const props: GameControlsProps = {
    actor: 'w',
    inProgress: true,
    plyCount: 0,
    onFlip: vi.fn(),
    onResign: vi.fn(),
    onAgreeDraw: vi.fn(),
    onNewGame: vi.fn(),
    ...patch,
  }
  const view = render(<GameControls {...props} />)
  return { props, ...view }
}

describe('GameControls', () => {
  it('в идущей партии есть сдача и ничья', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Сдаться' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Предложить ничью' })).toBeInTheDocument()
  })

  it('после окончания остаются только переворот и новая партия', () => {
    setup({ inProgress: false })
    expect(screen.queryByRole('button', { name: 'Сдаться' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Предложить ничью' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Перевернуть/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Новая партия' })).toBeInTheDocument()
  })

  it('сдача от имени actor', async () => {
    const { props } = setup({ actor: 'b' })
    await userEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Сдаться?' })).getByRole('button', {
        name: 'Сдаться',
      }),
    )
    expect(props.onResign).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('ничья: предложение → согласие соперника', async () => {
    const { props } = setup({ actor: 'w', plyCount: 6 })
    await userEvent.click(screen.getByRole('button', { name: 'Предложить ничью' }))
    expect(screen.getByRole('dialog', { name: 'Предложение ничьей' })).toHaveTextContent(
      'Белые предлагают ничью',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Принять ничью' }))
    expect(props.onAgreeDraw).toHaveBeenCalledOnce()
  })

  it('отказ от ничьей не заканчивает партию', async () => {
    const { props } = setup({ plyCount: 6 })
    await userEvent.click(screen.getByRole('button', { name: 'Предложить ничью' }))
    await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }))
    expect(props.onAgreeDraw).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ход снимает предложение ничьей', async () => {
    const { props, rerender } = setup({ plyCount: 6 })
    await userEvent.click(screen.getByRole('button', { name: 'Предложить ничью' }))
    rerender(<GameControls {...props} plyCount={7} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('новая партия без ходов начинается сразу', async () => {
    const { props } = setup({ plyCount: 0 })
    await userEvent.click(screen.getByRole('button', { name: 'Новая партия' }))
    expect(props.onNewGame).toHaveBeenCalledOnce()
  })

  it('новая партия посреди игры просит подтверждения', async () => {
    const { props } = setup({ plyCount: 4 })
    await userEvent.click(screen.getByRole('button', { name: 'Новая партия' }))
    expect(props.onNewGame).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Начать заново' }))
    expect(props.onNewGame).toHaveBeenCalledOnce()
  })

  it('новая партия после окончания — без подтверждения', async () => {
    const { props } = setup({ inProgress: false, plyCount: 40 })
    await userEvent.click(screen.getByRole('button', { name: 'Новая партия' }))
    expect(props.onNewGame).toHaveBeenCalledOnce()
  })
})
