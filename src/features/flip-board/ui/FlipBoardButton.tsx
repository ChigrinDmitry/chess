import { GlassButton, type GlassButtonProps } from '@/shared/ui'

export type FlipBoardButtonProps = Omit<GlassButtonProps, 'children' | 'onClick'> & {
  onFlip: () => void
}

export function FlipBoardButton({ onFlip, ...rest }: FlipBoardButtonProps) {
  return (
    <GlassButton {...rest} onClick={onFlip}>
      ⇅ Перевернуть доску
    </GlassButton>
  )
}
