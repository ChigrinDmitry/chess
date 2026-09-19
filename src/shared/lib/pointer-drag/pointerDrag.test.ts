import { beginPointerGesture } from './pointerDrag'
import type { PointerGestureHandlers } from './pointerDrag'

type Down = Parameters<typeof beginPointerGesture>[0]

const down = (over: Partial<Down> = {}): Down => ({
  pointerId: 1,
  pointerType: 'mouse',
  button: 0,
  isPrimary: true,
  clientX: 10,
  clientY: 10,
  ...over,
})

function fire(type: string, init: PointerEventInit) {
  window.dispatchEvent(new PointerEvent(type, { pointerId: 1, ...init }))
}

function handlers() {
  return {
    onDragStart: vi.fn(),
    onDragMove: vi.fn(),
    onDrop: vi.fn(),
    onTap: vi.fn(),
    onCancel: vi.fn(),
  } satisfies PointerGestureHandlers
}

describe('beginPointerGesture', () => {
  it('отпускание без сдвига — тап', () => {
    const h = handlers()
    beginPointerGesture(down(), h)
    fire('pointerup', { clientX: 11, clientY: 10 })
    expect(h.onTap).toHaveBeenCalledWith({ x: 11, y: 10 })
    expect(h.onDragStart).not.toHaveBeenCalled()
    expect(h.onDrop).not.toHaveBeenCalled()
  })

  it('микросдвиг ниже порога не начинает перетаскивание', () => {
    const h = handlers()
    beginPointerGesture(down(), h)
    fire('pointermove', { clientX: 12, clientY: 11 })
    expect(h.onDragStart).not.toHaveBeenCalled()
  })

  it('сдвиг за порог: старт, движение, дроп', () => {
    const h = handlers()
    beginPointerGesture(down(), h)
    fire('pointermove', { clientX: 30, clientY: 10 })
    fire('pointermove', { clientX: 40, clientY: 20 })
    fire('pointerup', { clientX: 50, clientY: 20 })

    expect(h.onDragStart).toHaveBeenCalledTimes(1)
    expect(h.onDragStart).toHaveBeenCalledWith({ x: 30, y: 10 })
    expect(h.onDragMove.mock.calls.map(([p]) => p)).toEqual([
      { x: 30, y: 10 },
      { x: 40, y: 20 },
    ])
    expect(h.onDrop).toHaveBeenCalledWith({ x: 50, y: 20 })
    expect(h.onTap).not.toHaveBeenCalled()
  })

  it('draggable: false — сдвиг не начинает перетаскивание, отпускание — тап', () => {
    const h = handlers()
    beginPointerGesture(down(), { ...h, draggable: false })
    fire('pointermove', { clientX: 100, clientY: 100 })
    fire('pointerup', { clientX: 100, clientY: 100 })
    expect(h.onDragStart).not.toHaveBeenCalled()
    expect(h.onTap).toHaveBeenCalledTimes(1)
  })

  it('свой порог', () => {
    const h = handlers()
    beginPointerGesture(down(), { ...h, threshold: 50 })
    fire('pointermove', { clientX: 40, clientY: 10 })
    expect(h.onDragStart).not.toHaveBeenCalled()
    fire('pointermove', { clientX: 70, clientY: 10 })
    expect(h.onDragStart).toHaveBeenCalledTimes(1)
  })

  it('pointercancel и Escape прерывают жест', () => {
    const a = handlers()
    beginPointerGesture(down(), a)
    fire('pointermove', { clientX: 30, clientY: 10 })
    fire('pointercancel', {})
    expect(a.onCancel).toHaveBeenCalledTimes(1)
    fire('pointerup', { clientX: 30, clientY: 10 })
    expect(a.onDrop).not.toHaveBeenCalled()

    const b = handlers()
    beginPointerGesture(down(), b)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(b.onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancel() снимает слушатели и вызывается один раз', () => {
    const h = handlers()
    const cancel = beginPointerGesture(down(), h)
    cancel?.()
    cancel?.()
    fire('pointerup', { clientX: 10, clientY: 10 })
    expect(h.onCancel).toHaveBeenCalledTimes(1)
    expect(h.onTap).not.toHaveBeenCalled()
  })

  it('после окончания жеста cancel() ничего не делает', () => {
    const h = handlers()
    const cancel = beginPointerGesture(down(), h)
    fire('pointerup', { clientX: 10, clientY: 10 })
    cancel?.()
    expect(h.onCancel).not.toHaveBeenCalled()
  })

  it('игнорирует другой pointerId', () => {
    const h = handlers()
    beginPointerGesture(down(), h)
    fire('pointermove', { pointerId: 2, clientX: 90, clientY: 90 })
    fire('pointerup', { pointerId: 2, clientX: 90, clientY: 90 })
    expect(h.onDragStart).not.toHaveBeenCalled()
    expect(h.onTap).not.toHaveBeenCalled()
    fire('pointerup', { clientX: 10, clientY: 10 })
    expect(h.onTap).toHaveBeenCalledTimes(1)
  })

  it('не начинает жест для правой кнопки мыши и не основного касания', () => {
    const h = handlers()
    expect(beginPointerGesture(down({ button: 2 }), h)).toBeNull()
    expect(beginPointerGesture(down({ isPrimary: false }), h)).toBeNull()
    fire('pointerup', {})
    expect(h.onTap).not.toHaveBeenCalled()
  })

  it('touch с button 0 и пером работает как мышь', () => {
    const h = handlers()
    beginPointerGesture(down({ pointerType: 'touch' }), h)
    fire('pointerup', { clientX: 10, clientY: 10 })
    expect(h.onTap).toHaveBeenCalledTimes(1)
  })
})
