import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import glass from '../glass.module.css'
import styles from './GlassSegmentedControl.module.css'

export type SegmentedOption<T extends string> = {
  value: T
  label: ReactNode
  disabled?: boolean
}

export type GlassSegmentedControlProps<T extends string> = {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  /** Доступное имя группы (видимой подписи у контрола нет). */
  label: string
  className?: string
}

// Нативные radio дают стрелки, Tab-навигацию и группировку без своей клавиатурной логики.
export function GlassSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: GlassSegmentedControlProps<T>) {
  const name = useId()
  const controlRef = useRef<HTMLDivElement>(null)

  // Ширина подписей разная, поэтому ползунок берёт позицию и размер выбранной подписи.
  useLayoutEffect(() => {
    const control = controlRef.current
    if (!control) return
    const place = () => {
      const active = control.querySelector('label:has(input:checked)')
      if (!(active instanceof HTMLElement)) return
      control.style.setProperty('--thumb-x', `${active.offsetLeft}px`)
      control.style.setProperty('--thumb-w', `${active.offsetWidth}px`)
    }
    place()
    // Переход включаем после первого размещения, чтобы ползунок не выезжал с нуля.
    const frame = requestAnimationFrame(() => {
      control.dataset.ready = 'true'
    })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place)
    observer?.observe(control)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [value, options])

  const classes = [glass.surface, styles.control, className].filter(Boolean).join(' ')

  return (
    <div ref={controlRef} role="radiogroup" aria-label={label} className={classes}>
      <span className={styles.thumb} aria-hidden="true" />
      {options.map((option) => (
        <label key={option.value} className={styles.option}>
          <input
            type="radio"
            className={styles.input}
            name={name}
            value={option.value}
            checked={option.value === value}
            disabled={option.disabled ?? false}
            onChange={() => onChange(option.value)}
          />
          <span className={styles.text}>{option.label}</span>
        </label>
      ))}
    </div>
  )
}
