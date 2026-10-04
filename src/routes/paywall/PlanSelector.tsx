import { formatPrice } from '../../lib/format'
import { fill, useLocale, useT } from '../../lib/i18n'
import type { BillingPeriod, PlanOption } from '../../lib/types'
import { Badge } from '../../components/ui'
import { cx } from '../../lib/cx'
import monthArtwork from '../../assets/images/paywall_1.webp'
import ninetyDayArtwork from '../../assets/images/paywall_3.webp'

/**
 * How long a period runs, for the per-day and per-month arithmetic.
 *
 * Both live here rather than on the page, because they are only ever used to caption a plan
 * card. The server quotes one number — the price of the period — and everything else on the
 * card is derived from it, so there is exactly one place where that derivation can be wrong.
 */
const daysForPeriod = (period: BillingPeriod) => (period === 'Monthly' ? 30 : 90)
const monthsForPeriod = (period: BillingPeriod) => (period === 'Monthly' ? 1 : 3)

const perDayAmountTiyin = (amountTiyin: number, period: BillingPeriod) =>
  Math.max(1, Math.round(amountTiyin / daysForPeriod(period)))

const perMonthAmountTiyin = (amountTiyin: number, period: BillingPeriod) =>
  Math.max(1, Math.round(amountTiyin / monthsForPeriod(period)))

/** What a plan costs once every discount that applies to it has been taken off. */
export type PlanPricing = {
  /** What the server lists it at, shown struck through when something has come off. */
  listAmountTiyin: number
  /** What would actually be charged. */
  amountTiyin: number
  currency: string
  /** 0 when nothing has come off. */
  discountPercent: number
}

/**
 * The choice of plan, with the artwork for whichever one is up.
 *
 * Two cards and a picture. The cards are real radios — see `PlanCard` — and the picture is the
 * calendar for the selected period, so the illustration is a readout of the choice rather than
 * decoration that happens to sit nearby.
 */
export function PlanSelector({
  options,
  period,
  onSelect,
  pricingFor,
}: {
  options: PlanOption[]
  period: BillingPeriod
  onSelect: (period: BillingPeriod) => void
  pricingFor: (option: PlanOption) => PlanPricing
}) {
  const t = useT()

  return (
    /*
      The artwork takes a fixed column from `lg` and the cards take the rest. Below that it
      drops under them — a decorative picture is the first thing that should give up width,
      and on a phone it is the first thing that should be scrolled past rather than the thing
      standing between the heading and the prices.

      Its column grows again at `xl`. The screen fills the shell, which runs to 96rem, and a
      fixed 20rem of picture against everything else leaves two plan cards nearly 600px wide
      apiece — a card holding four short lines, stretched across half a desktop. Giving the
      artwork the extra width keeps the cards at a size their contents justify.
    */
    <div className="grid items-center gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:gap-10">
      <div
        className="grid gap-4 sm:grid-cols-2"
        role="radiogroup"
        aria-label={t.billing.title}
      >
        {options.map((option) => (
          <PlanCard
            key={option.period}
            option={option}
            checked={period === option.period}
            onSelect={() => onSelect(option.period)}
            pricing={pricingFor(option)}
          />
        ))}
      </div>

      <SubscriptionIllustration period={period} />
    </div>
  )
}

/**
 * One plan.
 *
 * A real `<input type="radio">` under the surface, hidden but present. The whole card is the
 * label, so the whole card is clickable — and arrow-key navigation between the two, the
 * grouped announcement, and the focus ring all come from the input rather than from a pile of
 * `role` and `onKeyDown` that would have to reimplement them.
 *
 * The selection is never colour alone: the radio fills, the border changes weight, and the
 * input's own checked state is what a screen reader reads.
 */
