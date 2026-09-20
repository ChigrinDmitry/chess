import { useState } from 'react'
import type { Color } from '@/entities/game'
import { FlipBoardButton } from '@/features/flip-board'
import { DrawOfferDialog, OfferDrawButton } from '@/features/offer-draw'
import { TakebackButton } from '@/features/request-takeback'
import { ResignButton } from '@/features/resign-game'
import { GlassButton, GlassModal } from '@/shared/ui'
import styles from './GameControls.module.css'

export interface GameControlsProps {
  /** Сторона, от имени которой сдаются и предлагают ничью (в hot-seat — та, чей ход). */
  actor: Color
  /** Партия идёт: можно сдаться и предложить ничью. */
  inProgress: boolean
  /** Сыграно полуходов: новая партия посреди игры просит подтверждения. */
  plyCount: number
  /** Кто предложил ничью и ждёт ответа от нас; `null` — отвечать не на что. */
  drawOfferedBy: Color | null
  onFlip: () => void
  onResign: (color: Color) => void
  onOfferDraw: () => void
  onAnswerDraw: (accept: boolean) => void
  onNewGame: () => void
  /** Отмена хода; передаётся только в партии с ботом, иначе кнопки нет. */
  onTakeback?: (() => void) | undefined
  /** Есть что отменять (по умолчанию — идёт партия и сыгран хотя бы один полуход). */
  canTakeback?: boolean | undefined
}

/** Действия партии: переворот доски, сдача, ничья по соглашению, новая партия. */
export function GameControls({
  actor,
  inProgress,
  plyCount,
  drawOfferedBy,
  onFlip,
  onResign,
  onOfferDraw,
  onAnswerDraw,
  onNewGame,
  onTakeback,
  canTakeback = plyCount > 0,
}: GameControlsProps) {
  const [confirmingNew, setConfirmingNew] = useState(false)

  const startNew = () => {
    // Идущую партию теряем только после подтверждения
    if (inProgress && plyCount > 0) setConfirmingNew(true)
    else onNewGame()
  }

  const confirmNew = () => {
    setConfirmingNew(false)
    onNewGame()
  }

  return (
    <div className={styles.controls}>
      {inProgress && (
        <>
          {onTakeback && <TakebackButton disabled={!canTakeback} onTakeback={onTakeback} />}
          <OfferDrawButton onOffer={onOfferDraw} />
          <ResignButton color={actor} onResign={onResign} />
        </>
      )}
      <FlipBoardButton onFlip={onFlip} />
      <GlassButton variant={inProgress ? 'secondary' : 'primary'} onClick={startNew}>
        Новая партия
      </GlassButton>

      <DrawOfferDialog
        offeredBy={inProgress ? drawOfferedBy : null}
        onAccept={() => onAnswerDraw(true)}
        onDecline={() => onAnswerDraw(false)}
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
