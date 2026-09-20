import { TIME_CONTROLS, type TimeControlId } from '../model/timeControls'
import { GlassSegmentedControl, type SegmentedOption } from '@/shared/ui'
import styles from './TimeControlPicker.module.css'

const OPTIONS: readonly SegmentedOption<TimeControlId>[] = TIME_CONTROLS.map(({ id }) => ({
  value: id,
  label: id === 'none' ? 'Без часов' : id,
}))

export interface TimeControlPickerProps {
  value: TimeControlId
  onChange: (id: TimeControlId) => void
}

/** Выбор контроля времени; показывается до первого хода. */
export function TimeControlPicker({ value, onChange }: TimeControlPickerProps) {
  return (
    <div className={styles.picker}>
      <span className={styles.caption}>Контроль времени</span>
      <div className={styles.wrap}>
        <GlassSegmentedControl
          label="Контроль времени"
          value={value}
          options={OPTIONS}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
