import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initTheme, setThemeMode } from '@/shared/lib/theme'
import { ThemeSwitcher } from '../index'

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear()
    initTheme()
    setThemeMode('system')
  })

  it('switches the theme and persists it', async () => {
    render(<ThemeSwitcher />)
    await userEvent.click(screen.getByRole('radio', { name: 'Тёмная' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('chess:theme')).toBe('dark')
    expect(screen.getByRole('radio', { name: 'Тёмная' })).toBeChecked()
  })
})
