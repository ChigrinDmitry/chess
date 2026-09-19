import type { Unsubscribe } from './transport'

export interface Emitter<Args extends unknown[]> {
  on(handler: (...args: Args) => void): Unsubscribe
  emit(...args: Args): void
}

/** Мини-эмиттер для транспортов; подписки во время `emit` не ломают обход. */
export function createEmitter<Args extends unknown[]>(): Emitter<Args> {
  const handlers = new Set<(...args: Args) => void>()
  return {
    on(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    emit(...args) {
      for (const handler of [...handlers]) handler(...args)
    },
  }
}
