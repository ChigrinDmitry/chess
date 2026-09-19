import type { ComponentProps } from 'react'
import { glassButtonClasses } from './glassButtonClasses'

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
  return <button type={type} className={glassButtonClasses(variant, size, className)} {...rest} />
}
