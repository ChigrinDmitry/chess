import { Link, type LinkProps } from 'react-router'
import type { GlassButtonProps } from '../GlassButton/GlassButton'
import { glassButtonClasses } from '../GlassButton/glassButtonClasses'
import styles from './GlassLink.module.css'

export type GlassLinkProps = LinkProps & {
  variant?: GlassButtonProps['variant']
  size?: GlassButtonProps['size']
}

/** Ссылка, выглядящая как кнопка: навигация остаётся ссылкой (открыть в новой вкладке и т.д.). */
export function GlassLink({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: GlassLinkProps) {
  return (
    <Link
      className={[glassButtonClasses(variant, size, className), styles.link].join(' ')}
      {...rest}
    />
  )
}
