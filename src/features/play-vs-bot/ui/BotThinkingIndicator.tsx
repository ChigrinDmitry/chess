import type { BotPlayerState } from '../model/createBotPlayer'
import styles from './BotThinkingIndicator.module.css'

export interface BotThinkingIndicatorProps {
  state: BotPlayerState
}

/** Что сейчас делает бот: загружает движок, думает над ходом или сломался. */
export function BotThinkingIndicator({ state }: BotThinkingIndicatorProps) {
  const { ready, thinking, error } = state
  const text = error
    ? 'Бот недоступен: не удалось запустить движок'
    : !ready
      ? 'Загрузка движка'
      : thinking
        ? 'Бот думает'
        : ''
  const busy = !error && (!ready || thinking)

  return (
    <p role="status" className={styles.indicator} data-error={Boolean(error)}>
      {text}
      {busy && (
        <span aria-hidden="true" className={styles.dots}>
          <span />
          <span />
          <span />
        </span>
      )}
    </p>
  )
}