function PlanCard({
  option,
  checked,
  onSelect,
  pricing,
}: {
  option: PlanOption
  checked: boolean
  onSelect: () => void
  pricing: PlanPricing
}) {
  const t = useT()
  const { locale } = useLocale()

  const money = (amount: number) => formatPrice(amount, pricing.currency, locale)
  const discounted = pricing.amountTiyin !== pricing.listAmountTiyin

  return (
    <label
      className={cx(
        'raised relative flex cursor-pointer flex-col rounded-[var(--radius-card)] border-2 p-5',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-signal',
        checked
          ? 'border-signal bg-signal-soft/60 raised-signal-soft'
          : 'border-hairline bg-ground-raised hover:border-ink-faint',
      )}
    >
      <input
        type="radio"
        name="billing-period"
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />

      <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <span className="text-[15px] font-bold text-ink">{t.billing.periodLabel[option.period]}</span>

        <span className="ml-auto flex shrink-0 items-center gap-2">
          {option.savingsPercent > 0 && (
            <Badge tone="signal">{fill(t.billing.savings, { percent: option.savingsPercent })}</Badge>
          )}
          <span
            aria-hidden="true"
            className={cx(
              'grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
              checked ? 'border-signal bg-signal' : 'border-hairline bg-ground',
            )}
          >
            {checked && <span className="size-1.5 rounded-full bg-on-signal" />}
          </span>
        </span>
      </span>

      {/* The headline price. Struck through beside the new one when a code or a gift has
          come off it, so the reduction is visible rather than merely asserted. */}
      <span className="mt-2 flex flex-wrap items-end gap-x-2.5 gap-y-1">
        {discounted && (
          <span className="text-base font-bold text-ink-faint line-through decoration-2">
            {money(pricing.listAmountTiyin)}
          </span>
        )}
        <span className="text-2xl leading-none font-extrabold tracking-tight text-ink">
          {money(pricing.amountTiyin)}
        </span>
        {discounted && pricing.discountPercent > 0 && (
          <Badge tone="milestone">
            {fill(t.billing.promoPercent, { percent: pricing.discountPercent })}
          </Badge>
        )}
      </span>

      {/*
        The per-day figure, given the weight of the real headline. The period price is what is
        charged, but "about four thousand a day" is the number somebody actually judges the
        offer by, and it is the only way the two plans can be compared at all — 119,000 against
        299,000 says nothing until both are divided.
      */}
      <span className="mt-4 block border-t border-hairline pt-4">
        <span className="flex flex-wrap items-end gap-x-1">
          <span className="text-[1.75rem] leading-none font-extrabold tracking-tight text-ink">
            {money(perDayAmountTiyin(pricing.amountTiyin, option.period))}
          </span>
          <span className="text-base font-bold text-ink-muted">{t.dayPreview.perDay}</span>
        </span>
      </span>

      <span className="text-support mt-2 block space-y-0.5 text-sm">
        {option.period === 'NinetyDay' && (
          <span className="block">
            {fill(t.billing.perMonth, {
              amount: money(perMonthAmountTiyin(pricing.amountTiyin, option.period)),
            })}
          </span>
        )}
        <span className="block">
          {fill(t.billing.perDay, {
            amount: money(perDayAmountTiyin(pricing.amountTiyin, option.period)),
          })}
        </span>
      </span>
    </label>
  )
}

/**
 * The calendar for the chosen period.
 *
 * Two pictures, one per plan, swapped on the key so the change reads as a different object
 * arriving rather than one image dissolving into a near-identical one. Purely decorative — the
 * card beside it already says which plan is selected, and it is `aria-hidden` for that reason.
 *
 * Hidden below `sm`: at phone width it would take a third of the screen between the heading
 * and the prices, which is the wrong thing to spend a first screenful on.
 */
function SubscriptionIllustration({ period }: { period: BillingPeriod }) {
  return (
    <img
      key={period}
      src={period === 'Monthly' ? monthArtwork : ninetyDayArtwork}
      alt=""
      aria-hidden="true"
      decoding="async"
      className="mx-auto hidden w-48 sm:block xl:w-full"
    />
  )
}
