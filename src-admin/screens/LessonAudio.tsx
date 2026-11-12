import { useEffect, useState } from 'react'
import { adminFetch, formatDateTime, formatNumber, useAdminQuery } from '../lib/api'
import type { AdminLessonAudioRun, AdminLessonAudioStatus } from '../lib/types'
import { Badge, Button, Card, ConfirmDialog, ErrorNote, Loading, PageHeader, Screen, Stat } from '../components/ui'

/**
 * Stored lesson audio. Every deploy already queues audio for lines that have none; this is
 * the same run by hand, for when a lesson was added or edited between deploys. It only makes
 * what is missing — a lesson that already has its audio is never paid for again.
 */
export function LessonAudio() {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminLessonAudioStatus>('/api/admin-portal/lesson-audio')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState('')

  const run = data?.latestRun ?? null
  const running = (data?.pendingJobs ?? 0) > 0 || run?.state === 'queued' || run?.state === 'running'
  const missingLessons = data ? Math.max(0, data.publishedLessons - data.lessonsCovered) : 0

  // While a run is going the numbers move; the screen follows them without a reload.
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(refresh, 5000)
    return () => window.clearInterval(timer)
  }, [running, refresh])

  async function start() {
    setBusy(true)
    setFailure('')
    setNotice('')
    try {
      const result = await adminFetch<{ runId: string; queued: boolean }>(
        '/api/admin-portal/lesson-audio/backfill?missingOnly=true',
        { method: 'POST' },
      )
      setNotice(result.queued ? "Navbatga qo'yildi. Yetishmayotgan audiolar fonda yaratiladi." : "Bu ish allaqachon navbatda.")
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Ishga tushirib bo'lmadi.")
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <Screen className="space-y-6">
      <PageHeader
        title="Dars audiolari"
        subtitle="Darslardagi iboralar oldindan yaratilib saqlanadi — o'quvchi kutmaydi, har safar pul ketmaydi"
      />

      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
      {failure && <ErrorNote>{failure}</ErrorNote>}
      {!data && isLoading && <Loading />}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {running ? (
              <Badge tone="signal">Ishlayapti · {formatNumber(data.pendingJobs)} ta ish navbatda</Badge>
            ) : missingLessons > 0 ? (
              <Badge tone="caution">{formatNumber(missingLessons)} ta darsda audio yo'q</Badge>
            ) : (
              <Badge tone="milestone">Hamma darslarda audio bor</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat
              label="Audiosi bor darslar"
              value={`${formatNumber(data.lessonsCovered)} / ${formatNumber(data.publishedLessons)}`}
            />
            <Stat label="Saqlangan iboralar" value={formatNumber(data.storedLines)} note="Har bir ovoz alohida" />
            <Stat
              label="Jonli yaratilgan"
              value={formatNumber(data.liveClips)}
              note="O'quvchi birinchi eshitganda yaratilgan"
            />
          </div>

          {run && <RunProgress run={run} />}

          <Card className="space-y-3">
            <h2 className="text-base font-extrabold text-ink">Yetishmayotgan audiolarni yaratish</h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              Har bir deploy'da bu avtomatik ishlaydi. Tugma faqat audiosi yo'q iboralarni yaratadi: yangi
              darslar va matni o'zgargan iboralar. Audiosi bor darslarga tegmaydi va qayta pul sarflamaydi.
            </p>
            {notice && <p className="text-sm font-bold text-milestone">{notice}</p>}
            <Button disabled={busy || running} onClick={() => setConfirming(true)}>
              {running ? 'Ishlayapti…' : 'Yetishmayotganlarini yaratish'}
            </Button>
          </Card>
        </>
      )}

      {confirming && (
        <ConfirmDialog
          title="Yetishmayotgan audiolar yaratilsinmi?"
          body={
            missingLessons > 0
              ? `${missingLessons} ta dars va matni o'zgargan iboralar uchun audio yaratiladi. Bu Gemini TTS uchun pul sarflaydi (butun kurs uchun taxminan $12–22, bir dars uchun bir necha sent).`
              : "Faqat matni o'zgargan iboralar yaratiladi. Hech narsa yetishmasa, hech narsa sarflanmaydi."
          }
          confirmLabel="Yaratish"
          busy={busy}
          onConfirm={() => void start()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Screen>
  )
}

const STATE_LABEL: Record<AdminLessonAudioRun['state'], string> = {
  queued: 'Navbatda',
  running: 'Ishlayapti',
  done: 'Tugadi',
  failed: 'Xatolar bilan tugadi',
}

const STATE_TONE = {
  queued: 'neutral',
  running: 'signal',
  done: 'milestone',
  failed: 'danger',
} as const

/** The latest run, lesson by lesson: how far it is, what it is on now, and what failed. */
function RunProgress({ run }: { run: AdminLessonAudioRun }) {
  const percent = run.totalLessons > 0 ? Math.round((run.doneLessons / run.totalLessons) * 100) : 0
  const label = `${formatNumber(run.doneLessons)} / ${formatNumber(run.totalLessons)} dars tayyor`

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-ink">Oxirgi ish</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{run.trigger === 'deploy' ? 'Deploy' : 'Tugma'}</Badge>
          <Badge tone={STATE_TONE[run.state]}>{STATE_LABEL[run.state]}</Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-bold text-ink">{run.state === 'queued' ? "Darslar navbatga qo'yilmoqda…" : label}</span>
          <span className="font-extrabold tabular-nums text-ink">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-3 overflow-hidden rounded-full bg-ground-sunken"
        >
          <div
            className={run.state === 'failed' ? 'h-full rounded-full bg-danger' : 'h-full rounded-full bg-signal transition-[width] duration-500'}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {run.current && (
          <div className="flex gap-2">
            <dt className="text-ink-muted">Hozir:</dt>
            <dd className="font-bold text-ink">{run.current.courseDay}-kun · {run.current.title}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-ink-muted">Bu ishda yaratilgan iboralar:</dt>
          <dd className="font-bold tabular-nums text-ink">{formatNumber(run.linesMade)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink-muted">Boshlandi:</dt>
          <dd className="font-bold text-ink">{formatDateTime(run.startedAt)}</dd>
        </div>
        {run.finishedAt && (
          <div className="flex gap-2">
            <dt className="text-ink-muted">Tugadi:</dt>
            <dd className="font-bold text-ink">{formatDateTime(run.finishedAt)}</dd>
          </div>
        )}
        {run.retryingLessons > 0 && (
          <div className="flex gap-2">
            <dt className="text-ink-muted">Qayta urinilmoqda:</dt>
            <dd className="font-bold tabular-nums text-caution">{formatNumber(run.retryingLessons)} ta dars</dd>
          </div>
        )}
      </dl>

      {run.failures.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-extrabold text-ink">Muammoli darslar</h3>
          <ul className="space-y-1.5">
            {run.failures.map((failure) => (
              <li key={failure.missionId} className="rounded-xl bg-ground-sunken px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{failure.courseDay}-kun · {failure.title}</span>
                  <Badge tone={failure.gaveUp ? 'danger' : 'caution'}>{failure.gaveUp ? "To'xtadi" : 'Qayta urinadi'}</Badge>
                </div>
                {failure.error && <p className="mt-1 break-words font-mono text-xs text-ink-muted">{failure.error}</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            To'xtagan darslar keyingi deploy'da yoki tugma bosilganda qayta yaratiladi.
          </p>
        </div>
      )}
    </Card>
  )
}
