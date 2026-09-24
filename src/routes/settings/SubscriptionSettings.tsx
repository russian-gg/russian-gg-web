import { CalendarClock, Check, LockOpen, Minus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatDate, formatPrice } from '../../lib/format'
import { fill, useLocale, useT, type Dictionary } from '../../lib/i18n'
import type { EntitlementView, PlansView, SubscriptionStatus } from '../../lib/types'
import { Badge, Button, Card, QueryError, SectionHeading, Spinner } from '../../components/ui'
import { StatTile } from './stats'

/**
 * The plan, what it has unlocked, and what happens next.
 *
 * Four questions in the order somebody arriving here asks them: what am I on, how much of the
 * course does that open, when is money next involved, and where do I change it. They were
 * previously one card with the answers in a row, which is the same information with none of
 * the order.
 *
 * Nothing here is invented. The figures come from `/billing/entitlement`, the prices from
 * `/billing/plans`, and the two feature lists are `t.billing.freeLimitItems` and
 * `t.billing.proBenefits` — existing product copy the paywall already renders. Nothing on
 * this screen states a price, a period or an inclusion that is not in one of those.
 *
 * Buying still happens on the paywall. This screen answers "what am I on and what else is
 * there"; that one takes the payment, and duplicating a checkout is how two of them drift.
 */
export function SubscriptionSettings() {
  const t = useT()

  const { data: entitlement, isLoading, isError, refetch } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    staleTime: 60_000,
    retry: false,
  })

  if (isLoading) return <Spinner />
  /* The card below has a "no subscription" branch. Showing it to somebody who is paying,
     because one request failed, is the one outcome this screen must not produce. */
  if (isError) return <QueryError onRetry={() => void refetch()} />

  return (
    <section className="space-y-4">
      <SectionHeading>{t.profile.subscription}</SectionHeading>

      {entitlement ? (
        /*
          Two columns from `xl`, split by what the reader is doing. The left is their account —
          the plan they are on and what it has opened. The right is the offer — what each plan
          includes and what it costs. Stacked, the offer sat below the fold on a laptop, which
          is the one thing on this tab that has to be seen to do anything.
        */
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <CurrentPlanCard entitlement={entitlement} t={t} />
            <UsageSummary entitlement={entitlement} t={t} />
          </div>

          <div className="space-y-4">
            <PlanFeatures hasPro={entitlement.hasProAccess} t={t} />
            {!entitlement.hasProAccess && <PlanOptions t={t} />}
          </div>
        </div>
      ) : (
        <Card>
          <p className="text-support">{t.profile.subscriptionUnavailable}</p>
        </Card>
      )}

      <SubscriptionActions />
    </section>
  )
}

/* ---------------------------------------------------------------------------- plan */

/**
 * The plan name, large, with its state beside it.
 *
 * The tier is the headline because it is the one thing a learner came to check. The status
 * badge carries a word rather than only a colour — "Obuna yo'q" and "Faol" are different
 * facts, and a grey pill versus a blue one is not a way to tell somebody which they are on.
 */
function CurrentPlanCard({ entitlement, t }: { entitlement: EntitlementView; t: Dictionary }) {
  return (
    <Card>
      <p className="text-[11px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">
        {t.profile.currentPlan}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-3xl leading-none font-extrabold text-ink">{entitlement.tier}</span>
        <Badge tone={entitlement.hasProAccess ? 'signal' : 'neutral'}>
          {statusLabel(entitlement.status, t)}
        </Badge>
        {entitlement.paymentProcessing && (
          <Badge tone="caution">{t.profile.paymentChecking}</Badge>
        )}
      </div>
    </Card>
  )
}

/* --------------------------------------------------------------------------- usage */

/**
 * How much of the ninety days the plan has opened, and when money is next involved.
 *
 * The bar is the point. "3/90" is a fraction somebody has to do arithmetic on; the same
 * number drawn as a track is read at a glance, and this screen exists to be glanced at.
 */
