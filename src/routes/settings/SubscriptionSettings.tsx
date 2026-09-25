import { CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { fill, useLocale, useT, type Dictionary } from '../../lib/i18n'
import type { EntitlementView, SubscriptionStatus } from '../../lib/types'
import { Badge, Button, Card, QueryError, Spinner } from '../../components/ui'
import freeBackdrop from '../../assets/images/subscription_container_bg.webp'
import monthlyBackdrop from '../../assets/images/month_subscription.webp'
import ninetyDayBackdrop from '../../assets/images/3_months_subscription.webp'
import planArtwork from '../../assets/images/subscription_informaton.webp'

/**
 * The plan, what it has unlocked, and what the other plan would add.
 *
 * Four blocks in the order somebody arriving here asks for them: what am I on, how far has
 * that got me, what does it actually include, and what is on the other side. The banner
 * answers the first because it is the one thing a learner opened this tab to check;
 * everything below it is the detail they came for second.
 *
 * Nothing about the account is invented. The tier, the status, the unlocked days and the
 * renewal date all come from `/billing/entitlement`, and the two feature lists are
 * `t.billing.freeLimitItems` and `t.billing.proBenefits` — existing product copy the paywall
 * already renders, so the two screens cannot drift into describing different products.
 *
 * Buying happens on the paywall. This screen answers "what am I on and what else is there";
 * that one takes the payment, and a second checkout is two flows to keep in step.
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
  /* The banner below has a "no subscription" branch. Showing it to somebody who is paying,
     because one request failed, is the one outcome this screen must not produce. */
  if (isError) return <QueryError onRetry={() => void refetch()} />

  if (!entitlement) {
    return (
      <Card>
        <p className="text-support">{t.profile.subscriptionUnavailable}</p>
      </Card>
    )
  }

  const hasPro = entitlement.hasProAccess

  return (
    <div className="space-y-4">
      <CurrentPlanBanner entitlement={entitlement} t={t} />
      <ProgressCard entitlement={entitlement} t={t} />

      {/*
        The plan in hand beside the offer, from `lg`. Two 50/50 columns is the point of the
        pairing — "here is what you have" answered immediately by "here is what you don't" —
        and below `lg` they stack, because a four-item list in a half of a tablet is four
        wrapped fragments.
      */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <FeatureCard
          title={hasPro ? t.billing.proPlanTitle : t.billing.freePlanTitle}
          items={hasPro ? t.billing.proBenefits : t.billing.freeLimitItems}
        />
        {/* Only worth putting to somebody who is not already on it. */}
        {!hasPro && <UpsellCard t={t} />}
      </div>

      {/* The full case for Pro, wide, so the list runs in two columns instead of one long
          leg. Suppressed for a subscriber, who is reading their own list above. */}
      {!hasPro && <FeatureCard title={t.billing.proPlanTitle} items={t.billing.proBenefits} columns />}
    </div>
  )
}

/* -------------------------------------------------------------------------- banner */

/**
 * The artwork for a plan.
 *
 * Three pictures drawn to one template — the subject on the right, an open field on the left —
 * so the banner swaps between them with nothing to re-lay out. A crown for somebody with no
 * subscription, a calendar for a monthly one, and three calendars marked "3 months" for the
 * ninety-day plan, which is the one that covers the whole course.
 *
 * The fallback is the crown, and it is reached in two cases that are worth telling apart. A
 * free account has no plan to picture, and a subscriber whose `period` the server did not send
 * has one this client cannot name — a server older than the field, most likely. Guessing
 * "monthly" there would put a picture of the wrong plan in front of somebody paying for the
 * other one, which is worse than the neutral crown both of them read correctly.
 */
function backdropFor(entitlement: EntitlementView): string {
  if (!entitlement.hasProAccess) return freeBackdrop

  switch (entitlement.period) {
    case 'NinetyDay':
      return ninetyDayBackdrop
    case 'Monthly':
      return monthlyBackdrop
    default:
      return freeBackdrop
  }
}

/**
 * The plan name, large, over the artwork.
 *
 * The picture is laid in as one covering layer with its subject on the right and an open field
 * on its left, so the copy sits over the empty half — the same arrangement as the home hero,
 * and for the same reason: no seam to line up and nothing to keep in step as the card resizes.
 *
 * The status badge carries a word rather than only a colour. "No subscription" and "Active"
 * are different facts, and a grey pill versus a blue one is not a way to tell somebody which
 * of them they are on — and neither is a different picture behind them.
 */
function CurrentPlanBanner({ entitlement, t }: { entitlement: EntitlementView; t: Dictionary }) {
  const { locale } = useLocale()
  const navigate = useNavigate()
  const backdrop = backdropFor(entitlement)

  return (
    <section
      /* No border. The artwork fades to its own pale edge on every side, and a hairline drawn
         round a soft gradient is a box outlining something that has no edge to outline. */
      /* `min-h` so a one-line plan note cannot shrink the banner to a strip: the height is what
         the artwork is scaled by, and a short-copy banner would otherwise show a tiny crown. */
      className="plan-hero relative isolate min-h-[13rem] overflow-hidden rounded-[var(--radius-card)] sm:min-h-[14rem]"
      /* The artwork's own field colour, so the half of the banner the picture does not reach
         is indistinguishable from the half it does. Also what shows while it loads. */
      style={{ background: 'var(--plan-field)' }}
    >
      {/*
        Two arrangements, because a phone and a desktop are not looking at the same shape.

        From `sm` the picture is anchored right and given the banner's full height with its
        width left free, so it keeps its proportions and nothing is cut — see `.plan-hero__art`
        for what that replaced and why.

        On a phone the banner is nearly square and the copy is stacked on top of the picture
        rather than beside it, so the same treatment would blow the subject up to several times
        the banner's width for the sake of a crown nobody can see behind the text. There it
        goes back to covering the box, framed towards the subject.

        Keyed on the source so swapping plans remounts the element rather than repainting one
        in place — a decorative backdrop has no business cross-fading under live copy.
      */}
      <img
        key={backdrop}
        src={backdrop}
        alt=""
        aria-hidden="true"
        decoding="async"
        className={
          'plan-hero__art pointer-events-none absolute -z-10 ' +
          'inset-0 size-full object-cover object-[78%_50%] ' +
          'sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-auto'
        }
      />

      <div aria-hidden="true" className="plan-hero__scrim pointer-events-none absolute inset-0 -z-10" />

      <div className="relative px-6 py-7 sm:max-w-[60%] sm:px-8 sm:py-9">
        {/* Sentence case at body size, not the uppercase micro-label the cards below use.
            This one sits on artwork rather than on a card, and it reads as the first line of a
            sentence that the tier name finishes. */}
        <p className="text-base leading-none" style={{ color: 'var(--plan-ink-muted)' }}>
          {t.profile.currentPlan}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className="text-[2.5rem] leading-none font-extrabold tracking-tight sm:text-5xl"
            style={{ color: 'var(--plan-ink)' }}
          >
            {entitlement.tier}
          </span>
          <PlanPill>{statusLabel(entitlement.status, t)}</PlanPill>
          {entitlement.paymentProcessing && <Badge tone="caution">{t.profile.paymentChecking}</Badge>}
        </div>

        <p
          className="mt-3 max-w-sm text-base leading-relaxed"
          style={{ color: 'var(--plan-ink-muted)' }}
        >
          {planNote(entitlement, t, locale)}
        </p>

        {/* Full width on a phone, hugging its label from `sm` — what this product already says
            a primary action does on a phone; see `block` on `Button`. */}
        <Button block className="mt-6 sm:w-auto sm:px-7" onClick={() => navigate('/paywall')}>
          {t.profile.manage}
        </Button>
      </div>
    </section>
  )
}

/**
 * The status word beside the tier.
 *
 * Not `Badge`, which is built for a card: its neutral tone is grey on grey and its shape is
 * the control radius, and both are wrong against artwork. This one is drawn in the banner's
 * own palette — a soft pill in the sky colour, lettered in the same muted ink as the line
 * under it — so it belongs to the picture rather than sitting on top of it.
 *
 * It carries a word, not only a colour: "No subscription" and "Active" are different facts,
 * and a paler pill is not a way to tell somebody which of them they are on.
 */
function PlanPill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-bold"
      style={{ background: 'var(--plan-pill)', color: 'var(--plan-ink-muted)' }}
    >
      {children}
    </span>
  )
}

