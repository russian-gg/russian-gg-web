import { useEffect, useState } from 'react'
import { adminFetch, formatDate, formatDateTime, formatNumber, useAdminQuery } from '../lib/api'
import type {
  MarketingCategory,
  MarketingDirection,
  MarketingExpectation,
  MarketingMetric,
  MarketingPlan,
  MarketingPlanSummary,
  MarketingStatus,
} from '../lib/types'
import {
  Badge,
  Button,
  Card,
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  SectionHeading,
} from '../components/ui'
import { cx } from '../../src/lib/cx'

const PROGRAMME_WEEKS = 12

const statusLabel: Record<MarketingStatus, string> = {
  Proposed: 'Taklif qilindi',
  Accepted: 'Qabul qilindi',
  Executed: 'Ishga tushirildi',
  Reviewed: "O'lchandi",
  Dismissed: 'Rad etildi',
}

const statusTone = {
  Proposed: 'signal',
  Accepted: 'signal',
  Executed: 'caution',
  Reviewed: 'milestone',
  Dismissed: 'neutral',
} as const

const categoryLabel: Record<MarketingCategory, string> = {
  Ugc: 'UGC',
  Content: 'Kontent',
  Paid: "Pullik reklama",
  Product: 'Mahsulot',
  Retention: 'Ushlab qolish',
  Pricing: 'Narx',
  Partnership: 'Hamkorlik',
}

const effortLabel = { Low: 'Yengil', Medium: "O'rtacha", High: "Og'ir" } as const

const metricLabel: Record<MarketingMetric, string> = {
  TotalUsers: 'Jami foydalanuvchi',
  NewUsers: 'Yangi (7 kun)',
  Dau: 'DAU',
  Wau: 'WAU',
  Mau: 'MAU',
  DayRetention: 'Kunlik ushlab qolish',
  WeekRetention: 'Haftalik ushlab qolish',
  MonthRetention: 'Oylik ushlab qolish',
  PaidUsers: 'Pullik obunachi',
  RevenueUzs: 'Daromad (UZS)',
  PaidTransactions: 'To’lovlar soni',
  CompletedMissions: 'Tugatilgan mashqlar',
}

const isPercent = (metric: MarketingMetric) =>
  metric === 'DayRetention' || metric === 'WeekRetention' || metric === 'MonthRetention'

const formatMetric = (metric: MarketingMetric, value: number) =>
  isPercent(metric) ? `${value.toFixed(1)}%` : formatNumber(Math.round(value))

const arrow: Record<MarketingDirection, string> = { Up: '↑', Down: '↓', Flat: '→' }

