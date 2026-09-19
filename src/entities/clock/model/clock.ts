import type { Color } from '@/entities/game/@x/clock'

export interface ClockConfig {
  initialMs: number
  incrementMs: number
}

/**
 * Часы на timestamp'ах, а не на счётчике тиков: состояние хранит остаток на момент
 * `updatedAt`, а текущий остаток вычисляется из `now`. Пропущенные тики (фоновая вкладка,
 * тормоза) поэтому не приводят к дрейфу. Все функции чистые; `now` передаётся снаружи.
 */
export interface ClockState {
  config: ClockConfig
  /** Остаток каждой стороны на момент `updatedAt`. */
  remaining: Record<Color, number>
  /** Чьи часы идут; `null` — стоят. */
  running: Color | null
  updatedAt: number
}

/** Срез часов, присылаемый хостом (для resync). */
export interface ClockSnapshot {
  remaining: Record<Color, number>
  running: Color | null
}

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

export function createClock(config: ClockConfig, now: number): ClockState {
  return {
    config,
    remaining: { w: config.initialMs, b: config.initialMs },
    running: null,
    updatedAt: now,
  }
}

/** Остаток времени `color` на момент `now`, не меньше 0. */
export function remainingMs(clock: ClockState, color: Color, now: number): number {
  const elapsed = clock.running === color ? Math.max(0, now - clock.updatedAt) : 0
  return Math.max(0, clock.remaining[color] - elapsed)
}

/** Сторона, у которой закончилось время на момент `now`. */
export function flaggedColor(clock: ClockState, now: number): Color | null {
  if (remainingMs(clock, 'w', now) === 0) return 'w'
  if (remainingMs(clock, 'b', now) === 0) return 'b'
  return null
}

/** Через сколько мс упадёт флаг у идущих часов (для одного точного `setTimeout`); `null` — часы стоят. */
export function msUntilFlag(clock: ClockState, now: number): number | null {
  return clock.running ? remainingMs(clock, clock.running, now) : null
}

/** Фиксирует остатки на `now`, часы продолжают идти у той же стороны. */
function settle(clock: ClockState, now: number): ClockState {
  if (!clock.running) return { ...clock, updatedAt: now }
  return {
    ...clock,
    remaining: { ...clock.remaining, [clock.running]: remainingMs(clock, clock.running, now) },
    updatedAt: now,
  }
}

/** Запускает часы `color`. Если уже идут чьи-то — без изменений. */
export function startClock(clock: ClockState, color: Color, now: number): ClockState {
  if (clock.running) return clock
  return { ...clock, running: color, updatedAt: now }
}

/** Остановка (пауза, конец партии): остатки фиксируются. */
export function stopClock(clock: ClockState, now: number): ClockState {
  return { ...settle(clock, now), running: null }
}

/**
 * Ход сделан: списывает время идущей стороны, начисляет ей инкремент и передаёт ход часам
 * соперника. Если время у ходившего уже вышло, инкремент не начисляется, часы останавливаются
 * с нулём — дальше `flaggedColor` покажет проигравшего. Если часы стоят, ничего не меняет.
 */
export function pressClock(clock: ClockState, now: number): ClockState {
  const mover = clock.running
  if (!mover) return clock
  const left = remainingMs(clock, mover, now)
  if (left === 0) return stopClock(clock, now)
  return {
    ...clock,
    remaining: { ...clock.remaining, [mover]: left + clock.config.incrementMs },
    running: other(mover),
    updatedAt: now,
  }
}

/** Принимает авторитетный срез от хоста; локальные вычисления отбрасываются. */
export function syncClock(clock: ClockState, snapshot: ClockSnapshot, now: number): ClockState {
  return {
    ...clock,
    remaining: { ...snapshot.remaining },
    running: snapshot.running,
    updatedAt: now,
  }
}

/** Срез на момент `now` для отправки по протоколу. */
export function snapshotClock(clock: ClockState, now: number): ClockSnapshot {
  return {
    remaining: { w: remainingMs(clock, 'w', now), b: remainingMs(clock, 'b', now) },
    running: clock.running,
  }
}
