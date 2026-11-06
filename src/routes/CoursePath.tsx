import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Compass, Crown, Gift } from 'lucide-react'
import { useFocusTrap } from '../lib/focus-trap'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { pickContent } from '../lib/content'
import { LESSON_ONE_SECTIONS, readFoundationLessonProgress, type LessonOneProgress } from '../lib/demo-lesson-one'
import { FOUNDATION_LESSON_DAYS, hasFoundationLesson } from '../lib/foundation-days'
import { syncLessonOneCompletion } from '../lib/lesson-one-sync'
import { fill, useLocale, useT, type Locale } from '../lib/i18n'
import { missionLock } from '../lib/mission-lock'
import { missionPath } from '../lib/mission-path'
import { formatPrice } from '../lib/format'
import type { CourseDayView, EntitlementView, MissionSummary, PlansView, ProgressView } from '../lib/types'
import { MissionProgress } from '../components/MissionCard'
import { DaySkyMap, type SkyDay } from '../components/path/DaySkyMap'
import { cheapestDay as cheapestPlanDay } from '../lib/pro-offer'
import { PreviewDialog } from '../components/PreviewDialog'
import { Button, Card, LinkButton, QueryError, Spinner } from '../components/ui'
import { AnimatePresence } from 'motion/react'
import { Meter, Overlay, Reveal } from '../components/motion'

/*
 * Loaded on the first tap: the card reads the lesson content, the largest module in the app,
 * which the path itself never needs.
 */
const LessonDetailsSheet = lazy(() =>
  import('../components/LessonDetailsSheet').then((module) => ({ default: module.LessonDetailsSheet })),
)

/**
 * The last day with anything behind it. Days 31-90 are on the map so the ninety-day timeline is
 * honest about its length, but the server holds only a generic focus line for them — no lesson
 * and no mission — so they are drawn as "coming soon" rather than as a day that looks openable.
 */
const LAST_AUTHORED_DAY = 30

/**
 * Why a day is shut. Only `pro` can be bought out of — a `progress` lock opens by working
 * through the earlier days, so offering Pro there would sell something that does not help.
 */
type LockedDay = { kind: 'pro' | 'progress'; day: number }
type DayNotice = { day: number; text: string }
type SelectedDay = { day: CourseDayView; lockKind: LockedDay['kind'] }

const NO_LOCAL_PROGRESS: LessonOneProgress = { completed: [], isComplete: false }

