import { ArrowRight, CreditCard, Loader2 } from 'lucide-react'
import { fill, useT } from '../../lib/i18n'
import type { PaymentProvider } from '../../lib/types'
import { Button } from '../../components/ui'

/**
 * The one commitment on the screen.
 *
 * It names the provider and the exact figure that will be charged, both read from state, so
 * the button is a statement of what is about to happen rather than a generic "continue" that
 * the buyer has to reconcile with the numbers above it.
 *
 * Disabled while a checkout is in flight. That is the duplicate-submission guard: this
 * navigates away to a payment page, and a second press before the redirect lands would open a
 * second invoice for the same purchase.
 */
export function PaymentButton({
  provider,
  amount,
  busy,
  onPay,
}: {
  provider: PaymentProvider
  /** Already formatted, so the button never does money arithmetic of its own. */
  amount: string
  busy: boolean
  onPay: () => void
}) {
  const t = useT()
  const label = fill(provider === 'click' ? t.billing.payWithClick : t.billing.payWithPayme, {
    amount,
  })

  return (
    <Button
      size="lg"
      block
      disabled={busy}
      onClick={onPay}
      /*
        The label is long — a verb, a provider and a formatted price — and longer still in
        Russian. `Button` is a fixed-height pill that never wraps, which is right for every
        other control in the product and wrong for this one: on a 360px phone the price ran
        past the end and was replaced by an ellipsis, and the amount is the single word on this
        button that must not be lost.

        So it wraps instead of truncating, and grows to fit. `min-h` keeps the usual size on
        every screen wide enough for one line, which is most of them.
      */
      className="h-auto min-h-14 px-4 py-3 text-[15px] sm:px-7 sm:text-base"
      /* The label already carries the provider and the amount, so it is its own accessible
         name; while busy it reads as the waiting state instead. */
      aria-label={busy ? t.billing.opening : label}
    >
      {busy ? (
        <>
          <Loader2 aria-hidden="true" className="size-5 shrink-0 animate-spin" />
          {t.billing.opening}
        </>
      ) : (
        <>
          {/* Decoration, and the first thing to go when the label needs the room. */}
          <CreditCard aria-hidden="true" strokeWidth={2} className="hidden size-5 shrink-0 sm:block" />
          {/* `white-space` is inherited, so setting it here beats the nowrap the button sets on
              itself — no specificity fight with `Button`'s own class list, which is plain
              concatenation and has no merge step to resolve a conflict. */}
          <span className="text-center whitespace-normal">{label}</span>
          <ArrowRight aria-hidden="true" strokeWidth={2.2} className="size-5 shrink-0" />
        </>
      )}
    </Button>
  )
}
