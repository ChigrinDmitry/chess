import glass from '../glass.module.css'
import styles from './GlassButton.module.css'
import type { GlassButtonProps } from './GlassButton'

/** Классы кнопки: общие для `GlassButton` и `GlassLink`. */
export function glassButtonClasses(
  variant: NonNullable<GlassButtonProps['variant']>,
  size: NonNullable<GlassButtonProps['size']>,
  className?: string,
): string {
  return [
    styles.button,
    styles[variant],
    styles[size],
    variant === 'secondary' && glass.surface,
    variant === 'secondary' && glass.strong,
    className,
  ]
    .filter(Boolean)
    .join(' ')
}
