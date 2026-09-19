import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('логотип ведёт на главную, рядом переключатель темы', () => {
    render(
      <MemoryRouter initialEntries={['/local']}>
        <AppHeader />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /Chess Online/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('radiogroup', { name: 'Тема оформления' })).toBeInTheDocument()
  })
})
