import { GlassButton } from '@/shared/ui'
import { useHistoryHotkeys } from '../model/useHistoryHotkeys'
import type { HistoryNavigation } from '../model/useHistoryNavigation'
import styles from './HistoryControls.module.css'

export interface HistoryControlsProps {
  nav: HistoryNavigation
  className?: string | undefined
}

/** Кнопки просмотра истории (в начало, назад, вперёд, к текущей позиции) и горячие клавиши. */
export function HistoryControls({ nav, className }: HistoryControlsProps) {
  useHistoryHotkeys(nav)
  const atStart = nav.ply === 0

  return (
    <div
      role="group"
      aria-label="Навигация по ходам"
      className={[styles.controls, className].filter(Boolean).join(' ')}
    >
      <GlassButton size="sm" aria-label="В начало партии" disabled={atStart} onClick={nav.first}>
        ⏮
      </GlassButton>
      <GlassButton size="sm" aria-label="Предыдущий ход" disabled={atStart} onClick={nav.prev}>
        ◀
      </GlassButton>
      <GlassButton size="sm" aria-label="Следующий ход" disabled={nav.isLive} onClick={nav.next}>
        ▶
      </GlassButton>
      <GlassButton
        size="sm"
        variant={nav.isLive ? 'secondary' : 'primary'}
        aria-label="К текущей позиции"
        disabled={nav.isLive}
        onClick={nav.goLive}
      >
        ⏭
      </GlassButton>
    </div>
  )
}
