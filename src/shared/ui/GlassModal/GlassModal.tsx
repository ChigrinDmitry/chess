import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react'
import glass from '../glass.module.css'
import { GlassButton } from '../GlassButton/GlassButton'
import styles from './GlassModal.module.css'

export type GlassModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Строка действий внизу (кнопки). */
  footer?: ReactNode
  closeLabel?: string
}

// Нативный <dialog>: top-layer, фокус-ловушка, Esc и inert-фон без своего кода.
export function GlassModal({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel = 'Закрыть',
}: GlassModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Клик по самому <dialog> (а не по содержимому) — это клик по подложке.
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      ref={ref}
      className={[glass.surface, glass.strong, styles.dialog].join(' ')}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleClick}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <GlassButton variant="ghost" size="sm" aria-label={closeLabel} onClick={onClose}>
            ✕
          </GlassButton>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </dialog>
  )
}
