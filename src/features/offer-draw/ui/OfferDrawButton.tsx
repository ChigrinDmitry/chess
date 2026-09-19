import { GlassButton } from '@/shared/ui'

export interface OfferDrawButtonProps {
  disabled?: boolean | undefined
  onOffer: () => void
}

export function OfferDrawButton({ disabled, onOffer }: OfferDrawButtonProps) {
  return (
    <GlassButton disabled={disabled ?? false} onClick={onOffer}>
      Предложить ничью
    </GlassButton>
  )
}
