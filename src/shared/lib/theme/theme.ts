export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

// Тот же ключ читает инлайн-скрипт в index.html — при смене синхронизировать оба места.
export const THEME_STORAGE_KEY = 'chess:theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

type Listener = () => void

const listeners = new Set<Listener>()
let mode: ThemeMode = 'system'
let systemWatcherStarted = false

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function prefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

function readStoredMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function resolveTheme(themeMode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (themeMode === 'system') return systemDark ? 'dark' : 'light'
  return themeMode
}

function apply() {
  document.documentElement.dataset.theme = resolveTheme(mode, prefersDark())
}

/** Читает сохранённый режим, применяет тему и начинает следить за системной. Идемпотентна. */
export function initTheme() {
  mode = readStoredMode()
  apply()
  listeners.forEach((listener) => listener())

  if (systemWatcherStarted || typeof window.matchMedia !== 'function') return
  systemWatcherStarted = true
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    if (mode === 'system') apply()
  })
}

export function getThemeMode(): ThemeMode {
  return mode
}

export function setThemeMode(next: ThemeMode) {
  if (next === mode) return
  mode = next
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Хранилище недоступно (приватный режим) — тема живёт до перезагрузки.
  }
  apply()
  listeners.forEach((listener) => listener())
}

export function subscribeThemeMode(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