export function CoursePath() {
  const t = useT()
  const { locale } = useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  /*
   * A locked lesson opened by its address comes back here with ?locked=<day>&kind=<pro|progress>,
   * and the path opens that day's lock dialog, so the learner learns why instead of landing on
   * the list with no word.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const [locked, setLocked] = useState<LockedDay | null>(() => {
    const day = Number(searchParams.get('locked'))
    const kind = searchParams.get('kind')
    return day > 0 && (kind === 'pro' || kind === 'progress') ? { kind, day } : null
  })
  const arrivedLocked = searchParams.has('locked')
  useEffect(() => {
    if (arrivedLocked) setSearchParams({}, { replace: true })
  }, [arrivedLocked, setSearchParams])
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [openingDay, setOpeningDay] = useState<number | null>(null)
  const [notice, setNotice] = useState<DayNotice | null>(null)
  const syncStartedDays = useRef(new Set<number>())

  const { data: days, isLoading, isError, refetch } = useQuery({
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
   * ?open=<day>: back from paying for that day, it opens as if tapped. Only once the map says
   * it is open — the first render can be the map from before the payment.
   */
  const openRequested = Number(searchParams.get('open')) || 0
  const openTarget = openRequested > 0 ? days?.find((day) => day.day === openRequested && day.isUnlocked) : undefined
  useEffect(() => {
    if (!openTarget) return
    setSelectedDay({ day: openTarget, lockKind: 'progress' })
    setPreviewOpen(true)
    setSearchParams({}, { replace: true })
  }, [openTarget, setSearchParams])

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
  /*
   * Lesson progress saved in this browser only counts for days the server has opened. A day the
   * server still locks cannot have been finished on this account, so whatever the browser holds
   * for it is stale — left over from before a reset, for instance — and showing it as done made
   * the map disagree with the course day and everything counted from it.
   */
  const serverUnlockedDays = new Set((days ?? []).filter((day) => day.isUnlocked).map((day) => day.day))
  const foundationProgress = Object.fromEntries(
    FOUNDATION_LESSON_DAYS.map((day) => (
      [day, serverUnlockedDays.has(day) ? readFoundationLessonProgress(user?.id, day) : NO_LOCAL_PROGRESS]
    )),
  ) as Record<number, LessonOneProgress>

  /*
   * Days finished in this browser that the server has not recorded: the completion call failed
   * or the tab closed first. They are replayed here so the map, the course day and what is
   * counted from them — the feedback checkpoints included — agree with what the learner did.
   */
  const unsyncedKey = (days ?? [])
    .filter((day) => day.isUnlocked
      && day.completedMissionCount < day.requiredMissionCount
      && foundationProgress[day.day]?.isComplete === true)
    .map((day) => day.day)
    .join(',')

  useEffect(() => {
    if (!user?.id || !unsyncedKey) return
    const pending = unsyncedKey
      .split(',')
      .map(Number)
      .filter((day) => !syncStartedDays.current.has(day))
    if (pending.length === 0) return
    pending.forEach((day) => syncStartedDays.current.add(day))

    void (async () => {
      // In order: finishing a day is what opens the next one on the server.
      for (const day of pending) {
        try {
          const missions = await queryClient.fetchQuery({
            queryKey: ['day-missions', day],
            queryFn: () => api.get<MissionSummary[]>(`/course/days/${day}/missions`),
          })
          // The same mission the day opens (startDay below); day one keeps its named lesson.
          const mission = (day === 1
            ? missions.find((candidate) => candidate.slug === 'work-introduce-yourself')
            : undefined)
            ?? missions.find((candidate) => !candidate.isLocked)
          if (!mission) continue

          await syncLessonOneCompletion(mission.id)
        } catch {
          // Tried again the next time the map opens.
          syncStartedDays.current.delete(day)
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course-map'] }),
        queryClient.invalidateQueries({ queryKey: ['day-missions'] }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['lesson-feedback'] }),
      ])
    })()
  }, [queryClient, unsyncedKey, user?.id])

  if (isLoading) return <Spinner />
  if (isError || !days) return <QueryError onRetry={() => void refetch()} />

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
    // Past the plan is a Pro lock even while earlier days are unfinished. Checking the order
    // first told a free learner that day 2 "opens by itself" once day 1 was done — which it
    // never does without Pro.
    const lockKind: LockedDay['kind'] = day.day > maxUnlockedDay ? 'pro' : 'progress'

    previousDaysComplete = previousDaysComplete && isComplete
    return { day: displayedDay, lockKind }
  })
  const completedDays = displayedDays.filter(
    ({ day }) => day.completedMissionCount >= day.requiredMissionCount,
  ).length
  const isDayDone = (day: CourseDayView) => day.completedMissionCount >= day.requiredMissionCount
  /** The open day the learner is on: where a progress lock sends them. */
  const todayEntry = displayedDays.find(({ day }) => day.isUnlocked && !isDayDone(day))
  /*
   * The days as the map shows them. Today is the open day the learner is on; a day past the
   * plan is a Pro day; past the authored ones it is not ready yet.
   */
  const todayDay = todayEntry?.day.day
  const skyDays: SkyDay[] = displayedDays.map(({ day, lockKind }) => {
    const done = isDayDone(day)
    const title = day.day > LAST_AUTHORED_DAY ? t.path.comingSoon : getDayFocus(day, locale)
    if (done) return { day: day.day, title, tone: 'done', badge: 'done', status: t.path.done }
    if (day.day > LAST_AUTHORED_DAY) return { day: day.day, title, tone: 'locked', badge: 'locked', status: t.path.comingSoon }
    if (!day.isUnlocked) {
      return lockKind === 'pro'
        ? { day: day.day, title, tone: 'pro', badge: 'pro', status: t.path.needsPro }
        : { day: day.day, title, tone: 'locked', badge: 'locked', status: t.path.locked }
    }
    const started = (foundationProgress[day.day]?.completed.length ?? 0) > 0 || day.completedMissionCount > 0
    return day.day === todayDay
      ? { day: day.day, title, tone: 'current', badge: started ? 'tried' : null, status: t.path.today }
      : { day: day.day, title, tone: 'open', badge: started ? 'tried' : null, status: started ? t.path.inProgress : t.path.sky.open }
  })
  const openSkyDay = (dayNumber: number) => {
    const entry = displayedDays.find(({ day }) => day.day === dayNumber)
    if (!entry) return
    if (entry.day.day > LAST_AUTHORED_DAY && !entry.day.isUnlocked) return
    handleDay(entry.day, entry.lockKind)
  }

  function handleDay(day: CourseDayView, lockKind: LockedDay['kind']) {
    if (!day.isUnlocked) {
      setLocked({ kind: lockKind, day: day.day })
      return
    }

    setSelectedDay({ day, lockKind })
    setPreviewOpen(true)
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
        setLocked({ kind: missionLock(mission) === 'pro' ? 'pro' : lockKind, day: day.day })
        return
      }

      setPreviewOpen(false)
      navigate(`${missionPath(mission)}${restart ? '?start=1' : ''}`)
    } catch {
      setNotice({ day: day.day, text: t.common.loadFailed })
    } finally {
      setOpeningDay(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/*
        The heading the approved design gives the map: where the learner is on the ninety days,
        how much is behind them, and — on the free plan — which days are free and which open
        with Pro. The rest of the screen is the map.
      */}
      <Reveal className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-signal-soft text-signal-ink shadow-[0_8px_24px_rgb(31_111_224/0.12)] sm:flex">
            <Compass aria-hidden="true" strokeWidth={1.8} className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black tracking-[0.12em] text-signal-ink uppercase">{t.path.title}</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              {fill(t.path.hero.subtitle, { day: todayDay ?? progress?.currentDay ?? 1 })}
            </h1>
          </div>
        </div>

        {/* How far along, and on the free plan which days are free and which open with Pro. */}
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-hairline bg-ground-raised px-4 py-3 shadow-[0_4px_16px_rgb(22_24_29/0.05)] sm:w-auto">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
            <span className="shrink-0 text-sm font-extrabold text-ink tabular-nums">
              {fill(t.path.sky.progress, { done: completedDays, total: days.length })}
            </span>
            <Meter
              value={completedDays}
              max={days.length}
              label={t.path.sky.mapLabel}
              className="h-2.5 w-full min-w-24 overflow-hidden rounded-full bg-hairline sm:w-44"
              fillClassName="rounded-full bg-milestone"
            />
            <span className="shrink-0 text-xs font-extrabold text-milestone tabular-nums">
              {Math.round((completedDays / Math.max(1, days.length)) * 100)}%
            </span>
          </div>
          {entitlement?.hasProAccess === false && (
            <>
              <span aria-hidden="true" className="hidden h-8 w-px bg-hairline sm:block" />
              {maxUnlockedDay > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-milestone-soft px-3 py-1.5 text-xs font-extrabold text-milestone">
                  <Gift aria-hidden="true" strokeWidth={2.2} className="size-3.5" />
                  {fill(t.path.sky.freeDays, { last: maxUnlockedDay })}
                </span>
              )}
              <Link
                to="/paywall"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-coin-border bg-coin-soft pr-4 pl-1.5 text-sm font-extrabold text-coin-ink shadow-[0_2px_0_var(--color-coin-border)] transition hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal active:translate-y-px"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-coin">
                  <Crown aria-hidden="true" strokeWidth={2.4} className="size-3.5 text-coin-ink" />
                </span>
                {fill(t.path.sky.proDays, { from: maxUnlockedDay + 1, total: days.length })}
              </Link>
            </>
          )}
        </div>
      </Reveal>

      {notice && (
        <p role="status" className="rounded-2xl bg-caution-soft px-4 py-3 text-sm font-semibold text-caution">
          {fill(t.path.sky.notice, { day: notice.day, text: notice.text })}
        </p>
      )}

      {/* The lesson card floats over the bottom of the map box, inside the same frame. */}
      <Reveal delay={0.1} className="relative">
        <DaySkyMap
          days={skyDays}
          currentDay={todayDay}
          openDay={selectedDay && previewOpen ? selectedDay.day.day : null}
          onOpen={openSkyDay}
        />
        {selectedDay && hasFoundationLesson(selectedDay.day.day) && (
          <Suspense fallback={null}>
          <LessonDetailsSheet
            day={selectedDay.day.day}
            open={previewOpen}
            status={
              isDayDone(selectedDay.day)
                ? 'done'
                : (foundationProgress[selectedDay.day.day]?.completed.length ?? 0) > 0 ? 'inProgress' : 'new'
            }
            completed={foundationProgress[selectedDay.day.day]?.completed.length ?? 0}
            total={LESSON_ONE_SECTIONS.length}
            isOpening={openingDay === selectedDay.day.day}
            onDismiss={() => setPreviewOpen(false)}
            onStart={(restart) => void startDay(selectedDay.day, selectedDay.lockKind, restart)}
          />
          </Suspense>
        )}
      </Reveal>

      {/*
        Held by `AnimatePresence` rather than rendered straight from the condition. Without it
        the dialog is removed from the tree in the same commit the learner dismisses it, and an
        exit animation has nothing left to animate.
      */}
      <AnimatePresence>
        {locked && (
          <LockedDayDialog
            key="locked"
            locked={locked}
            freeDays={maxUnlockedDay}
            readyDays={Math.min(LAST_AUTHORED_DAY, days.length)}
            todayDay={todayEntry?.day.day}
            onDismiss={() => setLocked(null)}
            onGoToToday={
              todayEntry
                ? () => {
                    setLocked(null)
                    handleDay(todayEntry.day, todayEntry.lockKind)
                  }
                : undefined
            }
          />
        )}
      </AnimatePresence>
      {/*
        The day preview keeps its content after being dismissed, and closes by flipping `open`.
        Clearing `selectedDay` on dismiss would empty the panel in the same frame it starts to
        leave, so the learner would watch a blank card slide away.
      */}
      {/*
        A day with an authored lesson opens the same card the missions open on their map: what
        the lesson teaches, how much is in it, and the button that starts it. The dialog stays
        for the few days without a lesson, where there is nothing of the lesson's own to show.
      */}
      {selectedDay && !hasFoundationLesson(selectedDay.day.day) && (
        <DayPreviewDialog
          open={previewOpen}
          selected={selectedDay}
          locale={locale}
          isOpening={openingDay === selectedDay.day.day}
          partialProgress={
            foundationProgress[selectedDay.day.day] && !foundationProgress[selectedDay.day.day].isComplete
              ? { value: foundationProgress[selectedDay.day.day].completed.length, max: LESSON_ONE_SECTIONS.length }
              : null
          }
          onDismiss={() => setPreviewOpen(false)}
          onStart={(restart) => void startDay(selectedDay.day, selectedDay.lockKind, restart)}
        />
      )}
    </div>
  )
}

