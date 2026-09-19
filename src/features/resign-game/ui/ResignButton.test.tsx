import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResignButton } from './ResignButton'

describe('ResignButton', () => {
  it('сдаётся только после подтверждения', async () => {
    const onResign = vi.fn()
    render(<ResignButton color="b" onResign={onResign} />)

    await userEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
    const dialog = screen.getByRole('dialog', { name: 'Сдаться?' })
    expect(dialog).toHaveTextContent('Чёрные сдают партию')
    expect(onResign).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Сдаться' }))
    expect(onResign).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('«Продолжить партию» отменяет сдачу', async () => {
    const onResign = vi.fn()
    render(<ResignButton color="w" onResign={onResign} />)

    await userEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить партию' }))

    expect(onResign).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('можно отключить', () => {
    render(<ResignButton color="w" disabled onResign={() => {}} />)
    expect(screen.getByRole('button', { name: 'Сдаться' })).toBeDisabled()
  })
})