export function Marketing() {
  const { data, error, isLoading, refresh } = useAdminQuery<MarketingPlanSummary[]>('/api/admin-portal/marketing')
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  // The newest week is what an operator came to look at.
  useEffect(() => {
    if (data && data.length > 0 && selected === null) setSelected(data[0].id)
  }, [data, selected])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const done = data.filter((plan) => plan.status !== 'Dismissed').length
  /*
   * Only a week that is out and not yet measured stands in the way. Agreeing with a plan is
   * not doing the work, and blocking on that asked an operator to mark work done that they
   * had not done just to get a second opinion.
   */
  const measuring = data.find((plan) => plan.status === 'Executed')

  async function generate() {
    setBusy(true)
    setFailure('')
    try {
      const plan = await adminFetch<MarketingPlan>('/api/admin-portal/marketing/generate', { method: 'POST' })
      refresh()
      setSelected(plan.id)
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Reja tuzilmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Marketing strategiya"
          subtitle="Paneldagi raqamlardan chiqadigan 12 haftalik reja"
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-muted">
            {done}/{PROGRAMME_WEEKS} hafta
          </span>
          <Button onClick={generate} disabled={busy || Boolean(measuring) || done >= PROGRAMME_WEEKS}>
            {busy ? 'Tuzilmoqda…' : 'Yangi hafta tuzish'}
          </Button>
        </div>
      </div>

      {failure && <ErrorNote>{failure}</ErrorNote>}

      {/* Said where the button is, not after it fails, and it says what to do about it. */}
      {measuring && (
        <p className="text-sm text-ink-muted">
          {measuring.weekNumber}-hafta hozir o'lchanmoqda. Uni o'lchab bo'lgach yangi hafta
          tuziladi — kutish shart emas, "Hozir o'lchash"ni bosing.
        </p>
      )}

      {data.length === 0 ? (
        <Card>
          <EmptyNote>
            Hali reja yo'q. "Yangi hafta tuzish" bosilganda model paneldagi joriy raqamlarni
            o'qib, birinchi haftani yozadi.
          </EmptyNote>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            <SectionHeading>Haftalar</SectionHeading>
            {data.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                className={cx(
                  'block w-full rounded-[var(--radius-card)] border-2 p-4 text-left transition-colors',
                  selected === plan.id
                    ? 'border-signal bg-signal-soft/40'
                    : 'border-hairline bg-ground-raised hover:border-ink-faint',
                  // Kept, because a plan that was turned down is worth remembering — but the
                  // live week for that slot is the one being read.
                  plan.status === 'Dismissed' && 'opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-extrabold text-ink">{plan.weekNumber}-hafta</span>
                  <Badge tone={statusTone[plan.status]}>{statusLabel[plan.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{plan.headlineUz}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {plan.initiativeCount} ta tashabbus · {formatDate(plan.generatedAt)}
                </p>
              </button>
            ))}
          </div>

          {selected && <PlanDetail planId={selected} onChanged={refresh} />}
        </div>
      )}
    </div>
  )
}

function PlanDetail({ planId, onChanged }: { planId: string; onChanged: () => void }) {
  const { data, error, isLoading, refresh } = useAdminQuery<MarketingPlan>(
    `/api/admin-portal/marketing/${planId}`,
  )
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const plan = data

  async function act(action: 'accept' | 'execute' | 'dismiss' | 'review' | 'regenerate') {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/marketing/${planId}/${action}`, { method: 'POST' })
      refresh()
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Bajarilmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">
                {plan.weekNumber}-hafta
              </span>
              <Badge tone={statusTone[plan.status]}>{statusLabel[plan.status]}</Badge>
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-ink">{plan.headlineUz}</h2>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink">{plan.situationUz}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {plan.status === 'Proposed' && (
            <>
              <Button size="sm" onClick={() => act('accept')} disabled={busy}>
                Qabul qilish
              </Button>
              {/* Another take on the same week — it does not spend one of the twelve. */}
              <Button size="sm" variant="secondary" onClick={() => act('regenerate')} disabled={busy}>
                Boshqa variant
              </Button>
            </>
          )}
          {(plan.status === 'Proposed' || plan.status === 'Accepted') && (
            <>
              <Button size="sm" variant="secondary" onClick={() => act('execute')} disabled={busy}>
                Ishga tushirdik
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act('dismiss')} disabled={busy}>
                Rad etish
              </Button>
            </>
          )}
          {(plan.status === 'Executed' || plan.status === 'Reviewed') && (
            <Button size="sm" variant="secondary" onClick={() => act('review')} disabled={busy}>
              {plan.status === 'Reviewed' ? "Qayta o'lchash" : "Hozir o'lchash"}
            </Button>
          )}
        </div>

        {plan.status === 'Executed' && plan.reviewDueAt && (
          <p className="mt-3 text-xs text-ink-faint">
            {formatDate(plan.reviewDueAt)} da avtomatik o'lchanadi.
          </p>
        )}

        {failure && (
          <div className="mt-3">
            <ErrorNote>{failure}</ErrorNote>
          </div>
        )}
      </Card>

      {plan.reviewedAt && (
        <Card className="border-milestone">
          <SectionHeading>Natija · {formatDateTime(plan.reviewedAt)}</SectionHeading>
          {plan.reviewUz ? (
            <p className="text-sm leading-relaxed text-ink">{plan.reviewUz}</p>
          ) : (
            <p className="text-sm text-ink-muted">
              Model izoh yozmadi, lekin o'lchovlar quyida — ular kodda hisoblanadi.
            </p>
          )}
          {/*
            Said once, where the numbers are. A metric moving in the same week is not proof
            this work moved it, and a panel that implies otherwise turns a reading into a
            claim nobody checked.
          */}
          <p className="mt-3 text-xs text-ink-faint">
            Metrikaning o'zgarishi bu ish sabab bo'lganini isbotlamaydi — bir haftada boshqa
            narsalar ham sodir bo'ladi.
          </p>
        </Card>
      )}

      {plan.initiatives.map((initiative) => (
        <Card key={initiative.id}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-extrabold text-on-signal">
              {initiative.priority}
            </span>
            <h3 className="min-w-0 flex-1 text-base font-extrabold text-ink">{initiative.titleUz}</h3>
            <Badge tone="signal">{categoryLabel[initiative.category]}</Badge>
            <Badge>{effortLabel[initiative.effort]}</Badge>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-ink">{initiative.actionUz}</p>

          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            <span className="font-bold text-ink">Nega: </span>
            {initiative.rationaleUz}
          </p>

          <p className="mt-2 text-xs text-ink-faint">Boshlash: {formatDate(initiative.launchOn)}</p>

          {initiative.expectations.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">
                Kutilgan natija
              </div>
              {initiative.expectations.map((expectation) => (
                <Forecast key={expectation.metric} expectation={expectation} />
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function Forecast({ expectation }: { expectation: MarketingExpectation }) {
  const { metric, baselineValue, expectedValue, direction, confidence, measuredValue } = expectation
  const measured = measuredValue ?? null

  /*
   * Hit when the metric moved at least as far as the forecast asked, in the direction it
   * asked. A forecast of "up to 42" that landed on 45 was right; one that landed on 39 was
   * not, and rounding that into a pass would make the whole loop worthless.
   */
  const hit =
    measured === null
      ? null
      : direction === 'Up'
        ? measured >= expectedValue
        : direction === 'Down'
          ? measured <= expectedValue
          : Math.abs(measured - baselineValue) <= Math.max(1, Math.abs(baselineValue) * 0.05)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-ground-sunken px-3 py-2">
      <span className="min-w-0 flex-1 text-sm text-ink">{metricLabel[metric]}</span>

      <span className="text-sm tabular-nums text-ink-muted">
        {formatMetric(metric, baselineValue)} {arrow[direction]} {formatMetric(metric, expectedValue)}
      </span>

      <span className="text-xs text-ink-faint">{confidence}%</span>

      {measured !== null && (
        <span
          className={cx(
            'rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-bold tabular-nums',
            hit ? 'bg-milestone-soft text-milestone' : 'bg-caution-soft text-caution',
          )}
        >
          {formatMetric(metric, measured)}
        </span>
      )}
    </div>
  )
}
