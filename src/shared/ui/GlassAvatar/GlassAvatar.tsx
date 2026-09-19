import type { CSSProperties } from 'react'
import { getAvatarHues, getInitials } from './avatar-color'
import styles from './GlassAvatar.module.css'

export type GlassAvatarProps = {
  name: string
  /** Источник цвета; по умолчанию — имя. Для игроков передаём стабильный id. */
  seed?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function GlassAvatar({ name, seed, size = 'md', className }: GlassAvatarProps) {
  const [from, to] = getAvatarHues(seed ?? name)

  return (
    <span
      role="img"
      aria-label={name}
      className={[styles.avatar, styles[size], className].filter(Boolean).join(' ')}
      style={{ '--hue-from': from, '--hue-to': to } as CSSProperties}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
    </span>
  )
}
