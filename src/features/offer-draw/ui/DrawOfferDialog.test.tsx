import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DrawOfferDialog } from './DrawOfferDialog'
import { OfferDrawButton } from './OfferDrawButton'

describe('DrawOfferDialog', () => {
  it('закрыт, пока предложения нет', () => {
    render(<DrawOfferDialog offeredBy={null} onAccept={() => {}} onDecline={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('называет стороны и отдаёт ответ', async () => {
    const onAccept = vi.fn()
    const onDecline = vi.fn()
    render(<DrawOfferDialog offeredBy="w" onAccept={onAccept} onDecline={onDecline} />)

    const dialog = screen.getByRole('dialog', { name: 'Предложение ничьей' })
    expect(dialog).toHaveTextContent('Белые предлагают ничью. Чёрные, вы согласны?')

    await userEvent.click(screen.getByRole('button', { name: 'Принять ничью' }))
    expect(onAccept).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }))
    expect(onDecline).toHaveBeenCalledOnce()
  })

  it('крестик — это отказ', async () => {
    const onDecline = vi.fn()
    render(<DrawOfferDialog offeredBy="b" onAccept={() => {}} onDecline={onDecline} />)
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onDecline).toHaveBeenCalled()
  })
})

describe('OfferDrawButton', () => {
  it('вызывает onOffer и умеет быть отключённой', async () => {
    const onOffer = vi.fn()
    const { rerender } = render(<OfferDrawButton onOffer={onOffer} />)
    await userEvent.click(screen.getByRole('button', { name: 'Предложить ничью' }))
    expect(onOffer).toHaveBeenCalledOnce()

    rerender(<OfferDrawButton disabled onOffer={onOffer} />)
    expect(screen.getByRole('button', { name: 'Предложить ничью' })).toBeDisabled()
  })
})