/**
 * The one line under the plan name.
 *
 * On free it is an invitation, and it makes no claim about limits — the card below states
 * those, from the product's own list, and saying it twice in two wordings is how two
 * descriptions of one plan end up disagreeing. On a paid plan it is the fact that matters:
 * when it runs out, and whether it is going to renew. Every paid branch is existing
 * dictionary copy filled with a date the server sent.
 */
function planNote(
  entitlement: EntitlementView,
  t: Dictionary,
  locale: Parameters<typeof formatDate>[1],
): string {
  if (!entitlement.hasProAccess) return t.billing.planTagline
  if (entitlement.cancelAtPeriodEnd) return t.billing.cancelled

  const until = entitlement.currentPeriodEnd ?? entitlement.trialEndsAt
  /* No date to quote, so it falls back to how cancelling works — true of every paid plan, and
     better than an "active until —" with a dash where the date should be. */
  if (!until) return t.billing.cancelNote

  return fill(entitlement.status === 'Trialing' ? t.billing.trialUntil : t.billing.activeUntil, {
    date: formatDate(until, locale),
  })
}

/* ------------------------------------------------------------------------ progress */

/**
 * How much of the ninety days the plan has opened, and when money is next involved.
 *
 * The bar is the point. "3/90" is a fraction somebody has to do arithmetic on; the same
 * number drawn as a track is read at a glance, and this screen exists to be glanced at.
 *
 * No icons on either figure. There are two of them, they are already named, and a pictogram
 * beside a number this large is decoration competing with the thing it decorates — the rule
 * between the columns does the separating that the icon tiles were doing by accident.
 */
