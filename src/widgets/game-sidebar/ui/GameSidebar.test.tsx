import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createClockStore } from '@/entities/clock'
import { createGameStore } from '@/entities/game'
import type { PlayerIdentity } from '@/entities/player'
import { useHistoryNavigation } from '@/features/navigate-history'
import { GameSidebar } from './GameSidebar'

const identity = (id: string, displayName: string): PlayerIdentity => ({
  kind: 'guest',
  id,
  displayName,
  avatar: { hue: 200, initials: displayName.slice(0, 1) },
})
const PLAYERS = { w: identity('w', 'Белые'), b: identity('b', 'Чёрные') }

function play(game: ReturnType<typeof createGameStore>, moves: string) {
  for (const m of moves.split(' ')) {
    game.getState().move({ from: m.slice(0, 2) as never, to: m.slice(2, 4) as never })
  }
}

function Harness({
  game,
  clock = null,
  orientation = 'w',
}: {
  game: ReturnType<typeof createGameStore>
  clock?: ReturnType<typeof createClockStore> | null
  orientation?: 'w' | 'b'
}) {
  const state = game.getState()
  const history = useHistoryNavigation(state.moves.length)
  return (
    <>
      <GameSidebar
        game={state}
        players={PLAYERS}
        clock={clock}
        orientation={orientation}
        history={history}
        status="Ход белых"
      />
      <span data-testid="ply">{history.ply}</span>
    </>
  )
}

describe('GameSidebar', () => {
  it('без ходов показывает подсказку', () => {
    render(<Harness game={createGameStore()} />)
    expect(screen.getByText('Ходов пока нет')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ход белых')
  })

  it('перечисляет ходы по строкам', () => {
    const game = createGameStore()
    play(game, 'e2e4 e7e5 g1f3')
    render(<Harness game={game} />)

    const list = screen.getByRole('list', { name: 'Ходы партии' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('1.e4e5')
    expect(rows[1]).toHaveTextContent('2.Nf3')
  })

  it('последний ход отмечен текущим, клик по ходу листает историю', async () => {
    const game = createGameStore()
    play(game, 'e2e4 e7e5 g1f3')
    render(<Harness game={game} />)

    expect(screen.getByRole('button', { name: 'Nf3' })).toHaveAttribute('aria-current', 'step')
    await userEvent.click(screen.getByRole('button', { name: 'e5' }))
    expect(screen.getByRole('button', { name: 'e5' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByTestId('ply')).toHaveTextContent('2')
  })

  it('панель стороны, чей ход, помечена активной', () => {
    render(<Harness game={createGameStore()} />)
    expect(screen.getByRole('region', { name: 'Белые, белые' })).toHaveAttribute(
      'data-active',
      'true',
    )
    expect(screen.getByRole('region', { name: 'Чёрные, чёрные' })).toHaveAttribute(
      'data-active',
      'false',
    )
  })

  it('после окончания ни одна панель не активна', () => {
    const game = createGameStore()
    game.getState().resign('w')
    render(<Harness game={game} />)
    expect(screen.getByRole('region', { name: 'Чёрные, чёрные' })).toHaveAttribute(
      'data-active',
      'false',
    )
  })

  it('часы показываются у обеих сторон, если они есть', () => {
    const clock = createClockStore({ config: { initialMs: 300_000, incrementMs: 0 } })
    render(<Harness game={createGameStore()} clock={clock} />)
    expect(screen.getByRole('timer', { name: 'Часы белых' })).toHaveTextContent('5:00')
    expect(screen.getByRole('timer', { name: 'Часы чёрных' })).toHaveTextContent('5:00')
  })

  it('без часов циферблатов нет', () => {
    render(<Harness game={createGameStore()} />)
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('взятые фигуры и перевес у стороны, которая впереди', () => {
    const game = createGameStore()
    play(game, 'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 a2a3 a5c3 d2c3')
    render(<Harness game={game} />)

    const white = screen.getByRole('region', { name: 'Белые, белые' })
    expect(within(white).getByText('+6')).toBeInTheDocument()
    const black = screen.getByRole('region', { name: 'Чёрные, чёрные' })
    expect(within(black).queryByText(/^\+/)).not.toBeInTheDocument()
  })

  it('панель нижней стороны — последняя в колонке', () => {
    render(<Harness game={createGameStore()} orientation="b" />)
    const regions = screen.getAllByRole('region')
    expect(regions[0]).toHaveAccessibleName('Белые, белые')
    expect(regions[1]).toHaveAccessibleName('Чёрные, чёрные')
  })
})
