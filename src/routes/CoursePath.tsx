import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { pickContent } from '../lib/content'
import { fill, useLocale, useT } from '../lib/i18n'
import type { CourseDayView, EntitlementView, MissionSummary, ProgressView } from '../lib/types'
import { Badge, Button, Card, CheckCircle, LinkButton, SectionHeading, Spinner } from '../components/ui'

/**
 * Why a day is shut. Only `pro` can be bought out of — a `progress` lock opens by working
 * through the earlier days, so offering Pro there would sell something that does not help.
 */
type LockedDay = { kind: 'pro' | 'progress'; day: number }

export function CoursePath() {
  const t = useT()
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [locked, setLocked] = useState<LockedDay | null>(null)

  const { data: days, isLoading } = useQuery({
    queryKey: ['course-map'],
    queryFn: () => api.get<CourseDayView[]>('/course/map'),
  })

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  const { data: progress } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
  })

  if (isLoading || !days) return <Spinner />

  const completedDays = Math.max(0, (progress?.currentDay ?? 1) - 1)
  const maxUnlockedDay = entitlement?.maxUnlockedDay ?? 1

  const phases = [
    { phase: 'Foundation' as const, range: '1-30' },
    { phase: 'Bridge' as const, range: '31-60' },
    { phase: 'Immersion' as const, range: '61-90' },
  ]

  function handleToggle(day: CourseDayView) {
    if (!day.isUnlocked) {
      setLocked({ kind: day.day > maxUnlockedDay ? 'pro' : 'progress', day: day.day })
      return
    }
    setOpenDay((current) => (current === day.day ? null : day.day))
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.path.title}</h1>
          <p className="text-support mt-1">
            {t.path.subtitle}
          </p>
        </div>
        <Badge tone="milestone">{completedDays}/90</Badge>
      </header>

      {phases.map(({ phase, range }) => {
        const phaseDays = days.filter((day) => day.phase === phase)
        if (phaseDays.length === 0) return null

        return (
          <section key={phase}>
            <SectionHeading>
              {t.labels.phase[phase]} · {range}
            </SectionHeading>

            <div className="space-y-2">
              {phaseDays.map((day) => (
                <DayRow
                  key={day.day}
                  day={day}
                  isOpen={openDay === day.day}
                  maxUnlockedDay={maxUnlockedDay}
                  currentDay={progress?.currentDay ?? 1}
                  onToggle={() => handleToggle(day)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {locked && <LockedDayDialog locked={locked} onDismiss={() => setLocked(null)} />}
    </div>
  )
}

/**
 * A shut day, and the one thing that opens it. The Pro case leads with buying, because that
 * is the actual next step — an "understood" button was a dead end at the exact moment the
 * learner reached for more of the course.
 */
function LockedDayDialog({ locked, onDismiss }: { locked: LockedDay; onDismiss: () => void }) {
  const t = useT()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  const isPro = locked.kind === 'pro'

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4"
      onClick={onDismiss}
    >
      <Card
        className="w-full max-w-md"
        // The backdrop closes; the card itself must not.
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-day-title"
      >
        <h2 id="locked-day-title" className="text-lg font-extrabold text-ink">
          {isPro ? fill(t.path.lockedProTitle, { day: locked.day }) : t.path.lockedProgressTitle}
        </h2>

        <p className="text-support mt-2">
          {isPro
            ? t.path.lockedProBody
            : fill(t.path.lockedProgressBody, { day: locked.day })}
        </p>

        {isPro ? (
          <>
            <LinkButton to="/paywall" block className="mt-5">
              {t.path.buyPro}
            </LinkButton>
            <Button variant="ghost" block className="mt-2" onClick={onDismiss}>
              {t.common.later}
            </Button>
          </>
        ) : (
          <Button className="mt-5" onClick={onDismiss}>
            {t.common.understood}
          </Button>
        )}
      </Card>
    </div>
  )
}

function DayRow({
  day,
  isOpen,
  maxUnlockedDay,
  currentDay,
  onToggle,
}: {
  day: CourseDayView
  isOpen: boolean
  maxUnlockedDay: number
  currentDay: number
  onToggle: () => void
}) {
  const { data: missions, isLoading } = useQuery({
    queryKey: ['day-missions', day.day],
    queryFn: () => api.get<MissionSummary[]>(`/course/days/${day.day}/missions`),
    enabled: isOpen,
  })

  const t = useT()
  const { locale } = useLocale()
  const isDone = day.completedMissionCount >= day.requiredMissionCount
  const isToday = day.day === currentDay

  return (
    <div
      className={
        isOpen
          ? 'rounded-[var(--radius-card)] border border-signal bg-signal-soft/40'
          : 'border-b border-hairline last:border-b-0'
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-4 px-4 py-3 text-left"
      >
        {/* Open days get a filled marker; the number alone reads as a list index. */}
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
            isOpen ? 'bg-signal text-on-signal' : 'text-ink-faint'
          }`}
        >
          {day.day}
        </span>

        <span
          className={`flex-1 text-base ${
            isOpen ? 'font-semibold text-ink' : day.isUnlocked ? 'text-ink' : 'text-ink-faint'
          }`}
        >
          {pickContent(locale, { uz: day.focusUz, ru: day.focusRu, en: day.focusEn })}
        </span>

        {isToday && !isDone && <Badge tone="signal">{t.path.today}</Badge>}
        {isDone && <CheckCircle />}
        {!day.isUnlocked && !isDone && (
          <Badge tone="caution">{day.day > maxUnlockedDay ? t.path.needsPro : t.path.locked}</Badge>
        )}
        <ChevronGlyph open={isOpen} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          {isLoading && <Spinner label={t.path.missions} />}
          {missions && missions.length === 0 && (
            <Card>
              <p className="text-support">{t.path.preparing}</p>
            </Card>
          )}
          {missions?.map((mission) => <MissionBrief key={mission.id} mission={mission} />)}
        </div>
      )}
    </div>
  )
}

/**
 * The briefing a learner reads before committing five minutes: what it costs, what they walk
 * away able to say, and who they will be saying it to. The plain mission card answered none
 * of those, so the decision to start was made on a title alone.
 */
function MissionBrief({ mission }: { mission: MissionSummary }) {
  const t = useT()

  return (
    <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-4 md:p-5">
      <div className="grid gap-6 md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,17rem)]">
        <dl className="space-y-3">
          <Meta icon={<ClockGlyph />} label={fill(t.common.minutes, { count: mission.estimatedMinutes })} />
          <Meta icon={<PhraseGlyph />} label={fill(t.path.phraseCount, { count: mission.targetPhraseCount })} />
          {mission.hasVoiceStep && <Meta icon={<MicGlyph />} label={t.path.voicePractice} />}
          <Meta icon={<LevelGlyph />} label={fill(t.path.levelLabel, { level: mission.targetLevel })} />
        </dl>

        <div>
          <h3 className="text-base font-extrabold text-ink">{t.path.willLearn}</h3>
          {mission.learningPointsUz.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {mission.learningPointsUz.map((point) => (
                <li key={point} className="flex gap-2.5">
                  <CheckCircle size="sm" label="" />
                  <span className="text-base leading-snug text-ink">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-support mt-3">{mission.objectiveUz}</p>
          )}
        </div>

        <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-ground p-4">
          <div className="flex items-start gap-3">
            <TutorAvatar />
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink">{t.path.tutorTitle}</p>
              <p className="text-support mt-1">
                {t.path.tutorBody}
              </p>
            </div>
          </div>

          {mission.isLocked ? (
            <p className="text-support mt-4 rounded-xl bg-ground-sunken px-3 py-2">
              {mission.lockReason ?? t.path.lockedFallback}
            </p>
          ) : (
            <LinkButton to={`/missions/${mission.id}`} block className="mt-4">
              <MicGlyph />
              {t.path.startConversation}
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  )
}

function Meta({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-ink-muted">
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="text-sm">{label}</span>
    </div>
  )
}

/** Falls back to the abstract mark when no avatar image is present; see public/README.md. */
function TutorAvatar() {
  const t = useT()
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <span className="size-11 shrink-0 rounded-full bg-signal-soft" aria-hidden="true" />
  }

  return (
    <img
      src="/tutor-avatar.jpg"
      alt={t.player.tutorName}
      onError={() => setFailed(true)}
      className="size-11 shrink-0 rounded-full bg-signal-soft object-cover"
    />
  )
}

/* Abstract line glyphs — circle, line and wave motifs only (PRD §7). */

const metaGlyph = 'size-4 fill-none stroke-current stroke-[1.7]'

function ClockGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={metaGlyph}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PhraseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={metaGlyph}>
      <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4.5 20l1.4-4.4A7.5 7.5 0 1 1 20 12Z" strokeLinejoin="round" />
    </svg>
  )
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={metaGlyph}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" strokeLinecap="round" />
    </svg>
  )
}

function LevelGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={metaGlyph}>
      <path d="M5 19v-5M12 19V8M19 19v-8" strokeLinecap="round" />
    </svg>
  )
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`size-4 shrink-0 fill-none stroke-current stroke-[1.8] text-ink-faint ${
        open ? 'rotate-180' : ''
      }`}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
