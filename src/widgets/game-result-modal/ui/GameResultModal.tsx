import { useEffect, useRef, useState } from 'react'
import { describeOutcome, describeReason, type GameResult } from '@/entities/game'
import { copyText } from '@/shared/lib/clipboard'
import { GlassButton, GlassModal } from '@/shared/ui'
import styles from './GameResultModal.module.css'

export interface GameResultModalProps {
  /** Итог партии; `null` — партия идёт. */
  result: GameResult | null
  /** PGN партии для копирования. */
  getPgn: () => string
  onNewGame: () => void
}

const COPIED_MS = 2000

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Скопировать PGN',
  copied: 'PGN скопирован ✓',
  failed: 'Не удалось скопировать',
}

/**
 * Итог партии: результат, причина и что делать дальше. Окно можно закрыть, чтобы рассмотреть
 * доску и ходы; для новой партии оно открывается снова само, потому что итог — новый объект.
 */
export function GameResultModal({ result, getPgn, onNewGame }: GameResultModalProps) {
  const [dismissed, setDismissed] = useState<GameResult | null>(null)
  const [copy, setCopy] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleCopy = async () => {
    const ok = await copyText(getPgn())
    setCopy(ok ? 'copied' : 'failed')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopy('idle'), COPIED_MS)
  }

  const open = result !== null && dismissed !== result
  const close = () => setDismissed(result)

  return (
    <GlassModal
      open={open}
      onClose={close}
      title="Партия окончена"
      footer={
        <>
          <GlassButton onClick={handleCopy}>{COPY_LABEL[copy]}</GlassButton>
          <GlassButton variant="ghost" onClick={close}>
            Рассмотреть партию
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={() => {
              close()
              onNewGame()
            }}
          >
            Новая партия
          </GlassButton>
        </>
      }
    >
      {result && (
        <div className={styles.summary}>
          <p className={styles.outcome}>{describeOutcome(result)}</p>
          <p className={styles.reason}>{describeReason(result.reason)}</p>
          <p className={styles.score} aria-label="Результат в нотации PGN">
            {result.result}
          </p>
        </div>
      )}
    </GlassModal>
  )
}
