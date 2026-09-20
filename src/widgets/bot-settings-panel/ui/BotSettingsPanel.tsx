import { BOT_LEVELS, getBotLevel, type BotLevelId } from '@/entities/bot'
import { TimeControlPicker } from '@/entities/clock'
import { GlassButton, GlassPanel, GlassSegmentedControl, type SegmentedOption } from '@/shared/ui'
import type { BotSettings, ColorChoice } from '../model/settings'
import styles from './BotSettingsPanel.module.css'

const LEVEL_OPTIONS: readonly SegmentedOption<string>[] = BOT_LEVELS.map(({ id }) => ({
  value: String(id),
  label: String(id),
}))

const COLOR_OPTIONS: readonly SegmentedOption<ColorChoice>[] = [
  { value: 'w', label: 'Белые' },
  { value: 'random', label: 'Случайно' },
  { value: 'b', label: 'Чёрные' },
]

export interface BotSettingsPanelProps {
  value: BotSettings
  onChange: (settings: BotSettings) => void
  onStart: () => void
}

/** Настройка партии с ботом: уровень, цвет и контроль времени. */
export function BotSettingsPanel({ value, onChange, onStart }: BotSettingsPanelProps) {
  const level = getBotLevel(value.level)

  return (
    <GlassPanel as="section" padding="lg" className={styles.panel} aria-labelledby="bot-settings">
      <h1 id="bot-settings" className={styles.title}>
        Партия с ботом
      </h1>

      <div className={styles.group}>
        <span className={styles.caption}>Уровень бота</span>
        <GlassSegmentedControl
          label="Уровень бота"
          value={String(value.level)}
          options={LEVEL_OPTIONS}
          onChange={(id) => onChange({ ...value, level: Number(id) as BotLevelId })}
        />
        <p className={styles.hint} aria-live="polite">
          {level.name} · ориентировочно {level.elo} Elo
        </p>
      </div>

      <div className={styles.group}>
        <span className={styles.caption}>Ваш цвет</span>
        <GlassSegmentedControl
          label="Ваш цвет"
          value={value.color}
          options={COLOR_OPTIONS}
          onChange={(color) => onChange({ ...value, color })}
        />
      </div>

      <TimeControlPicker
        value={value.timeControl}
        onChange={(timeControl) => onChange({ ...value, timeControl })}
      />

      <GlassButton variant="primary" size="lg" onClick={onStart}>
        Начать партию
      </GlassButton>
    </GlassPanel>
  )
}
