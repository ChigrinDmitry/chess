import type { ClockConfig } from './clock'

export type TimeControlId = '3+2' | '5+0' | '10+0' | '15+10' | 'none'

export interface TimeControl {
  id: TimeControlId
  /** `null` — без часов. */
  config: ClockConfig | null
}

const MINUTE = 60_000
const SECOND = 1000

/** Контроли времени из ТЗ (§3.3): blitz 3+2, 5+0, rapid 10+0, 15+10 и без часов. */
export const TIME_CONTROLS: readonly TimeControl[] = [
  { id: '3+2', config: { initialMs: 3 * MINUTE, incrementMs: 2 * SECOND } },
  { id: '5+0', config: { initialMs: 5 * MINUTE, incrementMs: 0 } },
  { id: '10+0', config: { initialMs: 10 * MINUTE, incrementMs: 0 } },
  { id: '15+10', config: { initialMs: 15 * MINUTE, incrementMs: 10 * SECOND } },
  { id: 'none', config: null },
]

export function getTimeControl(id: TimeControlId): TimeControl {
  const found = TIME_CONTROLS.find((tc) => tc.id === id)
  if (!found) throw new Error(`Unknown time control: ${id}`)
  return found
}
