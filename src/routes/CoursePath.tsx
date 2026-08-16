import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { pickContent } from '../lib/content'
import { fill, useLocale, useT } from '../lib/i18n'
import { missionPath } from '../lib/mission-path'
import type { CourseDayView, EntitlementView, MissionSummary, ProgressView } from '../lib/types'
import {
  CompletedGlyph,
  MissionCardAction,
  MissionProgress,
} from '../components/MissionCard'
import { missionCardClass } from '../components/mission-card-style'
import { Badge, Button, Card, LinkButton, SectionHeading, Spinner } from '../components/ui'

/**
 * Why a day is shut. Only `pro` can be bought out of — a `progress` lock opens by working
 * through the earlier days, so offering Pro there would sell something that does not help.
 */
type LockedDay = { kind: 'pro' | 'progress'; day: number }
type DayNotice = { day: number; text: string }

export function CoursePath() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [locked, setLocked] = useState<LockedDay | null>(null)
  const [openingDay, setOpeningDay] = useState<number | null>(null)
  const [notice, setNotice] = useState<DayNotice | null>(null)

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

  /*
   * Counted from the same field the ticks are, so the header and the rows cannot contradict
   * each other. Read off the current day it counted days the learner was placed past as
   * days they had done, which could make the summary claim progress the cards did not show.
   */
  const completedDays = days.filter(
    (day) => day.completedMissionCount >= day.requiredMissionCount,
  ).length
  const maxPreviewDay = days.reduce(
    (highest, day) => (day.isFreePreview ? Math.max(highest, day.day) : highest),
    0,
  )
  const maxUnlockedDay = entitlement?.maxUnlockedDay ?? maxPreviewDay

  const phases = [
    { phase: 'Foundation' as const, range: '1-30' },
    { phase: 'Bridge' as const, range: '31-60' },
    { phase: 'Immersion' as const, range: '61-90' },
  ]

  async function handleDay(day: CourseDayView) {
    if (!day.isUnlocked) {
      setLocked({ kind: day.day > maxUnlockedDay ? 'pro' : 'progress', day: day.day })
      return
    }

    setOpeningDay(day.day)
    setNotice(null)

    try {
      const missions = await queryClient.fetchQuery({
        queryKey: ['day-missions', day.day],
        queryFn: () => api.get<MissionSummary[]>(`/course/days/${day.day}/missions`),
        staleTime: 60_000,
      })
      const mission = missions.find((candidate) => !candidate.isLocked) ?? missions[0]

      if (!mission) {
        setNotice({ day: day.day, text: t.path.preparing })
        return
      }

      if (mission.isLocked) {
        const isPro = mission.lockReason?.toLowerCase().includes('pro') ?? false
        setLocked({ kind: isPro ? 'pro' : 'progress', day: day.day })
        return
      }

      navigate(missionPath(mission))
    } catch {
      setNotice({ day: day.day, text: t.common.loadFailed })
    } finally {
      setOpeningDay(null)
    }
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.path.title}</h1>
          <p className="text-support mt-1">{t.path.subtitle}</p>
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

            <div className="space-y-3">
              {phaseDays.map((day) => (
                <DayCard
                  key={day.day}
                  day={day}
                  maxUnlockedDay={maxUnlockedDay}
                  currentDay={progress?.currentDay ?? 1}
                  showFreeLabel={
                    entitlement?.hasProAccess === false && day.isFreePreview && day.isUnlocked
                  }
                  isOpening={openingDay === day.day}
                  notice={notice?.day === day.day ? notice.text : null}
                  onSelect={() => void handleDay(day)}
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

function DayCard({
  day,
  maxUnlockedDay,
  currentDay,
  showFreeLabel,
  isOpening,
  notice,
  onSelect,
}: {
  day: CourseDayView
  maxUnlockedDay: number
  currentDay: number
  showFreeLabel: boolean
  isOpening: boolean
  notice: string | null
  onSelect: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const isDone = day.completedMissionCount >= day.requiredMissionCount
  const isToday = day.day === currentDay
  const isLocked = !day.isUnlocked && !isDone
  const dayLabel = fill(t.common.day, { day: day.day })
  const focus = pickContent(locale, { uz: day.focusUz, ru: day.focusRu, en: day.focusEn })

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${dayLabel}: ${focus}`}
      aria-busy={isOpening}
      className={`${missionCardClass(isDone, isLocked)} w-full text-left`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-ink">{dayLabel}</h3>
            {isDone && <CompletedGlyph label={t.path.done} />}
          </div>
          <p className={`mt-1 text-base ${isLocked ? 'text-ink-faint' : 'text-ink-muted'}`}>
            {focus}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {isToday && !isDone && <Badge tone="signal">{t.path.today}</Badge>}
          {showFreeLabel && <Badge>{t.account.plan.free}</Badge>}
          {isLocked && (
            <Badge tone="caution">
              {day.day > maxUnlockedDay ? t.path.needsPro : t.path.locked}
            </Badge>
          )}
        </div>
      </div>

      <MissionProgress
        value={day.completedMissionCount}
        max={day.requiredMissionCount}
        completed={isDone}
        label={`${dayLabel}: ${focus}`}
      />

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className={`text-sm font-semibold ${notice ? 'text-danger' : 'text-ink-faint'}`}>
          {notice ?? `${day.completedMissionCount}/${day.requiredMissionCount}`}
        </span>

        {isDone ? (
          <span className="rounded-[var(--radius-control)] border border-milestone/15 bg-ground-raised px-4 py-1.5 text-sm font-extrabold text-milestone">
            {t.path.done}
          </span>
        ) : isLocked ? (
          <span className="text-sm font-extrabold text-caution">
            {day.day > maxUnlockedDay ? t.path.needsPro : t.path.locked}
          </span>
        ) : isOpening ? (
          <span className="text-sm font-extrabold text-signal-ink">{t.common.loading}…</span>
        ) : (
          <MissionCardAction>{t.path.startConversation}</MissionCardAction>
        )}
      </div>
    </button>
  )
}
