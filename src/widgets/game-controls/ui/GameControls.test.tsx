import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameControls, type GameControlsProps } from './GameControls'

function setup(patch: Partial<GameControlsProps> = {}) {
  const props: GameControlsProps = {
    actor: 'w',
    inProgress: true,
    plyCount: 0,
    drawOfferedBy: null,
    onFlip: vi.fn(),
    onResign: vi.fn(),
    onOfferDraw: vi.fn(),
    onAnswerDraw: vi.fn(),
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

  it('отмена хода — только когда её передали (партия с ботом)', async () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Отменить ход' })).not.toBeInTheDocument()
  })

  it('«Отменить ход» отдаёт действие наружу, но недоступна без ходов и вне партии', async () => {
    const onTakeback = vi.fn()
    const { rerender, props } = setup({ onTakeback, plyCount: 2 })
    await userEvent.click(screen.getByRole('button', { name: 'Отменить ход' }))
    expect(onTakeback).toHaveBeenCalledOnce()

    rerender(<GameControls {...props} onTakeback={onTakeback} plyCount={0} />)
    expect(screen.getByRole('button', { name: 'Отменить ход' })).toBeDisabled()

    rerender(<GameControls {...props} onTakeback={onTakeback} plyCount={5} canTakeback={false} />)
    expect(screen.getByRole('button', { name: 'Отменить ход' })).toBeDisabled()

    rerender(<GameControls {...props} onTakeback={onTakeback} plyCount={5} inProgress={false} />)
    expect(screen.queryByRole('button', { name: 'Отменить ход' })).not.toBeInTheDocument()
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

  it('«Предложить ничью» отдаёт предложение наружу и сам диалог не открывает', async () => {
    const { props } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Предложить ничью' }))
    expect(props.onOfferDraw).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('на предложение соперника можно согласиться', async () => {
    const { props } = setup({ drawOfferedBy: 'w' })
    expect(screen.getByRole('dialog', { name: 'Предложение ничьей' })).toHaveTextContent(
      'Белые предлагают ничью',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Принять ничью' }))
    expect(props.onAnswerDraw).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('отказ и закрытие окна — отказ; закрытие после ответа второго отказа не даёт', async () => {
    const { props, rerender } = setup({ drawOfferedBy: 'b' })
    await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }))
    expect(props.onAnswerDraw).toHaveBeenCalledExactlyOnceWith(false)

    // Хост снял предложение — окно закрылось само, это не новый отказ
    rerender(<GameControls {...props} drawOfferedBy={null} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(props.onAnswerDraw).toHaveBeenCalledOnce()
  })

  it('после окончания партии предложение не показывается', () => {
    setup({ inProgress: false, drawOfferedBy: 'w' })
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
