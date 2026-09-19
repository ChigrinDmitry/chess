import type { ComponentProps } from 'react'
import glass from '../glass.module.css'
import styles from './GlassButton.module.css'

export type GlassButtonProps = ComponentProps<'button'> & {
  variant?: 'secondary' | 'primary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function GlassButton({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: GlassButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    variant === 'secondary' && glass.surface,
    variant === 'secondary' && glass.strong,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <button type={type} className={classes} {...rest} />
}
