import styles from './BoardSample.module.css'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

// Клетки → подсветка: проверяем, что каждая читается на обеих клетках в обеих темах
const HIGHLIGHTS: Record<string, string> = {
  e2: styles.last ?? '',
  e4: styles.last ?? '',
  d4: styles.select ?? '',
  f5: styles.move ?? '',
  c6: styles.move ?? '',
  e8: styles.check ?? '',
}

export function BoardSample() {
  const squares = []
  for (let rank = 8; rank >= 1; rank--) {
    for (let file = 0; file < 8; file++) {
      const name = `${FILES[file]}${rank}`
      const isDark = (file + rank) % 2 === 0
      const classes = [styles.square, isDark ? styles.dark : styles.light, HIGHLIGHTS[name]]
      squares.push(<div key={name} className={classes.filter(Boolean).join(' ')} />)
    }
  }

  return (
    <div className={styles.frame}>
      <div className={styles.board} role="img" aria-label="Образец палитры доски">
        {squares}
      </div>
    </div>
  )
}
