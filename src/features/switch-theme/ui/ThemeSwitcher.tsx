import { useThemeMode, type ThemeMode } from '@/shared/lib/theme'
import { GlassSegmentedControl, type SegmentedOption } from '@/shared/ui'

const OPTIONS: readonly SegmentedOption<ThemeMode>[] = [
  { value: 'system', label: 'Авто' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

export function ThemeSwitcher() {
  const [mode, setMode] = useThemeMode()

  return (
    <GlassSegmentedControl
      label="Тема оформления"
      value={mode}
      options={OPTIONS}
      onChange={setMode}
    />
  )
}