function ProgressCard({ entitlement, t }: { entitlement: EntitlementView; t: Dictionary }) {
  const { locale } = useLocale()
  const unlocked = Math.max(0, Math.min(90, entitlement.maxUnlockedDay))
  const percent = Math.round((unlocked / 90) * 100)

  const nextDate = entitlement.currentPeriodEnd ?? entitlement.trialEndsAt ?? null

  return (
    <Card>
      <h2 className="text-lg font-extrabold tracking-tight text-ink">{t.billing.yourProgress}</h2>

      {/* The divider is horizontal when they stack and vertical when they sit side by side,
          which `divide-*` handles without a second element to position. */}
      <div className="mt-5 grid divide-y divide-hairline sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="pb-4 sm:pr-8 sm:pb-0">
          <p className="text-xs font-extrabold tracking-[0.1em] text-ink-faint uppercase">
            {t.profile.unlockedDays}
          </p>
          <p className="mt-1 text-3xl leading-none font-extrabold tabular-nums text-ink">
            {unlocked}/90
          </p>
          <div
            aria-hidden="true"
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ground-sunken"
          >
            <div className="h-full rounded-full bg-signal" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="pt-4 sm:pt-0 sm:pl-8">
          <p className="text-xs font-extrabold tracking-[0.1em] text-ink-faint uppercase">
            {entitlement.cancelAtPeriodEnd ? t.profile.validUntil : t.profile.nextPayment}
          </p>
          <p
            className={
              nextDate
                ? 'mt-1 text-3xl leading-none font-extrabold tabular-nums text-ink'
                : 'mt-1 text-3xl leading-none font-extrabold text-ink-faint'
            }
          >
            {nextDate ? formatDate(nextDate, locale) : '—'}
          </p>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------------ features */

/**
 * What a plan covers.
 *
 * `columns` splits the list in two from `sm`. A six-item list down one side of a full-width
 * card is a column of text with half a card of nothing beside it; the same six in two legs
 * are read in one pass.
 *
 * The marks are blue, not green. Green is this product's *completion* colour — a finished
 * lesson, a passed step — and a feature list is a description, not an achievement.
 */
function FeatureCard({
  title,
  items,
  columns = false,
}: {
  title: string
  items: readonly string[]
  columns?: boolean
}) {
  return (
    <Card>
      <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>

      <ul className={columns ? 'mt-5 grid gap-2 sm:grid-cols-2 sm:gap-x-8' : 'mt-5 grid gap-2'}>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-[15px] leading-snug text-ink">
            <CircleCheck
              aria-hidden="true"
              strokeWidth={2}
              className="mt-px size-5 shrink-0 text-signal"
            />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* -------------------------------------------------------------------------- upsell */

/**
 * The case for Pro, made once, with the artwork carrying it.
 *
 * Tinted rather than white, because it is the one card on this tab that is asking for
 * something rather than reporting something, and it has to be told apart from the plain
 * statement of fact sitting beside it.
 *
 * The illustration is decorative and marked so. It is `lazy` — it is below the fold at every
 * width this card is drawn at — and it drops out below `sm`, where giving a picture a third of
 * a phone screen pushes the button it is arguing for off the bottom.
 */
function UpsellCard({ t }: { t: Dictionary }) {
  const navigate = useNavigate()

  return (
    <Card className="relative overflow-hidden border-signal-soft bg-signal-soft/70">
      <div className="relative flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">{t.billing.upsellTitle}</h2>
          <p className="text-support mt-1.5 text-sm leading-relaxed">{t.billing.upsellBody}</p>

          <Button block className="mt-5 sm:w-auto sm:px-6" onClick={() => navigate('/paywall')}>
            {t.billing.viewPlans}
          </Button>
        </div>

        {/* Negative margins let it run to the card's own edge rather than sitting inside the
            padding with a gutter of empty tint around it. */}
        <img
          src={planArtwork}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="-my-5 -mr-5 hidden w-44 shrink-0 self-center sm:block lg:w-48"
        />
      </div>
    </Card>
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