function UsageSummary({ entitlement, t }: { entitlement: EntitlementView; t: Dictionary }) {
  const { locale } = useLocale()
  const unlocked = Math.max(0, Math.min(90, entitlement.maxUnlockedDay))
  const percent = Math.round((unlocked / 90) * 100)

  const nextDate = entitlement.currentPeriodEnd ?? entitlement.trialEndsAt ?? null

  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          icon={LockOpen}
          label={t.profile.unlockedDays}
          value={`${unlocked}/90`}
          hint={
            <span
              aria-hidden="true"
              className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-ground-sunken"
            >
              <span
                className="block h-full rounded-full bg-signal"
                style={{ width: `${percent}%` }}
              />
            </span>
          }
        />
        <StatTile
          icon={CalendarClock}
          label={entitlement.cancelAtPeriodEnd ? t.profile.validUntil : t.profile.nextPayment}
          value={nextDate ? formatDate(nextDate, locale) : null}
        />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------------ features */

/**
 * What the current plan includes, and what the other one adds.
 *
 * Both lists are existing dictionary copy — `freeLimitItems` and `proBenefits` — and they are
 * the same two the paywall shows. They are here because "what am I actually on?" is the
 * question this tab is opened with, and a tier name alone does not answer it.
 *
 * Marks are blue, not green. Green is this product's *completion* colour — a finished lesson,
 * a passed step — and a feature list is a description, not an achievement.
 */
function PlanFeatures({ hasPro, t }: { hasPro: boolean; t: Dictionary }) {
  return (
    <Card>
      <p className="text-[11px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">
        {hasPro ? t.billing.proUnlocks : t.billing.freeLimits}
      </p>

      <ul className="mt-3 space-y-2">
        {(hasPro ? t.billing.proBenefits : t.billing.freeLimitItems).map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-ink">
            <Check aria-hidden="true" strokeWidth={2.6} className="mt-0.5 size-4 shrink-0 text-signal-ink" />
            {item}
          </li>
        ))}
      </ul>

      {/* Only worth showing to somebody who is not already on it. */}
      {!hasPro && (
        <>
          <p className="mt-6 text-[11px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">
            {t.billing.proUnlocks}
          </p>
          <ul className="mt-3 space-y-2">
            {t.billing.proBenefits.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-ink-muted">
                <Minus aria-hidden="true" strokeWidth={2.6} className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                {item}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

/* -------------------------------------------------------------------------- prices */

/**
 * The plans that exist, at the prices the server quotes.
 *
 * Read-only, and its own query rather than props: this is the one block on the screen that is
 * not about the learner's current state, and a tab that is mostly entitlement should not wait
 * on a second request before rendering any of it. If the prices do not arrive, the rest of the
 * tab is unaffected and this simply does not appear — no error, because nothing here is
 * broken by not knowing what Pro costs.
 */
function PlanOptions({ t }: { t: Dictionary }) {
  const { locale } = useLocale()
  const { data } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<PlansView>('/billing/plans'),
    staleTime: 60 * 60_000,
    retry: false,
  })

  if (!data || data.options.length === 0) return null

  return (
    <Card>
      <p className="text-[11px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">
        {t.billing.title}
      </p>

      <ul className="mt-3 space-y-2">
        {data.options.map((option) => (
          <li
            key={option.period}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-hairline p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-ink">{t.billing.periodLabel[option.period]}</p>
              {option.effectiveMonthlyTiyin > 0 && (
                <p className="text-support text-xs">
                  {fill(t.billing.perMonth, {
                    amount: formatPrice(option.effectiveMonthlyTiyin, option.currency, locale),
                  })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {option.savingsPercent > 0 && (
                <Badge tone="signal">{fill(t.billing.savings, { percent: option.savingsPercent })}</Badge>
              )}
              <span className="text-base font-extrabold tabular-nums text-ink">
                {formatPrice(option.amountTiyin, option.currency, locale)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------------- actions */

/**
 * Where the money actually changes hands.
 *
 * The prices above are read-only on purpose. Checkout is the paywall's — promo codes, the
 * welcome discount, Click and Payme all live there — and a second checkout is two flows to
 * keep in step for no capability this screen needs.
 */
function SubscriptionActions() {
  const t = useT()
  const navigate = useNavigate()

  return (
    <Button block className="sm:w-auto" onClick={() => navigate('/paywall')}>
      {t.profile.manage}
    </Button>
  )
}

function statusLabel(status: SubscriptionStatus, t: Dictionary): string {
  const map: Record<SubscriptionStatus, string> = {
    None: t.profile.status.none,
    Trialing: t.profile.status.trialing,
    Active: t.profile.status.active,
    PastDue: t.profile.status.pastDue,
    Cancelled: t.profile.status.cancelled,
    Expired: t.profile.status.expired,
  }

  return map[status]
}