/**
 * What day N holds, before the learner opens it: the focus of the lesson, what to expect from
 * it, and how far through it they already are.
 *
 * This replaced a drawer that arrived from the screen edge. The content never needed the edge
 * — it is three short lines and one button — and on a desktop it put the explanation as far
 * from the card the learner just tapped as the display allows.
 */
function DayPreviewDialog({
  open,
  selected,
  locale,
  isOpening,
  partialProgress,
  onDismiss,
  onStart,
}: {
  open: boolean
  selected: SelectedDay
  locale: Locale
  isOpening: boolean
  partialProgress: { value: number; max: number } | null
  onDismiss: () => void
  onStart: (restart: boolean) => void
}) {
  const t = useT()
  const { day } = selected
  const focus = getDayFocus(day, locale)
  const isDone = day.completedMissionCount >= day.requiredMissionCount
  const completed = partialProgress?.value ?? day.completedMissionCount
  const total = partialProgress?.max ?? day.requiredMissionCount
  const hasProgress = completed > 0 && !isDone
  const restart = isDone || !hasProgress
  const copy = t.dayPreview
  const action = isDone ? copy.repeat : hasProgress ? copy.resume : copy.start

  return (
    <PreviewDialog
      open={open}
      eyebrow={fill(copy.lessonDay, { day: day.day })}
      title={focus}
      closeLabel={copy.close}
      primaryLabel={isOpening ? `${t.common.loading}…` : `${action} →`}
      primaryDisabled={isOpening}
      onPrimary={() => onStart(restart)}
      onDismiss={onDismiss}
    >
      <div className="rounded-2xl bg-signal-soft/60 p-4">
        <p className="text-xs font-black tracking-[.12em] text-signal-ink uppercase">{t.preview.whatToExpect}</p>
        <p className="mt-2 text-base leading-7 text-ink-muted">{copy.description}</p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 text-xs font-black text-ink-muted">
          <span>{completed} / {total} {copy.sections}</span>
          {isDone && <span className="text-milestone">✓ {copy.completed}</span>}
        </div>
        <MissionProgress value={completed} max={total} completed={isDone} label={focus} compact />
      </div>
    </PreviewDialog>
  )
}

