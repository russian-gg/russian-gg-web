import { useEffect, useRef, useState } from 'react'
import { CalendarDays, CircleCheck, Crown, Lock, Play, RotateCcw, Timer } from 'lucide-react'
import { useFocusTrap } from '../lib/focus-trap'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { pickContent } from '../lib/content'
import { cx } from '../lib/cx'
import { LESSON_ONE_SECTIONS, readFoundationLessonProgress, type LessonOneProgress } from '../lib/demo-lesson-one'
import { FOUNDATION_LESSON_DAYS } from '../lib/foundation-days'
import { syncLessonOneCompletion } from '../lib/lesson-one-sync'
import { fill, useLocale, useT, type Locale } from '../lib/i18n'
import { missionPath } from '../lib/mission-path'
import type { CourseDayView, EntitlementView, MissionSummary, ProgressView } from '../lib/types'
import { MissionProgress } from '../components/MissionCard'
import { FilterPills, SearchField, StatTile } from '../components/Catalog'
import { CoursePathHero } from '../components/CoursePathHero'
import { PreviewDialog } from '../components/PreviewDialog'
import { Button, ButtonFace, Card, LinkButton, QueryError, Spinner } from '../components/ui'
import { AnimatePresence } from 'motion/react'
import { CountUp, Meter, Overlay, Reveal, Sequence, SequenceInView } from '../components/motion'
import { pop, rise, stagger } from '../lib/motion'
import lockArt from '../assets/images/lock.webp'

/**
 * The last day with anything behind it. Days 31-90 are on the map so the ninety-day timeline is
 * honest about its length, but the server holds only a generic focus line for them — no lesson
 * and no mission — so they are drawn as "coming soon" rather than as a day that looks openable.
 */
const LAST_AUTHORED_DAY = 30

/**
 * The outline every card on the map shares, whatever its state. The floor is the height of a
 * card with a two-line title, so a row of short titles and a row with a long one match; `h-full`
 * then stretches each card to its own row, which is what keeps an open day (a button in its
 * footer) and a shut one (a word) the same size side by side.
 */
const DAY_CARD_FRAME = 'flex h-full min-h-[13.75rem] w-full rounded-[var(--radius-card)]'

/**
 * What a shut or busy card ends in: a flat pill, the height of the button an open card ends in.
 * Flat on purpose — an open day's footer is a button's face, sitting on its edge, and a day
 * that will not open should not look like something to push.
 */
const DAY_CARD_ACTION = 'inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-extrabold'

/** The state pill in a card's corner, the same shape the missions shelf uses. */
const DAY_CARD_STATE = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold'

/**
 * Why a day is shut. Only `pro` can be bought out of — a `progress` lock opens by working
 * through the earlier days, so offering Pro there would sell something that does not help.
 */
type LockedDay = { kind: 'pro' | 'progress'; day: number }
type DayNotice = { day: number; text: string }
type PathFilter = 'all' | 'active' | 'done' | 'pro'
type SelectedDay = { day: CourseDayView; lockKind: LockedDay['kind'] }

const NO_LOCAL_PROGRESS: LessonOneProgress = { completed: [], isComplete: false }

