import { ROUTES } from '@/shared/config'
import { GlassLink, GlassPanel } from '@/shared/ui'
import { AppHeader } from '@/widgets/app-header'
import styles from './HomePage.module.css'

export function HomePage() {
  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>Chess Online</h1>
          <p className={styles.lead}>
            Шахматы в стекле: играйте за одним экраном, с ботом или онлайн.
          </p>
        </section>
        <div className={styles.modes}>
          <GlassPanel as="article" padding="lg" className={styles.card}>
            <h2 className={styles.cardTitle}>Локальная партия</h2>
            <p className={styles.cardText}>
              Двое за одним экраном: часы, ходы и все исходы партии.
            </p>
            <GlassLink to={ROUTES.local} variant="primary" size="lg">
              Играть
            </GlassLink>
          </GlassPanel>
          <GlassPanel as="article" padding="lg" className={styles.card}>
            <h2 className={styles.cardTitle}>С ботом</h2>
            <p className={styles.cardText}>Уровни от новичка до сильного любителя.</p>
            <GlassLink to={ROUTES.bot} variant="primary" size="lg">
              Играть
            </GlassLink>
          </GlassPanel>
          <GlassPanel as="article" padding="lg" className={styles.card} data-soon>
            <h2 className={styles.cardTitle}>Онлайн по ссылке</h2>
            <p className={styles.cardText}>Создайте игру и отправьте ссылку сопернику.</p>
            <span className={styles.soon}>Скоро</span>
          </GlassPanel>
        </div>
      </main>
    </div>
  )
}
