import { Link } from 'react-router'
import { ThemeSwitcher } from '@/features/switch-theme'
import { ROUTES } from '@/shared/config'
import { GlassPanel } from '@/shared/ui'
import styles from './AppHeader.module.css'

/** Шапка: логотип-ссылка на главную и переключатель темы. Язык и ник гостя — этапы 8–9. */
export function AppHeader() {
  return (
    <GlassPanel as="header" padding="sm" radius="xl" className={styles.header}>
      <Link to={ROUTES.home} className={styles.logo}>
        <span aria-hidden="true" className={styles.mark}>
          ♞
        </span>
        Chess Online
      </Link>
      <ThemeSwitcher />
    </GlassPanel>
  )
}
