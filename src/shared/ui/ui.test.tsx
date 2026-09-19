import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import {
  GlassAvatar,
  GlassButton,
  GlassInput,
  GlassLink,
  GlassModal,
  GlassSegmentedControl,
} from './index'
import { getAvatarHues, getInitials } from './GlassAvatar/avatar-color'

describe('GlassButton', () => {
  it('is type=button by default so it never submits a form', () => {
    render(<GlassButton>Go</GlassButton>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button')
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <GlassButton disabled onClick={onClick}>
        Go
      </GlassButton>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('GlassInput', () => {
  it('links the label and the field', () => {
    render(<GlassInput label="Ник" />)
    expect(screen.getByLabelText('Ник')).toBeInTheDocument()
  })

  it('exposes the error to assistive tech', () => {
    render(<GlassInput label="Ник" error="Слишком длинный" hint="До 24 символов" />)
    const input = screen.getByLabelText('Ник')
    expect(input).toBeInvalid()
    expect(input).toHaveAccessibleDescription('Слишком длинный До 24 символов')
  })
})

describe('GlassSegmentedControl', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Gamma', disabled: true },
  ] as const

  function Harness() {
    const [value, setValue] = useState<'a' | 'b' | 'c'>('a')
    return (
      <GlassSegmentedControl label="Test" value={value} options={options} onChange={setValue} />
    )
  }

  it('renders a labelled radiogroup with the current value checked', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'Test' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked()
  })

  it('changes value on click', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('radio', { name: 'Beta' }))
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked()
  })

  it('supports arrow-key navigation', async () => {
    render(<Harness />)
    screen.getByRole('radio', { name: 'Alpha' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked()
  })

  it('does not select disabled options', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('radio', { name: 'Gamma' }))
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked()
  })
})

describe('GlassAvatar', () => {
  it('shows initials and is named by the player', () => {
    render(<GlassAvatar name="Смелый конь" />)
    const avatar = screen.getByRole('img', { name: 'Смелый конь' })
    expect(avatar).toHaveTextContent('СК')
  })

  it('derives initials safely', () => {
    expect(getInitials('  ')).toBe('?')
    expect(getInitials('e4')).toBe('E')
    expect(getInitials('one two three')).toBe('OT')
  })

  it('is deterministic per seed', () => {
    expect(getAvatarHues('user-1')).toEqual(getAvatarHues('user-1'))
    expect(getAvatarHues('user-1')).not.toEqual(getAvatarHues('user-2'))
  })
})

describe('GlassModal', () => {
  function Harness({ onClose }: { onClose: () => void }) {
    const [open, setOpen] = useState(true)
    return (
      <GlassModal
        open={open}
        onClose={() => {
          setOpen(false)
          onClose()
        }}
        title="Итог"
      >
        Мат
      </GlassModal>
    )
  }

  it('opens as a modal dialog with an accessible name', () => {
    render(<Harness onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Итог' })).toBeInTheDocument()
  })

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('GlassLink', () => {
  it('is a real link styled as a button', () => {
    render(
      <MemoryRouter>
        <GlassLink to="/local" variant="primary">
          Играть
        </GlassLink>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Играть' })
    expect(link).toHaveAttribute('href', '/local')
    expect(link).toHaveClass('button', 'primary')
  })
})
