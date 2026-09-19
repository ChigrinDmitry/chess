import { useState } from 'react'
import type { Color } from '@/entities/game'
import { GlassButton, GlassModal } from '@/shared/ui'
import styles from './ResignButton.module.css'

export interface ResignButtonProps {
  /** Сторона, которая сдаётся. */
  color: Color
  disabled?: boolean | undefined
  onResign: (color: Color) => void
}

/** «Сдаться» с подтверждением: случайное нажатие не должно стоить партии. */
export function ResignButton({ color, disabled, onResign }: ResignButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const side = color === 'w' ? 'Белые' : 'Чёрные'

  const confirm = () => {
    setConfirming(false)
    onResign(color)
  }

  return (
    <>
      <GlassButton
        variant="danger"
        disabled={disabled ?? false}
        onClick={() => setConfirming(true)}
      >
        Сдаться
      </GlassButton>
      <GlassModal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Сдаться?"
        footer={
          <>
            <GlassButton variant="ghost" onClick={() => setConfirming(false)}>
              Продолжить партию
            </GlassButton>
            <GlassButton variant="danger" onClick={confirm}>
              Сдаться
            </GlassButton>
          </>
        }
      >
        <p className={styles.text}>{side} сдают партию. Это действие нельзя отменить.</p>
      </GlassModal>
    </>
  )
}
