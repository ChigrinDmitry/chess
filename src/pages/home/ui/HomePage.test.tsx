import { render, screen } from '@testing-library/react'
import { HomePage } from '../index'

describe('HomePage', () => {
  it('renders the title', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { name: 'Chess Online' })).toBeInTheDocument()
  })
})
