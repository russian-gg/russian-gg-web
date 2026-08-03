import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { formatDate } from '../lib/format'
import { useLocale, useT, type Dictionary } from '../lib/i18n'
import type { EntitlementView, ProgressView, SubscriptionStatus } from '../lib/types'
import { Badge, Button, Card, Rule, SectionHeading, Spinner, UzHint } from '../components/ui'

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

/**
 * The learner's own record: who they are, where they stand, what they have paid for. Kept
 * separate from Settings, which is switches and consents — this page answers "who am I here",
 * not "what do I want changed".
 */
export function Profile() {
  const t = useT()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    staleTime: 60_000,
    retry: false,
  })

  if (progressLoading) return <Spinner />

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || t.account.learner
  const initials = name.trim().slice(0, 2).toUpperCase()

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-4">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-signal text-xl font-semibold text-on-signal"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{name}</h1>
          <p className="text-support truncate">{user?.email}</p>
        </div>
      </header>

      <section>
        <SectionHeading>{t.profile.level}</SectionHeading>
        <Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <LevelStat label={t.progress.comprehension} level={progress?.comprehensionLevel} t={t} />
            <LevelStat label={t.progress.speaking} level={progress?.speakingLevel} t={t} />
          </div>
          <UzHint>
            {t.profile.levelNote}
          </UzHint>
        </Card>
      </section>

      <section>
        <SectionHeading>{t.profile.coursePosition}</SectionHeading>
        <Card>
          <dl className="grid gap-5 sm:grid-cols-3">
            <Stat
              label={t.profile.currentDay}
              value={progress ? `${progress.currentDay}/90` : null}
              hint={progress ? t.labels.phase[progress.phase] : undefined}
            />
            <Stat label={t.profile.missionsDone} value={progress?.totalMissionsCompleted ?? null} />
            <Stat
              label={t.profile.streakDays}
              value={progress?.streakDays ?? null}
              hint={progress && progress.streakDays > 0 ? t.profile.keepGoing : undefined}
            />
          </dl>
        </Card>
      </section>

      <section>
        <SectionHeading>{t.profile.subscription}</SectionHeading>
        <Card>
          {entitlement ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-semibold text-ink">{entitlement.tier}</span>
                <Badge tone={entitlement.hasProAccess ? 'signal' : 'neutral'}>
                  {statusLabel(entitlement.status, t)}
                </Badge>
                {entitlement.paymentProcessing && <Badge tone="caution">{t.profile.paymentChecking}</Badge>}
              </div>

              <Rule className="my-4" />

              <dl className="grid gap-5 sm:grid-cols-2">
                <Stat label={t.profile.unlockedDays} value={`${entitlement.maxUnlockedDay}/90`} />
                <Stat
                  label={entitlement.cancelAtPeriodEnd ? t.profile.validUntil : t.profile.nextPayment}
                  value={
                    entitlement.currentPeriodEnd
                      ? formatDate(entitlement.currentPeriodEnd, locale)
                      : entitlement.trialEndsAt
                        ? formatDate(entitlement.trialEndsAt, locale)
                        : null
                  }
                />
              </dl>
            </>
          ) : (
            <p className="text-support">{t.profile.subscriptionUnavailable}</p>
          )}

          <Button variant="secondary" className="mt-5" onClick={() => navigate('/paywall')}>
            {t.profile.manage}
          </Button>
        </Card>
      </section>

      <section>
        <SectionHeading>{t.profile.account}</SectionHeading>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => navigate('/settings')}>
            {t.account.settings}
          </Button>
          <Button variant="ghost" onClick={() => void signOut().then(() => navigate('/'))}>
            {t.account.signOut}
          </Button>
        </div>
        <p className="text-support mt-3">
          {t.profile.accountNote}
        </p>
      </section>
    </div>
  )
}

function LevelStat({
  label,
  level,
  t,
}: {
  label: string
  level?: ProgressView['speakingLevel']
  t: Dictionary
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">{label}</p>
      {/* Unmeasured is never rendered as a zero or a bottom level (PRD §7). */}
      {level ? (
        <>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">{level}</p>
          <p className="text-support">{t.labels.level[level]}</p>
        </>
      ) : (
        <p className="mt-1 text-3xl font-semibold tracking-tight text-ink-faint">{t.common.notYet}</p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number | null
  hint?: string
}) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-ink">
        {value === null || value === undefined ? <span className="text-ink-faint">—</span> : value}
      </dd>
      {hint && <p className="text-support">{hint}</p>}
    </div>
  )
}
