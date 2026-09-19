/**
 * Время для циферблата: «9:58», «1:05:00» от часа, а в последние 10 секунд — с десятыми
 * («0:07.3»). Округляем вверх: пока флаг не упал, на часах не бывает «0:00».
 */
export function formatClock(ms: number): string {
  const safe = Math.max(0, ms)
  if (safe < 10_000) {
    const tenths = Math.ceil(safe / 100)
    return `0:${String(Math.floor(tenths / 10)).padStart(2, '0')}.${tenths % 10}`
  }
  const total = Math.ceil(safe / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}` : `${minutes}:${ss}`
}

/** Мало времени: в последние 20 секунд циферблат подсвечивается. */
export const LOW_TIME_MS = 20_000
