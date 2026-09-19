import styles from './AppBackground.module.css'

/** Анимированный градиентный фон: за стеклом должно быть что преломлять. */
export function AppBackground() {
  return (
    <div className={styles.background} aria-hidden="true">
      <span className={`${styles.blob} ${styles.blob1}`} />
      <span className={`${styles.blob} ${styles.blob2}`} />
      <span className={`${styles.blob} ${styles.blob3}`} />
      <span className={`${styles.blob} ${styles.blob4}`} />
    </div>
  )
}
