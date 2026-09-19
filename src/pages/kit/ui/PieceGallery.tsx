import type { Color, PieceType } from '@/entities/game'
import { Piece, PieceDefs, pieceName } from '@/entities/piece'
import styles from './PieceGallery.module.css'

const TYPES: readonly PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p']
const COLORS: readonly Color[] = ['w', 'b']

// Каждый цвет на светлой и тёмной клетке — проверяем читаемость в текущей теме
const ROWS = COLORS.flatMap((color) =>
  [styles.light, styles.dark].map((background) => ({ color, background })),
)

export function PieceGallery() {
  return (
    <>
      <PieceDefs />
      <div className={styles.gallery}>
        {ROWS.flatMap(({ color, background }) =>
          TYPES.map((type) => (
            <div key={`${color}${type}${background}`} className={`${styles.cell} ${background}`}>
              <Piece color={color} type={type} />
            </div>
          )),
        )}
      </div>
      <div className={styles.small} aria-label="Мелкий размер, 32 px" role="group">
        {COLORS.flatMap((color) =>
          TYPES.map((type) => (
            <div key={`${color}${type}`} role="img" aria-label={pieceName(color, type)}>
              <Piece color={color} type={type} />
            </div>
          )),
        )}
      </div>
    </>
  )
}
