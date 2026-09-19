import { useSyncExternalStore } from 'react'
import { getThemeMode, setThemeMode, subscribeThemeMode, type ThemeMode } from './theme'

export function useThemeMode(): readonly [ThemeMode, (mode: ThemeMode) => void] {
  const mode = useSyncExternalStore(subscribeThemeMode, getThemeMode)
  return [mode, setThemeMode]
}
