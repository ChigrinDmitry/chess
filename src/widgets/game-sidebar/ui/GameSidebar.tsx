import type { ClockStoreApi } from '@/entities/clock'
import { selectCaptured, selectMaterialBalance, type Color, type GameState } from '@/entities/game'
import { PieceDefs } from '@/entities/piece'
import type { PlayerIdentity } from '@/entities/player'
import { HistoryControls, type HistoryNavigation } from '@/features/navigate-history'
import { GlassPanel } from '@/shared/ui'
import { MoveList } from './MoveList'
import { PlayerPanel } from './PlayerPanel'
import styles from './GameSidebar.module.css'

export interface GameSidebarProps {
  game: GameState
  players: Record<Color, PlayerIdentity>
  /** Часы; `null` — партия без часов. */
  clock: ClockStoreApi | null
  /** Чьи фигуры внизу доски: эта панель идёт в списке последней. */
  orientation: Color
  history: HistoryNavigation
  /** Строка состояния: чей ход, шах, итог. */
  status: string
  className?: string | undefined
}

/** Боковая колонка партии: панели игроков с часами, список ходов и навигация по истории. */
export function GameSidebar({
  game,
  players,
  clock,
  orientation,
  history,
  status,
  className,
}: GameSidebarProps) {
  const top: Color = orientation === 'w' ? 'b' : 'w'
  const captured = selectCaptured(game)
  const balance = selectMaterialBalance(game)
  const over = game.result !== null

  const panel = (color: Color) => (
    <PlayerPanel
      color={color}
      identity={players[color]}
      clock={clock}
      captured={captured[color]}
      advantage={Math.max(0, color === 'w' ? balance : -balance)}
      active={!over && game.turn === color}
      className={color === top ? styles.top : styles.bottom}
    />
  )

  return (
    <aside className={[styles.sidebar, className].filter(Boolean).join(' ')}>
      <PieceDefs />
      {panel(top)}
      <GlassPanel padding="sm" radius="lg" className={styles.moves}>
        <p role="status" className={styles.status}>
          {status}
        </p>
        <div className={styles.scroll}>
          <MoveList moves={game.moves} viewPly={history.ply} onSelect={history.goTo} />
        </div>
        <HistoryControls nav={history} />
      </GlassPanel>
      {panel(orientation)}
    </aside>
  )
}
