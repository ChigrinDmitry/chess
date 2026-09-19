import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HomePage } from '../index'

describe('HomePage', () => {
  it('renders the title', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Chess Online' })).toBeInTheDocument()
  })

  it('ведёт на локальную партию', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Играть' })).toHaveAttribute('href', '/local')
  })
})
