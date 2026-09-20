import type { Color } from '@/entities/game'
import { GlassButton, GlassModal } from '@/shared/ui'
import styles from './DrawOfferDialog.module.css'

export interface DrawOfferDialogProps {
  /** Кто предложил ничью; `null` — диалог закрыт. */
  offeredBy: Color | null
  onAccept: () => void
  onDecline: () => void
}

const SIDE: Record<Color, { offerer: string; answerer: string }> = {
  w: { offerer: 'Белые', answerer: 'Чёрные' },
  b: { offerer: 'Чёрные', answerer: 'Белые' },
}

/**
 * Ответ соперника на предложение ничьей. Закрытие окна (Esc, крестик) — отказ; а окно, которое
 * закрылось само из-за ответа или хода, отказом не считается.
 */
export function DrawOfferDialog({ offeredBy, onAccept, onDecline }: DrawOfferDialogProps) {
  const side = SIDE[offeredBy ?? 'w']

  return (
    <GlassModal
      open={offeredBy !== null}
      onClose={() => {
        if (offeredBy !== null) onDecline()
      }}
      title="Предложение ничьей"
      footer={
        <>
          <GlassButton variant="ghost" onClick={onDecline}>
            Отклонить
          </GlassButton>
          <GlassButton variant="primary" onClick={onAccept}>
            Принять ничью
          </GlassButton>
        </>
      }
    >
      <p className={styles.text}>
        {side.offerer} предлагают ничью. {side.answerer}, вы согласны?
      </p>
    </GlassModal>
  )
}
