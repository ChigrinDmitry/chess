export interface PointerPoint {
  x: number
  y: number
}

export interface PointerGestureHandlers {
  /**
   * Сдвиг с точки нажатия превысил порог — жест стал перетаскиванием.
   * Не вызывается при `draggable: false`.
   */
  onDragStart?: (point: PointerPoint) => void
  onDragMove?: (point: PointerPoint) => void
  /** Указатель отпущен после перетаскивания. */
  onDrop?: (point: PointerPoint) => void
  /** Указатель отпущен, не сдвинувшись за порог (клик / тап). */
  onTap?: (point: PointerPoint) => void
  /** Жест прерван: `pointercancel`, Escape или ручной `cancel()`. */
  onCancel?: () => void
}

export interface PointerGestureOptions extends PointerGestureHandlers {
  /** Порог в пикселях, после которого нажатие считается перетаскиванием. */
  threshold?: number
  /** `false` — жест может закончиться только тапом. */
  draggable?: boolean
}

const DEFAULT_THRESHOLD = 4

/**
 * Единый жест для мыши, пера и touch: нажатие → (тап | перетаскивание).
 * Вызывать из `onPointerDown`; слушатели вешаются на `window` на время жеста.
 * Возвращает функцию отмены; `null`, если это не основное нажатие (правая кнопка, второй палец).
 */
export function beginPointerGesture(
  event: Pick<
    PointerEvent,
    'pointerId' | 'pointerType' | 'button' | 'isPrimary' | 'clientX' | 'clientY'
  >,
  { threshold = DEFAULT_THRESHOLD, draggable = true, ...handlers }: PointerGestureOptions,
): (() => void) | null {
  if (!event.isPrimary) return null
  if (event.pointerType === 'mouse' && event.button !== 0) return null

  const { pointerId } = event
  const origin: PointerPoint = { x: event.clientX, y: event.clientY }
  let dragging = false
  let active = true

  const pointOf = (e: PointerEvent): PointerPoint => ({ x: e.clientX, y: e.clientY })

  const stop = () => {
    active = false
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    window.removeEventListener('pointercancel', handleCancel)
    window.removeEventListener('keydown', handleKey)
  }

  function handleMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return
    const point = pointOf(e)
    if (!dragging) {
      if (!draggable) return
      if (Math.hypot(point.x - origin.x, point.y - origin.y) < threshold) return
      dragging = true
      handlers.onDragStart?.(point)
    }
    handlers.onDragMove?.(point)
  }

  function handleUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return
    stop()
    const point = pointOf(e)
    if (dragging) handlers.onDrop?.(point)
    else handlers.onTap?.(point)
  }

  function handleCancel(e: PointerEvent) {
    if (e.pointerId !== pointerId) return
    cancel()
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') cancel()
  }

  function cancel() {
    if (!active) return
    stop()
    handlers.onCancel?.()
  }

  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleUp)
  window.addEventListener('pointercancel', handleCancel)
  window.addEventListener('keydown', handleKey)

  return cancel
}
