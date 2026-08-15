import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { pickContent } from '../lib/content'
import { cx } from '../lib/cx'
import { fill, useLocale, useT, type Locale } from '../lib/i18n'
import type { LearningActivityDayView, LearningActivityView } from '../lib/types'
import { Card } from './ui'

const INTL_TAG: Record<Locale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' }

const MONTHS: Record<Locale, string[]> = {
  uz: [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
  ],
  ru: [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
}

const MONTHS_SHORT: Record<Locale, string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

const WEEKDAYS_LONG: Record<Locale, string[]> = {
  uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}

export function LearningActivity() {
  const t = useT()
  const { locale } = useLocale()
  const coinTargetRef = useRef<HTMLDivElement>(null)
  const rewardStartedFor = useRef<string | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [displayCoins, setDisplayCoins] = useState<number | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [coinPulse, setCoinPulse] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['learning-activity'],
    queryFn: () => api.post<LearningActivityView>('/course/activity/check-in'),
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!data) return

    setSelectedDate((current) =>
      data.days.some((day) => day.date === current) ? current : data.today,
    )

    const celebrationKey = `rgg.coin-celebrated.${data.today}`
    let alreadyCelebrated = false
    try {
      alreadyCelebrated = sessionStorage.getItem(celebrationKey) === '1'
    } catch {
      // A blocked storage API should never cost the learner the visible reward.
    }

    if (
      data.coinAwardedToday &&
      !alreadyCelebrated &&
      rewardStartedFor.current !== data.today
    ) {
      rewardStartedFor.current = data.today
      try {
        sessionStorage.setItem(celebrationKey, '1')
      } catch {
        // The in-memory guard above still prevents a duplicate during this mount.
      }
      setDisplayCoins(Math.max(0, data.coins - 1))
      setCelebrating(true)
      return
    }

    setDisplayCoins(data.coins)
  }, [data])

  const finishReward = useCallback(() => {
    if (!data) return
    setDisplayCoins(data.coins)
    setCelebrating(false)
    setCoinPulse(true)
    window.setTimeout(() => setCoinPulse(false), 650)
  }, [data])

  if (isLoading) return <ActivitySkeleton />

  if (isError || !data) {
    return (
      <Card className="mt-5 border-dashed py-4 text-center text-sm text-ink-muted">
        {t.home.activity.loadFailed}
      </Card>
    )
  }

  const selected = data.days.find((day) => day.date === selectedDate) ?? data.days[0]
  const coins = displayCoins ?? (data.coinAwardedToday ? Math.max(0, data.coins - 1) : data.coins)

  return (
    <>
      {celebrating && (
        <CoinReward
          targetRef={coinTargetRef}
          label={t.home.activity.rewardAnnounce}
          onComplete={finishReward}
        />
      )}

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline px-5 py-5">
          <div>
            <div className="flex items-center gap-2.5">
              <ActivityGlyph />
              <h3 className="text-lg font-extrabold tracking-tight text-ink">
                {t.home.activity.title}
              </h3>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{t.home.activity.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {data.streakDays > 0 && (
              <span className="rounded-full bg-milestone-soft px-3 py-1.5 text-xs font-extrabold text-milestone">
                {fill(t.home.activity.streak, { count: data.streakDays })}
              </span>
            )}
            <div
              ref={coinTargetRef}
              className={cx(
                'flex items-center gap-2 rounded-full border border-coin-border bg-coin-faint px-3 py-1.5',
                'transition-transform duration-300',
                coinPulse && 'scale-110',
              )}
              aria-label={`${coins} ${t.home.activity.coins}`}
            >
              <CoinGlyph className="size-6" />
              <span className="tabular-nums text-sm font-black text-coin-ink">
                {coins}
              </span>
              <span className="text-xs font-bold text-coin-ink opacity-75">
                {t.home.activity.coins}
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-xs font-extrabold tracking-[0.1em] text-ink-faint uppercase">
              {t.home.activity.weeks}
            </span>
            <ActivityLegend less={t.home.activity.less} more={t.home.activity.more} />
          </div>

          <ActivityGrid
            days={data.days}
            selectedDate={selected?.date ?? data.today}
            onSelect={setSelectedDate}
            locale={locale}
            weekdays={t.home.activity.weekdays}
            noActivity={t.home.activity.noActivity}
            futureDay={t.home.activity.futureDay}
          />

          {selected && (
            <DayDetail
              day={selected}
              locale={locale}
              labels={t.home.activity}
            />
          )}
        </div>
      </Card>
    </>
  )
}

