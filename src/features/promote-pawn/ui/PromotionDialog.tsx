import type { Color, PromotionPiece } from '@/entities/game'
import { Piece, PieceDefs, pieceName } from '@/entities/piece'
import { GlassButton, GlassModal } from '@/shared/ui'
import styles from './PromotionDialog.module.css'

const CHOICES: readonly { type: PromotionPiece; label: string }[] = [
  { type: 'q', label: 'Ферзь' },
  { type: 'r', label: 'Ладья' },
  { type: 'b', label: 'Слон' },
  { type: 'n', label: 'Конь' },
]

export interface PromotionDialogProps {
  open: boolean
  /** Цвет превращаемой пешки. */
  color: Color
  onSelect: (piece: PromotionPiece) => void
  /** Esc, крестик или клик по подложке — ход не делается. */
  onCancel: () => void
}

/** Диалог выбора фигуры при превращении пешки. */
export function PromotionDialog({ open, color, onSelect, onCancel }: PromotionDialogProps) {
  return (
    <GlassModal open={open} onClose={onCancel} title="Превращение пешки">
      {open && (
        <>
          <PieceDefs />
          <div className={styles.choices}>
            {CHOICES.map(({ type, label }) => (
              <GlassButton
                key={type}
                className={styles.choice}
                aria-label={pieceName(color, type)}
                onClick={() => onSelect(type)}
              >
                <Piece color={color} type={type} className={styles.piece} />
                <span className={styles.label}>{label}</span>
              </GlassButton>
            ))}
          </div>
        </>
      )}
    </GlassModal>
  )
}
