import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { Color } from '@/entities/game/@x/clock'
import {
  createClock,
  pressClock,
  startClock,
  stopClock,
  syncClock,
  type ClockConfig,
  type ClockSnapshot,
  type ClockState,
} from './clock'

export interface ClockActions {
  start(color: Color): void
  press(): void
  stop(): void
  sync(snapshot: ClockSnapshot): void
  reset(config?: ClockConfig): void
}

export type ClockStore = ClockState & ClockActions
export type ClockStoreApi = StoreApi<ClockStore>

export interface CreateClockStoreOptions {
  config: ClockConfig
  /** Источник времени; в тестах подменяется. */
  now?: () => number
}

/**
 * Стор не тикает сам: UI и хост берут `remainingMs(state, color, now())` по своему
 * расписанию (rAF, один `setTimeout` на `msUntilFlag`).
 */
export function createClockStore({
  config,
  now = Date.now,
}: CreateClockStoreOptions): ClockStoreApi {
  return createStore<ClockStore>()((set, get) => ({
    ...createClock(config, now()),
    start: (color) => set(startClock(get(), color, now())),
    press: () => set(pressClock(get(), now())),
    stop: () => set(stopClock(get(), now())),
    sync: (snapshot) => set(syncClock(get(), snapshot, now())),
    reset: (next) => set(createClock(next ?? get().config, now())),
  }))
}
