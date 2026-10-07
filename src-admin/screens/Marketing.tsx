import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { adminFetch, formatDate, formatDateTime, formatNumber, useAdminQuery } from '../lib/api'
import type {
  MarketingCategory,
  MarketingRun,
  MarketingRunStep,
  MarketingDirection,
  MarketingExpectation,
  MarketingMetric,
  MarketingPlan,
  MarketingPlanSummary,
  MarketingStatus,
  MarketingUgcVideo,
  MetaMarketingSettings,
} from '../lib/types'
import { Badge, Button, Card, ConfirmDialog, EmptyNote, ErrorNote, Loading, PageHeader, Screen, SectionHeading } from '../components/ui'
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
  SalesConversations: 'Sotuv suhbatlari',
  SalesConversions: "Suhbatdan so'ng to'lov",
}

const isPercent = (metric: MarketingMetric) =>
  metric === 'DayRetention' || metric === 'WeekRetention' || metric === 'MonthRetention'

const formatMetric = (metric: MarketingMetric, value: number) =>
  isPercent(metric) ? `${value.toFixed(1)}%` : formatNumber(Math.round(value))

const arrow: Record<MarketingDirection, string> = { Up: '↑', Down: '↓', Flat: '→' }

export function Marketing() {
  const { data, error, isLoading, refresh } = useAdminQuery<MarketingPlanSummary[]>('/api/admin-portal/marketing')
  const [selected, setSelected] = useState<string | null>(null)
  const [run, setRun] = useState<MarketingRun | null>(null)
  const [failure, setFailure] = useState('')

  const busy = run?.state === 'Running'

  /*
   * Polled rather than streamed. A second is faster than any stage worth watching changes,
   * and it survives the panel being reloaded mid-run — the generation is server-side, so a
   * refreshed page picks the same run back up instead of losing it.
   */
  useEffect(() => {
    if (run?.state !== 'Running') return

    const timer = window.setInterval(() => {
      void adminFetch<MarketingRun>(`/api/admin-portal/marketing/runs/${run.id}`)
        .then(setRun)
        .catch(() => {
          // The run aged out of the server's memory. Whatever it wrote is in the list.
          setRun(null)
          refresh()
        })
    }, 1000)

    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.state])

  useEffect(() => {
    if (run?.state === 'Completed') {
      refresh()
      if (run.planId) setSelected(run.planId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.state, run?.planId])

  /*
   * The newest week is what an operator came to look at — the last one now that the list
   * counts up rather than down.
   *
   * It also has to notice when the open week stops existing: rejecting one deletes it, and
   * without this the panel sat on an id the server would answer 404 for.
   */
  useEffect(() => {
    if (!data || data.length === 0) {
      setSelected(null)

      return
    }

    if (selected === null || !data.some((plan) => plan.id === selected)) {
      setSelected(data[data.length - 1].id)
    }
  }, [data, selected])

  if (error) return <ErrorNote onRetry={refresh}>{error}</ErrorNote>
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
    setFailure('')
    try {
      setRun(await adminFetch<MarketingRun>('/api/admin-portal/marketing/generate', { method: 'POST' }))
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Reja tuzilmadi')
    }
  }

  return (
    <Screen className="space-y-6">
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

      {run && <RunProgress run={run} onDismiss={() => setRun(null)} />}

      <MetaMarketingPanel />

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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
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

          {selected && (
            <PlanDetail
              planId={selected}
              onChanged={refresh}
              onRunStarted={(started) => {
                setFailure('')
                setRun(started)
              }}
            />
          )}
        </div>
      )}
    </Screen>
  )
}

/**
 * The work as it happens. Every line here is a stage the service actually moves through, and
 * the detail under the model step is written from bytes arriving — nothing on this panel
 * advances on a timer.
 */
