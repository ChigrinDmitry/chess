import type { Color, PieceType } from '@/entities/game/@x/piece'
import { PIECE_SHAPES } from '../model/shapes'
import styles from './Piece.module.css'

export interface PieceProps {
  color: Color
  type: PieceType
  className?: string | undefined
}

/**
 * Фигура-SVG. Заливка и блик берутся из градиентов `PieceDefs` — их нужно
 * отрендерить один раз на странице (доска делает это сама).
 */
export function Piece({ color, type, className }: PieceProps) {
  const shape = PIECE_SHAPES[type]
  const classes = [styles.svg, styles[color], className].filter(Boolean).join(' ')

  return (
    <svg className={classes} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <g className={styles.outline}>
        {shape.fills.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className={styles.body} fill={`url(#piece-grad-${color})`}>
        {shape.fills.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className={styles.sheen} fill="url(#piece-sheen)">
        {shape.fills.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {shape.details && (
        <g className={styles.details}>
          {shape.details.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
      {shape.eye && (
        <circle className={styles.eye} cx={shape.eye[0]} cy={shape.eye[1]} r={shape.eye[2]} />
      )}
    </svg>
  )
}
