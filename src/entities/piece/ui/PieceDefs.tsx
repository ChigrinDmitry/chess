/**
 * Градиенты фигур. Цвета — CSS-переменные темы (`--piece-*`), поэтому смена темы
 * не требует перерисовки. Рендерить один раз рядом с фигурами.
 */
export function PieceDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <linearGradient
          id="piece-grad-w"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="10"
          x2="0"
          y2="90"
        >
          <stop offset="0" style={{ stopColor: 'var(--piece-w-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--piece-w-bottom)' }} />
        </linearGradient>
        <linearGradient
          id="piece-grad-b"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="10"
          x2="0"
          y2="90"
        >
          <stop offset="0" style={{ stopColor: 'var(--piece-b-top)' }} />
          <stop offset="1" style={{ stopColor: 'var(--piece-b-bottom)' }} />
        </linearGradient>
        <linearGradient
          id="piece-sheen"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="10"
          x2="0"
          y2="62"
        >
          <stop offset="0" style={{ stopColor: 'var(--piece-sheen)' }} />
          <stop offset="1" style={{ stopColor: 'var(--piece-sheen)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
    </svg>
  )
}
