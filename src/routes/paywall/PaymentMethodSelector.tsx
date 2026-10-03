import type { ReactNode } from 'react'
import { useT } from '../../lib/i18n'
import type { PaymentProvider } from '../../lib/types'
import { cx } from '../../lib/cx'
import clickMark from '../../assets/images/click_mark.webp'
import paymeMark from '../../assets/images/payme_mark.webp'
import paymeWordmark from '../../assets/images/payme_wordmark.webp'

/**
 * Which provider takes the money.
 *
 * These are selectors, not actions. The screen used to end in two full-width buttons — "pay
 * with Click" above "pay with Payme" — which put two primary calls to action on a checkout and
 * made the choice of provider and the decision to buy the same press. Splitting them means one
 * decision at a time: pick a provider here, then commit once, below.
 */
export function PaymentMethodSelector({
  provider,
  onSelect,
}: {
  provider: PaymentProvider
  onSelect: (provider: PaymentProvider) => void
}) {
  const t = useT()

  return (
    <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label={t.billing.paymentMethod}>
      <PaymentMethodCard
        value="click"
        checked={provider === 'click'}
        onSelect={() => onSelect('click')}
        name="Click"
        hint={t.billing.clickHint}
        mark={<BrandMark src={clickMark} className="h-9" />}
        showcase={<BrandMark src={clickMark} className="h-14" />}
      />
      <PaymentMethodCard
        value="payme"
        checked={provider === 'payme'}
        onSelect={() => onSelect('payme')}
        name="Payme"
        hint={t.billing.paymeHint}
        mark={<BrandMark src={paymeMark} className="h-8" />}
        showcase={<BrandMark src={paymeWordmark} className="h-8" />}
      />
    </div>
  )
}

/**
 * One provider.
 *
 * Same construction as a plan card, and deliberately so: a real radio under a label that
 * covers the whole surface. Two different-looking ways to choose one thing out of two, on one
 * screen, would be two things for the reader to learn.
 *
 * The provider name is a proper noun and stays in Latin script in every locale — it is what is
 * printed on the app the learner is about to be sent to.
 */
function PaymentMethodCard({
  value,
  checked,
  onSelect,
  name,
  hint,
  mark,
  showcase,
}: {
  value: PaymentProvider
  checked: boolean
  onSelect: () => void
  name: string
  hint: string
  mark: ReactNode
  /** The large mark at the trailing edge. Decoration; drops out when there is no room. */
  showcase: ReactNode
}) {
  return (
    <label
      className={cx(
        'raised relative flex cursor-pointer items-center gap-3.5 overflow-hidden rounded-[var(--radius-card)] border-2 p-4',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-signal',
        /*
          Room for the showcase mark, only at the sizes where it is actually drawn. Wide enough
          for the Payme wordmark rather than for Click's square symbol — the reserve has to fit
          the larger of the two, and the Russian hints run longer than the Uzbek ones, so there
          is no slack to borrow from the text column.
        */
        'lg:pr-40',
        checked
          ? 'border-signal bg-signal-soft/60 raised-signal-soft'
          : 'border-hairline bg-ground-raised hover:border-ink-faint',
      )}
    >
      <input
        type="radio"
        name="payment-provider"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />

      <span
        aria-hidden="true"
        className={cx(
          'grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
          checked ? 'border-signal bg-signal' : 'border-hairline bg-ground',
        )}
      >
        {checked && <span className="size-1.5 rounded-full bg-on-signal" />}
      </span>

      <span aria-hidden="true" className="shrink-0">
        {mark}
      </span>

      <span className="min-w-0">
        <span className="block text-lg leading-tight font-extrabold text-ink">{name}</span>
        <span className="text-support mt-0.5 block text-sm leading-snug">{hint}</span>
      </span>

      {/*
        The same mark again, large, at the trailing edge — the reference's way of giving each
        card a face. Only from `lg`: below that the width goes to the description, which is the
        part that says something, and a second copy of a logo the reader is already looking at
        is the first thing that should go.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 lg:block"
      >
        {showcase}
      </span>
    </label>
  )
}

/* ----------------------------------------------------------------------------- marks */

/**
 * A provider's own logo.
 *
 * These are the vendors' real marks, supplied as artwork and trimmed to their ink — not
 * redrawings. That matters on a checkout more than anywhere else in the product: the learner
 * is about to be handed to one of these companies, and the mark they see here is the promise
 * that it will be the same one they land on.
 *
 * Sized by height only, with the width left free, so neither logo can be squashed — Click's is
 * square and Payme's is a wordmark two and a half times as wide as it is tall, and a single
 * `size-*` on both would have distorted one of them.
 *
 * `aria-hidden`, because the provider's name is written beside it. A captioned logo is
 * decoration; announcing it would say the name twice.
 */
function BrandMark({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      className={cx('w-auto max-w-none shrink-0 object-contain', className)}
    />
  )
}
