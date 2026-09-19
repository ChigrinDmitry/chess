import type { ComponentPropsWithoutRef } from 'react'
import glass from '../glass.module.css'
import styles from './GlassPanel.module.css'

export type GlassPanelProps = ComponentPropsWithoutRef<'div'> & {
  as?: 'div' | 'section' | 'aside' | 'header' | 'article'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  radius?: 'md' | 'lg' | 'xl'
  strong?: boolean
}

export function GlassPanel({
  as: Tag = 'div',
  padding = 'md',
  radius = 'lg',
  strong = false,
  className,
  ...rest
}: GlassPanelProps) {
  const classes = [
    glass.surface,
    strong && glass.strong,
    styles.panel,
    styles[`padding-${padding}`],
    styles[`radius-${radius}`],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <Tag className={classes} {...rest} />
}
