import { getThemeMode, initTheme, resolveTheme, setThemeMode, THEME_STORAGE_KEY } from './theme'

// Один мок на весь файл: вотчер системной темы вешается на первый matchMedia-объект.
const media = {
  dark: false,
  listeners: new Set<() => void>(),
  emit(dark: boolean) {
    media.dark = dark
    media.listeners.forEach((listener) => listener())
  },
}

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes('dark') && media.dark
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => media.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => media.listeners.delete(listener),
  })) as unknown as typeof window.matchMedia
})

describe('resolveTheme', () => {
  it('follows the system in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('ignores the system for explicit modes', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    media.dark = false
    delete document.documentElement.dataset.theme
  })

  it('applies the system theme by default', () => {
    media.dark = true
    initTheme()
    expect(getThemeMode()).toBe('system')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('restores a saved mode', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    initTheme()
    expect(getThemeMode()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('falls back to system on garbage in storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    initTheme()
    expect(getThemeMode()).toBe('system')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('persists and applies a chosen mode', () => {
    initTheme()
    setThemeMode('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('reacts to system changes only in system mode', () => {
    initTheme()
    setThemeMode('system')
    media.emit(true)
    expect(document.documentElement.dataset.theme).toBe('dark')

    setThemeMode('light')
    media.emit(false)
    media.emit(true)
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
