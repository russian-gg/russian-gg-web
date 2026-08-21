import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { pickContent } from '../lib/content'
import { cx } from '../lib/cx'
import { LESSON_ONE_SECTIONS, readFoundationLessonProgress } from '../lib/demo-lesson-one'
import { syncLessonOneCompletion } from '../lib/lesson-one-sync'
import { fill, useLocale, useT, type Locale } from '../lib/i18n'
import { missionPath } from '../lib/mission-path'
import type { CourseDayView, EntitlementView, MissionSummary, ProgressView } from '../lib/types'
import {
  CompletedGlyph,
  MissionCardAction,
  MissionProgress,
} from '../components/MissionCard'
import { Badge, Button, Card, LinkButton, SectionHeading, Spinner } from '../components/ui'

/**
 * Why a day is shut. Only `pro` can be bought out of — a `progress` lock opens by working
 * through the earlier days, so offering Pro there would sell something that does not help.
 */
type LockedDay = { kind: 'pro' | 'progress'; day: number }
type DayNotice = { day: number; text: string }
type PathFilter = 'all' | 'active' | 'done'
type SelectedDay = { day: CourseDayView; lockKind: LockedDay['kind'] }

export function CoursePath() {
  const t = useT()
  const { locale } = useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [locked, setLocked] = useState<LockedDay | null>(null)
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)
  const [openingDay, setOpeningDay] = useState<number | null>(null)
  const [notice, setNotice] = useState<DayNotice | null>(null)
  const [filter, setFilter] = useState<PathFilter>('all')
  const [search, setSearch] = useState('')
  const lessonOneSyncStarted = useRef(false)

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

  /*
   * Counted from the same field the ticks are, so the header and the rows cannot contradict
   * each other. Read off the current day it counted days the learner was placed past as
   * days they had done, which could make the summary claim progress the cards did not show.
   */
  const maxPreviewDay = (days ?? []).reduce(
    (highest, day) => (day.isFreePreview ? Math.max(highest, day.day) : highest),
    0,
  )
  const maxUnlockedDay = entitlement?.maxUnlockedDay ?? maxPreviewDay
  const foundationProgress = Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => {
      const day = index + 1
      return [day, readFoundationLessonProgress(user?.id, day)]
    }),
  ) as Record<number, ReturnType<typeof readFoundationLessonProgress>>
  const lessonOneProgress = foundationProgress[1]
  const lessonOneComplete = lessonOneProgress.isComplete

  useEffect(() => {
    if (!lessonOneComplete
      || !user?.id
      || !progress
      || progress.currentDay > 1
      || lessonOneSyncStarted.current) {
      return
    }

    lessonOneSyncStarted.current = true
    void (async () => {
      const missions = await queryClient.fetchQuery({
        queryKey: ['day-missions', 1],
        queryFn: () => api.get<MissionSummary[]>('/course/days/1/missions'),
      })
      const mission = missions.find((candidate) => candidate.slug === 'work-introduce-yourself')
        ?? missions[0]
      if (!mission) return

      await syncLessonOneCompletion(mission.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course-map'] }),
        queryClient.invalidateQueries({ queryKey: ['day-missions'] }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
      ])
    })().catch(() => {
      lessonOneSyncStarted.current = false
    })
  }, [lessonOneComplete, progress, queryClient, user?.id])

  if (isLoading || !days) return <Spinner />

  let previousDaysComplete = true
  const displayedDays = days.map((day) => {
    const localProgress = foundationProgress[day.day]
    const isComplete =
      day.completedMissionCount >= day.requiredMissionCount || localProgress?.isComplete === true
    const isSequentiallyUnlocked = previousDaysComplete
    const completedMissionCount = isComplete
      ? day.requiredMissionCount
      : day.completedMissionCount
    const displayedDay = {
      ...day,
      completedMissionCount,
      isUnlocked: isComplete || (day.isUnlocked && isSequentiallyUnlocked),
    }
    const lockKind: LockedDay['kind'] = !isSequentiallyUnlocked
      ? 'progress'
      : day.day > maxUnlockedDay
        ? 'pro'
        : 'progress'

    previousDaysComplete = previousDaysComplete && isComplete
    return { day: displayedDay, lockKind }
  })
  const completedDays = displayedDays.filter(
    ({ day }) => day.completedMissionCount >= day.requiredMissionCount,
  ).length
  const normalizedSearch = search.trim().toLocaleLowerCase(locale === 'ru' ? 'ru-RU' : locale)
  const visibleDays = displayedDays.filter(({ day }) => {
    const isDone = day.completedMissionCount >= day.requiredMissionCount
    const matchesFilter =
      filter === 'all' ||
      (filter === 'done' && isDone) ||
      (filter === 'active' && day.isUnlocked && !isDone)
    const matchesSearch =
      !normalizedSearch ||
      String(day.day).includes(normalizedSearch) ||
      getDayFocus(day, locale).toLocaleLowerCase(locale === 'ru' ? 'ru-RU' : locale).includes(normalizedSearch)

    return matchesFilter && matchesSearch
  })

  const phases = [
    { phase: 'Foundation' as const, range: '1-30' },
    { phase: 'Bridge' as const, range: '31-60' },
    { phase: 'Immersion' as const, range: '61-90' },
  ]

  function handleDay(day: CourseDayView, lockKind: LockedDay['kind']) {
    if (!day.isUnlocked) {
      setLocked({ kind: lockKind, day: day.day })
      return
    }

    setSelectedDay({ day, lockKind })
  }

  async function startDay(day: CourseDayView, lockKind: LockedDay['kind'], restart: boolean) {

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
        setLocked({ kind: isPro ? 'pro' : lockKind, day: day.day })
        return
      }

      setSelectedDay(null)
      navigate(`${missionPath(mission)}${restart ? '?start=1' : ''}`)
    } catch {
      setNotice({ day: day.day, text: t.common.loadFailed })
    } finally {
      setOpeningDay(null)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{t.path.title}</h1>
          <p className="mt-0.5 text-sm text-ink-muted sm:mt-1 sm:text-base">{t.path.subtitle}</p>
        </div>
        <Badge tone="milestone">{completedDays}/90</Badge>
      </header>

      <div className="hidden flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-3 shadow-[0_8px_24px_rgb(22_24_29/0.035)] sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl bg-ground-sunken p-1">
          {(['all', 'active', 'done'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cx(
                'rounded-lg px-3 py-2 text-sm font-bold transition-colors',
                filter === value
                  ? 'bg-ground-raised text-signal-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {value === 'all'
                ? t.path.filterAll
                : value === 'active'
                  ? t.path.filterActive
                  : t.path.filterDone}
            </button>
          ))}
        </div>

        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">{t.path.search}</span>
          <SearchGlyph />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.path.search}
            className="h-10 w-full rounded-xl border border-hairline bg-ground px-4 pr-3 pl-10 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-signal"
          />
        </label>
      </div>

      {phases.map(({ phase, range }) => {
        const phaseDays = visibleDays.filter(({ day }) => day.phase === phase)
        if (phaseDays.length === 0) return null

        return (
          <section key={phase}>
            <SectionHeading>
              {t.labels.phase[phase]} · {range}
            </SectionHeading>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {phaseDays.map(({ day, lockKind }) => (
                <DayCard
                  key={day.day}
                  day={day}
                  maxUnlockedDay={maxUnlockedDay}
                  currentDay={progress?.currentDay ?? 1}
                  locale={locale}
                  showFreeLabel={
                    entitlement?.hasProAccess === false && day.isFreePreview && day.isUnlocked
                  }
                  isOpening={openingDay === day.day}
                  notice={notice?.day === day.day ? notice.text : null}
                  partialProgress={
                    foundationProgress[day.day] && !foundationProgress[day.day].isComplete
                      ? {
                          value: foundationProgress[day.day].completed.length,
                          max: LESSON_ONE_SECTIONS.length,
                        }
                      : null
                  }
                  onSelect={() => handleDay(day, lockKind)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {visibleDays.length === 0 && (
        <Card className="py-10 text-center text-sm font-semibold text-ink-muted">
          {t.path.noResults}
        </Card>
      )}

      {locked && <LockedDayDialog locked={locked} onDismiss={() => setLocked(null)} />}
      {selectedDay && (
        <DayPreviewDrawer
          selected={selectedDay}
          locale={locale}
          isOpening={openingDay === selectedDay.day.day}
          partialProgress={
            foundationProgress[selectedDay.day.day] && !foundationProgress[selectedDay.day.day].isComplete
              ? { value: foundationProgress[selectedDay.day.day].completed.length, max: LESSON_ONE_SECTIONS.length }
              : null
          }
          onDismiss={() => setSelectedDay(null)}
          onStart={(restart) => void startDay(selectedDay.day, selectedDay.lockKind, restart)}
        />
      )}
    </div>
  )
}

function DayPreviewDrawer({
  selected,
  locale,
  isOpening,
  partialProgress,
  onDismiss,
  onStart,
}: {
  selected: SelectedDay
  locale: Locale
  isOpening: boolean
  partialProgress: { value: number; max: number } | null
  onDismiss: () => void
  onStart: (restart: boolean) => void
}) {
  const { day } = selected
  const focus = getDayFocus(day, locale)
  const isDone = day.completedMissionCount >= day.requiredMissionCount
  const completed = partialProgress?.value ?? day.completedMissionCount
  const total = partialProgress?.max ?? day.requiredMissionCount
  const hasProgress = completed > 0 && !isDone
  const restart = isDone || !hasProgress
  const description = locale === 'ru'
    ? `На уроке «${focus}» вы изучите новые правила и фразы, а затем закрепите их в интерактивных заданиях.`
    : locale === 'en'
      ? `In “${focus}” you will learn new rules and phrases, then practise them in interactive activities.`
      : `«${focus}» darsida yangi qoida va iboralarni o‘rganib, ularni interaktiv mashqlarda mustahkamlaysiz.`
  const action = locale === 'ru'
    ? isDone ? 'Повторить урок' : hasProgress ? 'Продолжить урок' : 'Начать урок'
    : locale === 'en'
      ? isDone ? 'Repeat lesson' : hasProgress ? 'Continue lesson' : 'Start lesson'
      : isDone ? 'Darsni takrorlash' : hasProgress ? 'Darsni davom ettirish' : 'Darsni boshlash'
  const close = locale === 'ru' ? 'Закрыть' : locale === 'en' ? 'Close' : 'Yopish'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onDismiss])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end" role="presentation">
      <button
        type="button"
        aria-label={close}
        data-ui-sound="click"
        className="absolute inset-0 h-full w-full cursor-default bg-ink/45 backdrop-blur-[1px]"
        onClick={onDismiss}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-preview-title"
        className="relative flex max-h-[88dvh] w-full flex-col overflow-y-auto rounded-t-[2rem] bg-ground-raised p-5 shadow-2xl sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-[2rem] sm:p-8"
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black tracking-[.14em] text-ink-muted uppercase">
              {locale === 'ru' ? 'Программа обучения' : locale === 'en' ? 'Learning programme' : 'O‘quv dasturi'}
            </p>
            <h2 id="day-preview-title" className="mt-1 text-3xl font-black text-ink">
              {locale === 'ru' ? `Урок ${day.day}` : locale === 'en' ? `Lesson ${day.day}` : `${day.day}-dars`}
            </h2>
          </div>
          <button type="button" onClick={onDismiss} aria-label={close} className="flex size-10 shrink-0 items-center justify-center rounded-full text-2xl text-ink-muted transition hover:bg-ground-sunken hover:text-ink">×</button>
        </div>

        <div className="mt-7 rounded-2xl bg-signal-soft/60 p-4">
          <p className="text-xs font-black tracking-[.12em] text-signal-ink uppercase">{focus}</p>
          <p className="mt-3 text-base leading-7 text-ink-muted">{description}</p>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs font-black text-ink-muted">
            <span>{completed} / {total} {locale === 'ru' ? 'разделов' : locale === 'en' ? 'sections' : 'bo‘lim'}</span>
            {isDone && <span className="text-milestone">✓ {locale === 'ru' ? 'Пройдено' : locale === 'en' ? 'Completed' : 'Yakunlangan'}</span>}
          </div>
          <MissionProgress value={completed} max={total} completed={isDone} label={focus} compact />
        </div>

        <div className="mt-6 border-t border-hairline pt-6 sm:mt-auto">
          <Button block size="lg" disabled={isOpening} data-ui-sound="whoosh" onClick={() => onStart(restart)}>
            {isOpening ? 'Yuklanmoqda…' : `${action} →`}
          </Button>
          <Button block variant="ghost" size="lg" className="mt-2" onClick={onDismiss}>{close}</Button>
        </div>
      </aside>
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
  locale,
  showFreeLabel,
  isOpening,
  notice,
  partialProgress,
  onSelect,
}: {
  day: CourseDayView
  maxUnlockedDay: number
  currentDay: number
  locale: Locale
  showFreeLabel: boolean
  isOpening: boolean
  notice: string | null
  partialProgress: { value: number; max: number } | null
  onSelect: () => void
}) {
  const t = useT()
  const isDone = day.completedMissionCount >= day.requiredMissionCount
  const isToday = day.day === currentDay
  const isLocked = !day.isUnlocked && !isDone
  const dayLabel = fill(t.common.day, { day: day.day })
  const focus = getDayFocus(day, locale)
  const progressValue = !isDone && partialProgress
    ? partialProgress.value
    : day.completedMissionCount
  const progressMax = !isDone && partialProgress
    ? partialProgress.max
    : day.requiredMissionCount

  return (
    <button
      type="button"
      onClick={onSelect}
      data-ui-sound="select"
      aria-label={`${dayLabel}: ${focus}`}
      aria-busy={isOpening}
      className={cx(
        'flex min-h-36 w-full flex-col rounded-[var(--radius-card)] border p-4 text-left sm:min-h-44 sm:p-5',
        'transition-[border-color,box-shadow,transform] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2',
        isDone
          ? 'border-milestone/20 bg-milestone-soft/45'
          : isLocked
            ? 'border-hairline bg-ground-raised opacity-65'
            : isToday
              ? 'border-signal/50 bg-signal-soft/45 shadow-[0_8px_24px_rgb(31_111_224/0.06)]'
              : 'border-hairline bg-ground-raised hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-[0_8px_24px_rgb(22_24_29/0.06)]',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cx(
              'flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold tabular-nums',
              isDone
                ? 'bg-milestone text-white'
                : isToday && !isLocked
                  ? 'bg-signal text-on-signal'
                  : 'bg-ground-sunken text-ink-muted',
            )}
          >
            {day.day}
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="flex items-start gap-2">
            <h3 className={cx('line-clamp-2 text-base font-extrabold leading-snug', isLocked ? 'text-ink-muted' : 'text-ink')}>{focus}</h3>
            {isDone && <CompletedGlyph label={t.path.done} />}
            </div>
            <p className="mt-1 text-xs font-semibold text-ink-faint">{dayLabel}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {isToday && !isDone && !isLocked && <Badge tone="signal">{t.path.today}</Badge>}
          {showFreeLabel && <Badge>{t.account.plan.free}</Badge>}
          {isLocked && (
            <Badge tone="caution">
              {day.day > maxUnlockedDay ? t.path.needsPro : t.path.locked}
            </Badge>
          )}
        </div>
      </div>

      <MissionProgress
        value={progressValue}
        max={progressMax}
        completed={isDone}
        label={`${dayLabel}: ${focus}`}
        compact
      />

      <div className={`mt-auto flex items-center gap-3 pt-3 ${notice ? 'justify-between' : 'justify-end'}`}>
        {notice && <span className="text-sm font-semibold text-danger">{notice}</span>}

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
          <MissionCardAction compact>{t.path.startConversation}</MissionCardAction>
        )}
      </div>
    </button>
  )
}

function getDayFocus(day: CourseDayView, locale: Locale): string {
  return pickContent(locale, {
    uz: day.focusUz || fillFallbackDay(day.day, 'uz'),
    ru: day.focusRu,
    en: day.focusEn,
  })
}

function fillFallbackDay(day: number, locale: Locale) {
  if (locale === 'ru') return `День ${day}`
  if (locale === 'en') return `Day ${day}`
  return `${day}-kun`
}

function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-none stroke-current stroke-2 text-ink-faint"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" strokeLinecap="round" />
    </svg>
  )
}