function RunProgress({ run, onDismiss }: { run: MarketingRun; onDismiss: () => void }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-extrabold text-ink">
          {run.state === 'Running'
            ? 'Reja tuzilmoqda'
            : run.state === 'Completed'
              ? 'Reja tayyor'
              : 'Reja tuzilmadi'}
        </h3>
        {run.state !== 'Running' && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Yopish
          </Button>
        )}
      </div>

      <ol className="mt-4 space-y-3">
        {run.steps.map((step) => (
          <li key={step.key} className="flex items-start gap-3">
            <StepMark state={step.state} />
            <div className="min-w-0">
              <div
                className={cx(
                  'text-sm',
                  step.state === 'Done'
                    ? 'text-ink-muted'
                    : step.state === 'Failed'
                      ? 'text-danger'
                      : step.state === 'Active'
                        ? 'font-bold text-ink'
                        : 'text-ink-faint',
                )}
              >
                {step.titleUz}
              </div>
              {step.detail && step.state !== 'Pending' && (
                <div className="mt-0.5 text-xs text-ink-faint">{step.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {run.error && (
        <div className="mt-4">
          <ErrorNote>{run.error}</ErrorNote>
        </div>
      )}
    </Card>
  )
}

function StepMark({ state }: { state: MarketingRunStep['state'] }) {
  if (state === 'Active') {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 animate-spin rounded-full border-2 border-hairline border-t-signal"
      />
    )
  }

  if (state === 'Done') {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-milestone"
      >
        <Check aria-hidden="true" className="size-3 text-on-signal" strokeWidth={3.5} />
      </span>
    )
  }

  if (state === 'Failed') {
    return <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded-full bg-danger" />
  }

  return <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-hairline" />
}

function MetaMarketingPanel() {
  const settings = useAdminQuery<MetaMarketingSettings>('/api/admin-portal/marketing/meta-settings')
  const videos = useAdminQuery<MarketingUgcVideo[]>('/api/admin-portal/marketing/ugc-videos')
  const [draft, setDraft] = useState<MetaMarketingSettings | null>(null)
  const [token, setToken] = useState('')
  const [video, setVideo] = useState({ title: '', metaVideoId: '', videoUrl: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  useEffect(() => {
    if (settings.data) setDraft(settings.data)
  }, [settings.data])

  if (settings.error) return <ErrorNote onRetry={settings.refresh}>{settings.error}</ErrorNote>
  if (!draft && settings.isLoading) return <Loading />
  if (!draft) return null

  async function saveSettings() {
    if (!draft) return

    setBusy(true)
    setFailure('')
    try {
      await adminFetch('/api/admin-portal/marketing/meta-settings', {
        method: 'PUT',
        body: JSON.stringify({ ...draft, accessToken: token.trim() || null }),
      })
      setToken('')
      settings.refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Meta sozlamalari saqlanmadi')
    } finally {
      setBusy(false)
    }
  }

  async function addVideo() {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch('/api/admin-portal/marketing/ugc-videos', {
        method: 'POST',
        body: JSON.stringify({
          ...video,
          metaVideoId: video.metaVideoId.trim() || null,
          videoUrl: video.videoUrl.trim() || null,
          notes: video.notes.trim() || null,
          isActive: true,
        }),
      })
      setVideo({ title: '', metaVideoId: '', videoUrl: '', notes: '' })
      videos.refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Video qo‘shilmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading>Meta reklama</SectionHeading>
        <div className="flex flex-wrap gap-2">
          <Badge tone={draft.isConfigured ? 'milestone' : 'caution'}>
            {draft.isConfigured ? `Ulangan ${draft.accessTokenHint ?? ''}` : 'Credential kerak'}
          </Badge>
          <Badge tone={draft.defaultStatus === 'ACTIVE' ? 'caution' : 'neutral'}>
            {draft.defaultStatus}
          </Badge>
        </div>
      </div>

      {failure && <ErrorNote>{failure}</ErrorNote>}

      <div className="grid gap-3 md:grid-cols-3">
        <Field label={`Access token ${draft.accessTokenHint ? "(yangisini kiritmasangiz o'zgarmaydi)" : ''}`}>
          <input value={token} onChange={(event) => setToken(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Ad account ID">
          <input
            value={draft.adAccountId ?? ''}
            onChange={(event) => setDraft({ ...draft, adAccountId: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Page ID">
          <input
            value={draft.pageId ?? ''}
            onChange={(event) => setDraft({ ...draft, pageId: event.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_10rem_9rem_9rem]">
        <Field label="Landing URL">
          <input
            value={draft.destinationUrl}
            onChange={(event) => setDraft({ ...draft, destinationUrl: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Kunlik budget">
          <input
            type="number"
            value={draft.dailyBudget}
            onChange={(event) => setDraft({ ...draft, dailyBudget: Number(event.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label="Status">
          <select
            value={draft.defaultStatus}
            onChange={(event) => setDraft({ ...draft, defaultStatus: event.target.value })}
            className={inputClass}
          >
            <option value="PAUSED">PAUSED</option>
            <option value="ACTIVE">ACTIVE</option>
          </select>
        </Field>
        <Field label="Yosh">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={draft.ageMin}
              onChange={(event) => setDraft({ ...draft, ageMin: Number(event.target.value) })}
              className={inputClass}
            />
            <input
              type="number"
              value={draft.ageMax}
              onChange={(event) => setDraft({ ...draft, ageMax: Number(event.target.value) })}
              className={inputClass}
            />
          </div>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Davlatlar">
          <input
            value={draft.countries}
            onChange={(event) => setDraft({ ...draft, countries: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Platformalar">
          <input
            value={draft.publisherPlatforms}
            onChange={(event) => setDraft({ ...draft, publisherPlatforms: event.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Default headline">
        <input
          value={draft.headline}
          onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Default matn">
        <textarea
          value={draft.primaryText}
          onChange={(event) => setDraft({ ...draft, primaryText: event.target.value })}
          rows={3}
          className={textareaClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={draft.isEnabled}
            onChange={(event) => setDraft({ ...draft, isEnabled: event.target.checked })}
          />
          Meta orqali launch yoqilgan
        </label>
        <Button size="sm" onClick={() => void saveSettings()} disabled={busy}>
          Saqlash
        </Button>
      </div>

      <div className="border-t border-hairline pt-4">
        <SectionHeading>UGC videolar</SectionHeading>
        <div className="grid gap-3 md:grid-cols-[1fr_11rem_1fr]">
          <Field label="Nomi">
            <input
              value={video.title}
              onChange={(event) => setVideo({ ...video, title: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Meta video ID">
            <input
              value={video.metaVideoId}
              onChange={(event) => setVideo({ ...video, metaVideoId: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Preview URL">
            <input
              value={video.videoUrl}
              onChange={(event) => setVideo({ ...video, videoUrl: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Izoh">
            <input
              value={video.notes}
              onChange={(event) => setVideo({ ...video, notes: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Button size="sm" variant="secondary" onClick={() => void addVideo()} disabled={busy || !video.title.trim()}>
            Video qo'shish
          </Button>
        </div>

        {videos.data && videos.data.length > 0 && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {videos.data.map((item) => (
              <div key={item.id} className="rounded-[var(--radius-card)] border border-hairline bg-ground-sunken p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">{item.title}</span>
                  <Badge tone={item.metaVideoId ? 'milestone' : 'caution'}>
                    {item.metaVideoId ? `ID ${item.metaVideoId}` : 'Meta ID yo‘q'}
                  </Badge>
                </div>
                {item.videoUrl && <p className="mt-1 text-xs text-ink-faint [overflow-wrap:anywhere]">{item.videoUrl}</p>}
                {item.notes && <p className="mt-1 text-sm text-ink-muted">{item.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

const inputClass =
  'h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-3 text-sm text-ink focus:border-signal focus:outline-none'
const textareaClass =
  'w-full rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  )
}

function PlanDetail({
  planId,
  onChanged,
  onRunStarted,
}: {
  planId: string
  onChanged: () => void
  onRunStarted: (run: MarketingRun) => void
}) {
  const { data, error, isLoading, refresh } = useAdminQuery<MarketingPlan>(
    `/api/admin-portal/marketing/${planId}`,
  )
  const videos = useAdminQuery<MarketingUgcVideo[]>('/api/admin-portal/marketing/ugc-videos')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [ugcVideoId, setUgcVideoId] = useState('')

  if (error) return <ErrorNote onRetry={refresh}>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const plan = data

  /**
   * Rejecting removes the week rather than marking it refused. Behind a confirmation because
   * it cannot be undone: the plan, its initiatives and its forecasts all go.
   */
  async function remove() {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/marketing/${planId}`, { method: 'DELETE' })
      setConfirmingDelete(false)
      // The list owns which plan is open, and the one that was open no longer exists.
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Bajarilmadi')
      setConfirmingDelete(false)
    } finally {
      setBusy(false)
    }
  }

  async function act(action: 'accept' | 'execute' | 'review' | 'regenerate') {
    setBusy(true)
    setFailure('')
    try {
      const answer = await adminFetch<MarketingPlan | MarketingRun>(
        `/api/admin-portal/marketing/${planId}/${action}`,
        { method: 'POST' },
      )

      // Regenerating writes a new plan, so it comes back as something to watch rather than
      // as the finished article.
      if (action === 'regenerate') {
        onRunStarted(answer as MarketingRun)
        onChanged()
        return
      }

      refresh()
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Bajarilmadi')
    } finally {
      setBusy(false)
    }
  }

  async function launchMeta() {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch<MarketingPlan>(`/api/admin-portal/marketing/${planId}/launch-meta`, {
        method: 'POST',
        body: JSON.stringify({ ugcVideoId: ugcVideoId || null }),
      })
      refresh()
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Meta reklama yaratilmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen className="space-y-4">
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
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                Rad etish
              </Button>
            </>
          )}
          {plan.status === 'Dismissed' && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)} disabled={busy}>
              O'chirish
            </Button>
          )}
          {(plan.status === 'Executed' || plan.status === 'Reviewed') && (
            <Button size="sm" variant="secondary" onClick={() => act('review')} disabled={busy}>
              {plan.status === 'Reviewed' ? "Qayta o'lchash" : "Hozir o'lchash"}
            </Button>
          )}
        </div>

        {(plan.status === 'Proposed' || plan.status === 'Accepted') && !plan.metaLaunch && (
          <div className="mt-4 rounded-[var(--radius-card)] border border-hairline bg-ground-sunken p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">UGC video tanlash</span>
                <select
                  value={ugcVideoId}
                  onChange={(event) => setUgcVideoId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Video tanlanmagan</option>
                  {(videos.data ?? [])
                    .filter((video) => video.isActive)
                    .map((video) => (
                      <option key={video.id} value={video.id}>
                        {video.title}{video.metaVideoId ? ` · ${video.metaVideoId}` : ' · Meta ID kerak'}
                      </option>
                    ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button size="sm" onClick={() => void launchMeta()} disabled={busy || !ugcVideoId}>
                  Meta orqali target qilish
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              Bu tugma Meta campaign, ad set, video creative va ad yaratadi; status yuqoridagi
              Meta sozlamasidan olinadi.
            </p>
          </div>
        )}

        {plan.metaLaunch && (
          <div className="mt-4 rounded-[var(--radius-card)] border border-milestone/40 bg-milestone-soft p-3 text-sm text-milestone">
            Meta yaratildi: campaign {plan.metaLaunch.campaignId}, ad {plan.metaLaunch.adId} ·{' '}
            {plan.metaLaunch.status} · {formatDateTime(plan.metaLaunch.launchedAt)}
          </div>
        )}

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
            <h3 className="min-w-40 flex-1 text-base font-extrabold text-ink">{initiative.titleUz}</h3>
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

      {confirmingDelete && (
        <ConfirmDialog
          title="Bu haftani rad etasizmi?"
          body={
            <>
              <strong className="font-bold text-ink">
                {plan.weekNumber}-hafta — {plan.headlineUz}
              </strong>{' '}
              va uning {plan.initiatives.length} ta tashabbusi butunlay o'chadi. Buni qaytarib
              bo'lmaydi. Hafta raqami bo'sh qoladi, ya'ni o'sha hafta uchun yangi reja tuzsa
              bo'ladi.
            </>
          }
          confirmLabel="Ha, rad etaman"
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Screen>
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
      <span className="min-w-32 flex-1 text-sm text-ink">{metricLabel[metric]}</span>

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
