import { fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_BOT_SETTINGS, type BotSettings } from '../model/settings'
import { BotSettingsPanel } from './BotSettingsPanel'

function setup(patch: Partial<BotSettings> = {}) {
  const props = {
    value: { ...DEFAULT_BOT_SETTINGS, ...patch },
    onChange: vi.fn(),
    onStart: vi.fn(),
  }
  render(<BotSettingsPanel {...props} />)
  return props
}

describe('BotSettingsPanel', () => {
  it('показывает выбранные значения и описание уровня', () => {
    setup({ level: 5, color: 'random', timeControl: '5+0' })
    expect(screen.getByRole('radio', { name: '5' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Случайно' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '5+0' })).toBeChecked()
    expect(screen.getByText('Разрядник · ориентировочно 1450 Elo')).toBeInTheDocument()
  })

  it('восемь уровней', () => {
    setup()
    const levels = screen.getByRole('radiogroup', { name: 'Уровень бота' })
    expect(levels.querySelectorAll('input')).toHaveLength(8)
  })

  it('изменение любой настройки отдаёт полные настройки наружу', () => {
    const props = setup()
    fireEvent.click(screen.getByRole('radio', { name: '8' }))
    expect(props.onChange).toHaveBeenLastCalledWith({ ...props.value, level: 8 })

    fireEvent.click(screen.getByRole('radio', { name: 'Чёрные' }))
    expect(props.onChange).toHaveBeenLastCalledWith({ ...props.value, color: 'b' })

    fireEvent.click(screen.getByRole('radio', { name: 'Без часов' }))
    expect(props.onChange).toHaveBeenLastCalledWith({ ...props.value, timeControl: 'none' })
  })

  it('«Начать партию»', () => {
    const props = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Начать партию' }))
    expect(props.onStart).toHaveBeenCalledOnce()
  })
})
