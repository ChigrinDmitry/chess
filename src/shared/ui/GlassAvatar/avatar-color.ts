/** FNV-1a: стабильный хэш строки в 32 бита без зависимостей. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** До двух заглавных букв из первых слов имени; для пустого имени — «?». */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? '')
  return letters.join('').toLocaleUpperCase()
}

/** Пара оттенков градиента (в градусах hue), детерминированно от seed. */
export function getAvatarHues(seed: string): readonly [number, number] {
  const hash = hashString(seed)
  const start = hash % 360
  const shift = 30 + ((hash >>> 9) % 50)
  return [start, (start + shift) % 360]
}