export function CoursePath() {
  const t = useT()
  const { locale } = useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [locked, setLocked] = useState<LockedDay | null>(null)
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [openingDay, setOpeningDay] = useState<number | null>(null)
  const [notice, setNotice] = useState<DayNotice | null>(null)
  const [filter, setFilter] = useState<PathFilter>('all')
  const [search, setSearch] = useState('')
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
  const isDayDone = (day: CourseDayView) => day.completedMissionCount >= day.requiredMissionCount
  const activeDays = displayedDays.filter(({ day }) => day.isUnlocked && !isDayDone(day)).length
  const counts = {
    all: displayedDays.length,
    done: completedDays,
    active: activeDays,
    // The days Pro opens: shut because of the plan rather than because they are not reached yet.
    pro: displayedDays.filter(({ day }) => !day.isUnlocked && !isDayDone(day) && day.day > maxUnlockedDay).length,
    locked: displayedDays.length - completedDays - activeDays,
  }
  const normalizedSearch = search.trim().toLocaleLowerCase(locale === 'ru' ? 'ru-RU' : locale)
  const visibleDays = displayedDays.filter(({ day }) => {
    const isDone = day.completedMissionCount >= day.requiredMissionCount
    const matchesFilter =
      filter === 'all' ||
      (filter === 'done' && isDone) ||
      (filter === 'active' && day.isUnlocked && !isDone) ||
      // The days Pro opens: shut, and shut because of the plan rather than because the learner
      // has not reached them yet.
      (filter === 'pro' && !day.isUnlocked && !isDone && day.day > maxUnlockedDay)
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
        const isPro = mission.lockReason?.toLowerCase().includes('pro') ?? false
        setLocked({ kind: isPro ? 'pro' : lockKind, day: day.day })
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
    <div className="space-y-5 sm:space-y-8">
      <CoursePathHero completedDays={completedDays} totalDays={90} />

      {/*
        The path counted, the way the missions and tests shelves open: how long it is, how much
        of it is behind the learner, what is open now and what is still shut.
      */}
      <Sequence className="grid grid-cols-2 gap-3 lg:grid-cols-4" gap={stagger.base} delay={0.15}>
        <StatTile icon={CalendarDays} label={t.path.statTotal} value={counts.all} markClassName="bg-signal-soft text-signal-ink" />
        <StatTile icon={CircleCheck} label={t.path.filterDone} value={counts.done} markClassName="bg-milestone-soft text-milestone" />
        <StatTile icon={Timer} label={t.path.filterActive} value={counts.active} markClassName="bg-caution-soft text-caution" />
        <StatTile icon={Lock} label={t.path.locked} value={counts.locked} markClassName="bg-ground-sunken text-ink-muted" />
      </Sequence>

      {/*
        The filters are pills that wrap rather than a segmented control in a tray: there are four
        of them, and the fourth — the Pro days — is the one a learner on the free plan goes
        looking for. A tray of four crowds the phone.
      */}
      <Reveal delay={0.22} className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField value={search} onChange={setSearch} placeholder={t.path.search} />
        <FilterPills
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t.path.filterAll, count: counts.all },
            { value: 'active', label: t.path.filterActive, count: counts.active },
            { value: 'done', label: t.path.filterDone, count: counts.done },
            { value: 'pro', label: t.path.filterPro, count: counts.pro },
          ]}
        />
      </Reveal>

      {phases.map(({ phase, range }) => {
        const phaseDays = visibleDays.filter(({ day }) => day.phase === phase)
        if (phaseDays.length === 0) return null

        return (
          <section key={`${phase}-${range}`}>
            {/*
              The tightest beat in the product, and the only one that could have been.

              A phase of this path is up to thirty cards. At the ordinary 60ms the last one
              would land nearly two seconds after the first, which is not a rhythm, it is a
              wait. At 40ms a full row washes in quickly enough to read as the grid itself
              arriving while still making the direction of travel - left to right, top to
              bottom - completely legible.

              It is also per phase rather than over the whole list: each phase starts its own
              count when it scrolls into view, so a learner opening Day 60 does not sit through
              an imaginary fifty-nine-card animation above them.
            */}
            <SequenceInView className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" gap={stagger.tight}>
              {phaseDays.map(({ day, lockKind }) => (
                /*
                  The `Reveal` is not decoration around the card — it is what makes the card a
                  participant. A sequence reaches its children by propagating a variant label,
                  and a plain component has no variants to receive it, so a bare `<DayCard>`
                  here would sit outside the beat and appear instantly while its neighbours
                  arrived in order.
                */
                <Reveal key={day.day} variants={rise} className="h-full">
                {day.day > LAST_AUTHORED_DAY ? <ComingSoonCard day={day.day} /> : (
                <DayCard
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
                )}
                </Reveal>
              ))}
            </SequenceInView>
          </section>
        )
      })}

      {visibleDays.length === 0 && (
        <Card className="py-10 text-center text-sm font-semibold text-ink-muted">
          {t.path.noResults}
        </Card>
      )}

      {/*
        Held by `AnimatePresence` rather than rendered straight from the condition. Without it
        the dialog is removed from the tree in the same commit the learner dismisses it, and an
        exit animation has nothing left to animate.
      */}
      <AnimatePresence>
        {locked && <LockedDayDialog key="locked" locked={locked} onDismiss={() => setLocked(null)} />}
      </AnimatePresence>
      {/*
        The day preview keeps its content after being dismissed, and closes by flipping `open`.
        Clearing `selectedDay` on dismiss would empty the panel in the same frame it starts to
        leave, so the learner would watch a blank card slide away.
      */}
      {selectedDay && (
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
function LockedDayDialog({ locked, onDismiss }: { locked: LockedDay; onDismiss: () => void }) {
  const lockedRef = useFocusTrap<HTMLDivElement>()
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
    </Overlay>
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
  /*
   * The day topic in Russian, as the second line. A course day carries one focus line per
   * interface language and nothing else, so for a learner reading the Uzbek interface this is
   * the only extra thing on hand — and it happens to be the day in the language being learnt.
   */
  const description = locale === 'ru' ? null : day.focusRu
  const progressValue = !isDone && partialProgress
    ? partialProgress.value
    : day.completedMissionCount
  const progressMax = !isDone && partialProgress
    ? partialProgress.max
    : day.requiredMissionCount

  const inProgress = !isDone && !isLocked && progressValue > 0
  const percent = Math.round((Math.min(progressValue, progressMax) / Math.max(1, progressMax)) * 100)

  return (
    <button
      type="button"
      onClick={onSelect}
      data-ui-sound="select"
      aria-label={`${dayLabel}: ${focus}`}
      aria-busy={isOpening}
      aria-haspopup="dialog"
      className={cx(
        DAY_CARD_FRAME,
        'group flex-col border p-5 text-left',
        'transition-[border-color,box-shadow,transform] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2',
        // A finished day is washed green from its corner, the day under way blue: the same two
        // tints the missions shelf uses, so "done" and "now" look alike across the product.
        isDone
          ? 'border-milestone/20 bg-linear-to-br from-milestone-soft/70 to-ground-raised hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(15_115_85/0.07)]'
          : isLocked
            ? 'border-hairline bg-ground-raised hover:border-ink-faint/40'
            : isToday || inProgress
              ? 'border-signal/45 bg-linear-to-bl from-signal-soft/80 to-ground-raised to-55% shadow-[0_8px_24px_rgb(31_111_224/0.07)] hover:-translate-y-0.5'
              : 'border-hairline bg-ground-raised hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-[0_8px_24px_rgb(22_24_29/0.06)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/*
            The number is the card's anchor — a learner scanning ninety of these is looking for
            a day, not a title — so it keeps its own tile and takes the colour of the state.
          */}
          <span
            className={cx(
              'flex size-12 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold tabular-nums',
              'transition-transform duration-150',
              !isLocked && 'group-hover:scale-105',
              isDone
                ? 'bg-milestone-soft text-milestone'
                : isLocked
                  ? 'bg-ground-sunken text-ink-muted'
                  : 'bg-signal-soft text-signal-ink',
            )}
          >
            {day.day}
          </span>

          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-faint">{dayLabel}</p>
            <h3 className={cx('mt-0.5 line-clamp-2 text-base font-extrabold leading-snug', isLocked ? 'text-ink-muted' : 'text-ink')}>
              {focus}
            </h3>
            {/*
              The same topic in the language being learned. There is no separate blurb on a
              course day — the server sends one focus line per language — and of the things we
              do have, the Russian one is the only one that adds anything next to the title.
            */}
            {description && (
              <p className="mt-1 line-clamp-1 text-sm text-ink-muted" lang="ru">{description}</p>
            )}
          </div>
        </div>

        {/* A shut day says so in its footer, where its button would be; it needs no second label. */}
        <Reveal as="span" variants={pop} className="flex shrink-0 flex-wrap justify-end gap-2">
          {isDone && (
            <span className={cx(DAY_CARD_STATE, 'bg-milestone-soft text-milestone')}>
              <CircleCheck aria-hidden="true" strokeWidth={2.2} className="size-3.5" />
              {t.path.done}
            </span>
          )}
          {!isDone && !isLocked && (isToday || inProgress) && (
            <span className={cx(DAY_CARD_STATE, 'bg-caution-soft text-caution')}>
              <Timer aria-hidden="true" strokeWidth={2.2} className="size-3.5" />
              {t.path.inProgress}
            </span>
          )}
          {showFreeLabel && !isDone && (
            <span className={cx(DAY_CARD_STATE, 'bg-ground-sunken text-ink-muted')}>{t.account.plan.free}</span>
          )}
        </Reveal>
      </div>

      {/* The bar and its percentage on one line; what the percentage is of goes underneath. */}
      <div className="mt-4 flex items-center gap-3">
        {/* Fills when the card is scrolled to: a day's progress is shown, not just reported. */}
        <Meter
          value={Math.min(progressValue, progressMax)}
          max={progressMax}
          label={`${dayLabel}: ${focus}`}
          delay={0.15}
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-ground-sunken"
          fillClassName={cx('rounded-full', isDone ? 'bg-milestone' : 'bg-signal')}
        />
        <span className={cx('min-w-10 text-right text-sm font-bold tabular-nums', isDone ? 'text-milestone' : 'text-ink-muted')}>
          <CountUp value={percent} />%
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-muted tabular-nums">
        {progressValue} / {progressMax} {t.dayPreview.sections}
      </p>

      {/*
        Every state ends in a chip of the same height. A bare word for the shut days and a
        button for the open one made the open card a few pixels taller than its neighbours,
        and the row stopped reading as a row.
      */}
      <div className={`mt-auto flex min-h-16 items-center gap-3 pt-4 pb-1 ${notice ? 'justify-between' : 'justify-end'}`}>
        {notice && <span className="text-sm font-semibold text-danger">{notice}</span>}

        {isDone ? (
          // A finished day offers its repeat on the quieter button; the others lead with the
          // action. Both sit on the product's own pressed edge, moved by the card around them.
          <ButtonFace variant="secondary">
            <RotateCcw aria-hidden="true" strokeWidth={2.2} className="size-4" />
            {t.dayPreview.repeat}
          </ButtonFace>
        ) : isLocked ? (
          // Two different shut doors: Pro is something the learner can act on, so it keeps
          // the warm tone; a day that opens by itself is only waiting, and stays quiet.
          day.day > maxUnlockedDay ? (
            <span className={cx(DAY_CARD_ACTION, 'bg-caution-soft text-caution')}>
              <Crown aria-hidden="true" strokeWidth={1.9} className="size-4" />
              {t.path.needsPro}
            </span>
          ) : (
            <span className={cx(DAY_CARD_ACTION, 'bg-ground-sunken text-ink-muted')}>
              <Lock aria-hidden="true" strokeWidth={1.9} className="size-4" />
              {t.path.locked}
            </span>
          )
        ) : isOpening ? (
          <span className={cx(DAY_CARD_ACTION, 'bg-signal-soft text-signal-ink')}>{t.common.loading}…</span>
        ) : (
          <ButtonFace>
            <Play aria-hidden="true" strokeWidth={2.2} className="size-4 fill-current" />
            {inProgress ? t.dayPreview.resume : t.dayPreview.start}
          </ButtonFace>
        )}
      </div>
    </button>
  )
}

type GhostKind = 'video' | 'document' | 'chart' | 'picture' | 'dots'

// What a coming day might hold, in the order the cards cycle through: a different shape on each
// neighbour, chosen by day number so nothing shifts between renders.
const GHOST_KINDS: readonly GhostKind[] = ['video', 'document', 'chart', 'picture', 'dots']

/**
 * The out-of-focus hint of content on the right of a coming-soon card. Drawn rather than
 * shipped as images: there are sixty of these cards, the shapes are five, and under a blur a
 * few rounded blocks in the brand blue read exactly like a thumbnail does.
 */
function GhostArt({ kind }: { kind: GhostKind }) {
  if (kind === 'video') {
    return (
      <span className="absolute top-1/2 right-4 flex h-24 w-36 -translate-y-1/2 -rotate-6 items-center justify-center rounded-2xl bg-signal/55">
        <span className="ml-1.5 border-y-18 border-l-28 border-y-transparent border-l-white/90" />
      </span>
    )
  }

  if (kind === 'document') {
    return (
      <>
        <span className="absolute top-5 right-6 h-28 w-36 rotate-6 rounded-2xl bg-signal/50" />
        <span className="absolute right-10 bottom-4 flex h-20 w-28 -rotate-3 flex-col justify-center gap-2.5 rounded-xl bg-white/85 px-4">
          <span className="h-2.5 w-full rounded-full bg-signal/60" />
          <span className="h-2.5 w-2/3 rounded-full bg-signal/45" />
        </span>
      </>
    )
  }

  if (kind === 'chart') {
    return (
      <>
        <span
          className="absolute top-1/2 right-6 size-28 -translate-y-1/2 rounded-full"
          style={{ background: 'conic-gradient(var(--color-signal) 0 34%, #f6a8c4 34% 52%, color-mix(in srgb, var(--color-signal) 40%, white) 52% 100%)' }}
        />
        <span className="absolute right-4 top-6 size-14 rounded-tr-full bg-signal/70" />
      </>
    )
  }

  if (kind === 'picture') {
    return (
      <span className="absolute top-1/2 right-5 h-24 w-36 -translate-y-1/2 -rotate-6 overflow-hidden rounded-2xl bg-signal/50">
        <span className="absolute top-4 right-9 size-5 rounded-full bg-[#f6a8c4]" />
        <span className="absolute -bottom-7 left-3 size-16 rotate-45 rounded-md bg-white/80" />
        <span className="absolute -bottom-9 left-16 size-16 rotate-45 rounded-md bg-white/55" />
      </span>
    )
  }

  return (
    <>
      <span className="absolute top-8 right-32 size-9 rounded-full bg-signal/55" />
      <span className="absolute top-7 right-14 size-8 rounded-full bg-signal/40" />
      <span className="absolute right-28 bottom-8 size-8 rounded-full bg-signal/60" />
      <span className="absolute right-10 bottom-10 size-11 rounded-full bg-signal-depth/75" />
    </>
  )
}

/**
 * A day that has no lesson yet. It keeps the outline of a day card, so the grid still reads as
 * one ninety-day path, but everything a real day would say is a blurred ghost of it — two lines
 * of title on the left, a thumbnail on the right — under a lock, the day and "coming soon". It
 * is not a button, because there is nothing to open.
 */
function ComingSoonCard({ day }: { day: number }) {
  const t = useT()
  const dayLabel = fill(t.common.day, { day })
  const kind = GHOST_KINDS[(day - LAST_AUTHORED_DAY - 1) % GHOST_KINDS.length]

  return (
    <div
      role="group"
      aria-label={`${dayLabel}: ${t.path.comingSoon}`}
      className={cx(DAY_CARD_FRAME, 'group relative flex-col items-center justify-center overflow-hidden border border-hairline bg-ground-raised p-5 text-center')}
    >
      {/*
        One blurred layer per card. The lines stop short of the middle and the art keeps to the
        right third, so neither runs under the text — on a phone the art is dropped for the same
        reason: the card is too narrow for it to clear the words.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70 blur-[9px]">
        <span className="absolute top-12 left-8 h-5 w-[26%] max-w-36 rounded-full bg-ink/20" />
        <span className="absolute top-23 left-8 h-3.5 w-[16%] max-w-24 rounded-full bg-ink/15" />
        <span className="hidden sm:contents">
          <GhostArt kind={kind} />
        </span>
      </div>

      <img src={lockArt} alt="" width={72} height={72} loading="lazy" decoding="async" className="relative size-18 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6" />
      <p className="relative mt-1 text-base font-bold text-ink-muted">{dayLabel}</p>
      <p className="relative text-2xl font-extrabold leading-tight text-signal-ink sm:text-[1.7rem]">{t.path.comingSoon}</p>
    </div>
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