function ActivityGrid({
  days,
  selectedDate,
  onSelect,
  locale,
  weekdays,
  noActivity,
  futureDay,
}: {
  days: LearningActivityDayView[]
  selectedDate: string
  onSelect: (date: string) => void
  locale: Locale
  weekdays: string[]
  noActivity: string
  futureDay: string
}) {
  const weeks = useMemo(
    () => Array.from({ length: 7 }, (_, index) => days[index * 7]?.date).filter(Boolean) as string[],
    [days],
  )

  return (
    <div className="overflow-x-auto pb-1">
      <div className="mx-auto w-max min-w-[17.25rem]">
        <div className="mb-1.5 ml-8 grid grid-cols-7 gap-1.5">
          {weeks.map((date) => (
            <span key={date} className="w-7 text-center text-[10px] font-bold text-ink-faint">
              {formatShortDate(date, locale)}
            </span>
          ))}
        </div>

        <div className="flex gap-1.5">
          <div className="grid w-6 grid-rows-7 gap-1.5" aria-hidden="true">
            {weekdays.slice(0, 7).map((label) => (
              <span key={label} className="flex h-7 items-center text-[10px] font-bold text-ink-faint">
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-flow-col grid-rows-7 gap-1.5">
            {days.map((day) => {
              const lessonCount = day.completedLessons.length
              const title = day.isFuture
                ? `${formatLongDate(day.date, locale)} — ${futureDay}`
                : day.visited
                  ? `${formatLongDate(day.date, locale)} — ${lessonCount > 0 ? `${lessonCount} ✓` : '+1 coin'}`
                  : `${formatLongDate(day.date, locale)} — ${noActivity}`

              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={day.isFuture}
                  onClick={() => onSelect(day.date)}
                  title={title}
                  aria-label={title}
                  aria-pressed={selectedDate === day.date}
                  className={cx(
                    'size-7 rounded-[7px] border transition-[transform,box-shadow,background-color] duration-150',
                    day.isFuture && 'cursor-default border-transparent bg-ground-sunken opacity-35',
                    !day.isFuture && !day.visited &&
                      'border-hairline bg-ground-sunken hover:-translate-y-0.5 hover:border-ink-faint',
                    !day.isFuture && day.visited && lessonCount === 0 &&
                      'border-coin-border bg-coin-soft hover:-translate-y-0.5',
                    !day.isFuture && lessonCount === 1 &&
                      'border-coin-border bg-coin hover:-translate-y-0.5',
                    !day.isFuture && lessonCount > 1 &&
                      'border-coin-strong bg-coin-strong hover:-translate-y-0.5',
                    selectedDate === day.date &&
                      'ring-2 ring-signal ring-offset-2 ring-offset-ground-raised',
                  )}
                >
                  {lessonCount > 0 && (
                    <span className="sr-only">{lessonCount}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function DayDetail({
  day,
  locale,
  labels,
}: {
  day: LearningActivityDayView
  locale: Locale
  labels: ReturnType<typeof useT>['home']['activity']
}) {
  return (
    <div className="mt-5 rounded-2xl bg-ground-sunken px-4 py-4" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-ink">{formatLongDate(day.date, locale)}</p>
          {day.isFuture ? (
            <p className="mt-1 text-sm text-ink-muted">{labels.futureDay}</p>
          ) : day.visited ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span className="font-semibold text-coin-ink">{labels.visited}</span>
              {day.firstVisitedAt && (
                <span>{fill(labels.enteredAt, { time: formatTime(day.firstVisitedAt, locale) })}</span>
              )}
              {day.firstVisitedAt && <span>{labels.coinEarned}</span>}
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">{labels.noActivity}</p>
          )}
        </div>
      </div>

      {day.completedLessons.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <p className="text-xs font-extrabold tracking-[0.08em] text-ink-faint uppercase">
            {labels.lessonsCompleted}
          </p>
          <ul className="mt-2 space-y-2">
            {day.completedLessons.map((lesson) => (
              <li key={lesson.missionId} className="flex items-start gap-2 text-sm text-ink">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-milestone-soft text-xs font-black text-milestone"
                  aria-hidden="true"
                >
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="font-bold">
                    {pickContent(locale, { uz: lesson.titleUz, ru: lesson.titleRu, en: lesson.titleEn })}
                  </span>
                  {lesson.courseDay && (
                    <span className="ml-2 text-xs text-ink-muted">
                      {fill(labels.day, { day: lesson.courseDay })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CoinReward({
  targetRef,
  label,
  onComplete,
}: {
  targetRef: RefObject<HTMLDivElement | null>
  label: string
  onComplete: () => void
}) {
  const coinRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const coin = coinRef.current
    const target = targetRef.current
    if (!coin || !target) {
      onComplete()
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const timer = window.setTimeout(onComplete, 550)
      return () => window.clearTimeout(timer)
    }

    let animation: Animation | undefined
    const frame = window.requestAnimationFrame(() => {
      const start = coin.getBoundingClientRect()
      const finish = target.getBoundingClientRect()
      const dx = finish.left + finish.width / 2 - (start.left + start.width / 2)
      const dy = finish.top + finish.height / 2 - (start.top + start.height / 2)

      animation = coin.animate(
        [
          { opacity: 0, transform: 'translateY(-26px) scale(.65) rotateY(0deg)' },
          { opacity: 1, transform: 'translateY(0) scale(1.18) rotateY(180deg)', offset: 0.2 },
          { opacity: 1, transform: 'translateY(0) scale(1) rotateY(360deg)', offset: 0.4 },
          {
            opacity: 1,
            transform: `translate(${dx}px, ${dy}px) scale(.45) rotateY(1080deg)`,
            offset: 0.88,
          },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.2) rotateY(1260deg)` },
        ],
        { duration: 1650, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' },
      )
      void animation.finished.then(onComplete).catch(() => {})
    })

    return () => {
      window.cancelAnimationFrame(frame)
      animation?.cancel()
    }
  }, [onComplete, targetRef])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[100] flex flex-col items-center" role="status">
      <div className="rounded-full border border-coin-border bg-coin-faint px-4 py-2 text-sm font-black text-coin-ink shadow-lg">
        {label}
      </div>
      <div ref={coinRef} className="mt-3 [perspective:600px]">
        <CoinGlyph className="size-12 drop-shadow-[0_8px_9px_rgba(155,105,7,0.28)]" />
      </div>
    </div>
  )
}

function CoinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="coin-face" x1="10" y1="6" x2="38" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF2A8" />
          <stop offset="0.46" stopColor="#F7C94B" />
          <stop offset="1" stopColor="#D99312" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill="#B96C08" />
      <circle cx="24" cy="21.8" r="19" fill="url(#coin-face)" stroke="#FFE889" strokeWidth="1.5" />
      <circle cx="24" cy="21.8" r="14.2" fill="none" stroke="#C98210" strokeWidth="1.8" opacity=".72" />
      <path d="m24 12.4 2.45 5.18 5.68.72-4.16 3.93 1.07 5.63L24 25.1l-5.04 2.76 1.07-5.63-4.16-3.93 5.68-.72L24 12.4Z" fill="#FFF7C5" stroke="#BB720A" strokeWidth="1.15" />
    </svg>
  )
}

function ActivityGlyph() {
  return (
    <span className="flex size-9 items-center justify-center rounded-xl bg-signal-soft text-signal-ink" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round">
        <path d="M5 18V9m7 9V5m7 13v-6" />
      </svg>
    </span>
  )
}

function ActivityLegend({ less, more }: { less: string; more: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-faint" aria-hidden="true">
      <span>{less}</span>
      <span className="size-3 rounded-[3px] bg-ground-sunken" />
      <span className="size-3 rounded-[3px] bg-coin-soft" />
      <span className="size-3 rounded-[3px] bg-coin" />
      <span className="size-3 rounded-[3px] bg-coin-strong" />
      <span>{more}</span>
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <Card className="mt-5 animate-pulse p-5" aria-hidden="true">
      <div className="flex justify-between gap-4">
        <div className="h-5 w-32 rounded bg-ground-sunken" />
        <div className="h-8 w-24 rounded-full bg-ground-sunken" />
      </div>
      <div className="mt-6 h-56 rounded-2xl bg-ground-sunken" />
    </Card>
  )
}

function parseCalendarDate(date: string): Date {
  return new Date(`${date}T12:00:00`)
}

function formatShortDate(date: string, locale: Locale): string {
  const parsed = parseCalendarDate(date)
  return `${parsed.getDate()} ${MONTHS_SHORT[locale][parsed.getMonth()]}`
}

function formatLongDate(date: string, locale: Locale): string {
  const parsed = parseCalendarDate(date)
  const weekday = WEEKDAYS_LONG[locale][parsed.getDay()]
  const day = parsed.getDate()
  const month = MONTHS[locale][parsed.getMonth()]

  if (locale === 'uz') return `${weekday}, ${day}-${month}`
  if (locale === 'ru') return `${weekday}, ${day} ${month}`
  return `${weekday}, ${day} ${month}`
}

function formatTime(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], { hour: '2-digit', minute: '2-digit' }).format(
    new Date(date),
  )
}
