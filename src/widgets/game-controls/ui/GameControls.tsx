import { useState } from 'react'
import type { Color } from '@/entities/game'
import { FlipBoardButton } from '@/features/flip-board'
import { DrawOfferDialog, OfferDrawButton, useDrawOffer } from '@/features/offer-draw'
import { ResignButton } from '@/features/resign-game'
import { GlassButton, GlassModal } from '@/shared/ui'
import styles from './GameControls.module.css'

export interface GameControlsProps {
  /** Сторона, от имени которой сдаются и предлагают ничью (в hot-seat — та, чей ход). */
  actor: Color
  /** Партия идёт: можно сдаться и предложить ничью. */
  inProgress: boolean
  /** Сыграно полуходов: предложение ничьей действует до следующего хода. */
  plyCount: number
  onFlip: () => void
  onResign: (color: Color) => void
  onAgreeDraw: () => void
  onNewGame: () => void
}

/** Действия партии: переворот доски, сдача, ничья по соглашению, новая партия. */
export function GameControls({
  actor,
  inProgress,
  plyCount,
  onFlip,
  onResign,
  onAgreeDraw,
  onNewGame,
}: GameControlsProps) {
  const drawOffer = useDrawOffer(plyCount)
  const [confirmingNew, setConfirmingNew] = useState(false)

  const acceptDraw = () => {
    drawOffer.clear()
    onAgreeDraw()
  }

  const startNew = () => {
    // Идущую партию теряем только после подтверждения
    if (inProgress && plyCount > 0) setConfirmingNew(true)
    else onNewGame()
  }

  const confirmNew = () => {
    setConfirmingNew(false)
    drawOffer.clear()
    onNewGame()
  }

  return (
    <div className={styles.controls}>
      {inProgress && (
        <>
          <OfferDrawButton onOffer={() => drawOffer.offer(actor)} />
          <ResignButton color={actor} onResign={onResign} />
        </>
      )}
      <FlipBoardButton onFlip={onFlip} />
      <GlassButton variant={inProgress ? 'secondary' : 'primary'} onClick={startNew}>
        Новая партия
      </GlassButton>

      <DrawOfferDialog
        offeredBy={inProgress ? drawOffer.offeredBy : null}
        onAccept={acceptDraw}
        onDecline={drawOffer.clear}
      />
      <GlassModal
        open={confirmingNew}
        onClose={() => setConfirmingNew(false)}
        title="Начать новую партию?"
        footer={
          <>
            <GlassButton variant="ghost" onClick={() => setConfirmingNew(false)}>
              Продолжить текущую
            </GlassButton>
            <GlassButton variant="danger" onClick={confirmNew}>
              Начать заново
            </GlassButton>
          </>
        }
      >
        <p className={styles.text}>Текущая партия не закончена и будет потеряна.</p>
      </GlassModal>
    </div>
  )
}
