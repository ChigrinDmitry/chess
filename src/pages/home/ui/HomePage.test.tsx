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

  it('ведёт на локальную партию и на партию с ботом', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const links = screen.getAllByRole('link', { name: 'Играть' })
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/local', '/bot'])
  })
})
