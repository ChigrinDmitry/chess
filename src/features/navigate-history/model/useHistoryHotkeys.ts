import { useEffect, useRef } from 'react'
import type { HistoryNavigation } from './useHistoryNavigation'

/** Цели, в которых стрелки принадлежат самому элементу: доска, поля ввода, диалоги. */
const OWN_ARROWS = 'input, textarea, select, [role="grid"], [role="radiogroup"], dialog[open]'

/**
 * ← → листают историю, Home/End — в начало и к текущей позиции. Стрелки внутри доски
 * двигают фокус по клеткам, поэтому там и в полях ввода горячие клавиши не срабатывают.
 */
export function useHistoryHotkeys(nav: HistoryNavigation): void {
  const navRef = useRef(nav)
  useEffect(() => {
    navRef.current = nav
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      if (target instanceof Element && target.closest(OWN_ARROWS)) return
      const current = navRef.current
      switch (event.key) {
        case 'ArrowLeft':
          current.prev()
          break
        case 'ArrowRight':
          current.next()
          break
        case 'Home':
          current.first()
          break
        case 'End':
          current.goLive()
          break
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
