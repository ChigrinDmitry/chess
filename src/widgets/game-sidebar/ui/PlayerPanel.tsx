import type { ClockStoreApi } from '@/entities/clock'
import { ClockFace } from '@/entities/clock'
import type { Color, PieceType } from '@/entities/game'
import { Piece } from '@/entities/piece'
import type { PlayerIdentity } from '@/entities/player'
import { GlassAvatar, GlassPanel } from '@/shared/ui'
import styles from './PlayerPanel.module.css'

export interface PlayerPanelProps {
  color: Color
  identity: PlayerIdentity
  /** Часы; `null` — партия без часов. */
  clock: ClockStoreApi | null
  /** Фигуры соперника, которые взяла эта сторона. */
  captured: readonly PieceType[]
  /** Материальный перевес в пользу этой стороны (> 0), иначе 0. */
  advantage: number
  /** Сейчас ход этой стороны. */
  active: boolean
  className?: string | undefined
}

const ORDER: Record<PieceType, number> = { q: 0, r: 1, b: 2, n: 3, p: 4, k: 5 }

/** Панель игрока: аватар, имя, цвет, взятые фигуры с перевесом и часы. */
export function PlayerPanel({
  color,
  identity,
  clock,
  captured,
  advantage,
  active,
  className,
}: PlayerPanelProps) {
  const sorted = [...captured].sort((a, b) => ORDER[a] - ORDER[b])
  const classes = [styles.panel, active && styles.active, className].filter(Boolean).join(' ')

  return (
    <GlassPanel
      as="section"
      padding="sm"
      radius="lg"
      className={classes}
      aria-label={`${identity.displayName}, ${color === 'w' ? 'белые' : 'чёрные'}`}
      data-active={active}
    >
      <GlassAvatar name={identity.displayName} seed={identity.id} />
      <div className={styles.info}>
        <span className={styles.name}>{identity.displayName}</span>
        <span className={styles.captured} aria-label="Взятые фигуры">
          {sorted.map((type, index) => (
            <Piece
              key={`${type}-${index}`}
              color={color === 'w' ? 'b' : 'w'}
              type={type}
              className={styles.miniature}
            />
          ))}
          {advantage > 0 && <span className={styles.advantage}>+{advantage}</span>}
        </span>
      </div>
      {clock && <ClockFace store={clock} color={color} />}
    </GlassPanel>
  )
}