/**
 * A shut day, and the one thing that opens it. The Pro case leads with buying, because that
 * is the actual next step — an "understood" button was a dead end at the exact moment the
 * learner reached for more of the course.
 */
function LockedDayDialog({
  locked,
  freeDays,
  readyDays,
  todayDay,
  onDismiss,
  onGoToToday,
}: {
  locked: LockedDay
  /** The last day this learner has without Pro: day 1, or more with a won bonus. */
  freeDays: number
  /** Days with a written lesson. Pro is not sold on days that still say "coming soon". */
  readyDays: number
  /** The open day the learner is on, named on the button that leads back to it. */
  todayDay?: number
  onDismiss: () => void
  /** Opens the day that is actually next. Absent when there is no open day to send them to. */
  onGoToToday?: () => void
}) {
  const lockedRef = useFocusTrap<HTMLDivElement>()
  const t = useT()
  const { locale } = useLocale()
  const isPro = locked.kind === 'pro'

  // The cheapest day of Pro, on the button where the decision is made. The paywall's own
  // query: a learner going on to it finds the prices already loaded.
  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<PlansView>('/billing/plans'),
    enabled: isPro,
  })
  const cheapestDay = cheapestPlanDay(plans)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    <Overlay open onDismiss={onDismiss} backdropClassName="bg-black/35">
      <Card
        className="w-full max-w-md"
        onClick={(event) => event.stopPropagation()}
        ref={lockedRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-day-title"
      >
        <h2 id="locked-day-title" className="text-lg font-extrabold text-ink">
          {isPro ? fill(t.path.lockedProTitle, { day: locked.day }) : t.path.lockedProgressTitle}
        </h2>

        <p className="text-support mt-2">
          {isPro
            ? fill(freeDays > 1 ? t.path.lockedProBodyRange : t.path.lockedProBody, {
                last: freeDays,
                ready: readyDays,
              })
            : fill(t.path.lockedProgressBody, { day: locked.day })}
        </p>

        {isPro ? (
          <>
            <LinkButton to={`/paywall?day=${locked.day}`} block className="mt-5">
              {cheapestDay
                ? fill(t.path.seeProPerDay, { amount: formatPrice(cheapestDay.tiyin, cheapestDay.currency, locale) })
                : t.path.seePro}
            </LinkButton>
            {onGoToToday && todayDay ? (
              <Button variant="ghost" block className="mt-2" onClick={onGoToToday}>
                {fill(t.path.finishDayFirst, { day: todayDay })}
              </Button>
            ) : (
              <Button variant="ghost" block className="mt-2" onClick={onDismiss}>
                {t.common.later}
              </Button>
            )}
          </>
        ) : onGoToToday ? (
          <>
            <Button block className="mt-5" onClick={onGoToToday}>
              {t.path.goToToday}
            </Button>
            <Button variant="ghost" block className="mt-2" onClick={onDismiss}>
              {t.common.understood}
            </Button>
          </>
        ) : (
          <Button className="mt-5" onClick={onDismiss}>
            {t.common.understood}
          </Button>
        )}
      </Card>
    </Overlay>
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
