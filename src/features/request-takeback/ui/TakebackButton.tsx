import { GlassButton } from '@/shared/ui'

export interface TakebackButtonProps {
  /** Отменять нечего: игрок ещё не ходил или партия окончена. */
  disabled?: boolean | undefined
  onTakeback: () => void
}

/** «Отменить ход»: возвращает игроку право хода (только против бота). */
export function TakebackButton({ disabled, onTakeback }: TakebackButtonProps) {
  return (
    <GlassButton disabled={disabled ?? false} onClick={onTakeback}>
      Отменить ход
    </GlassButton>
  )
}
