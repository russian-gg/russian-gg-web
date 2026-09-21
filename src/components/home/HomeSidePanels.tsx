import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useT } from '../../lib/i18n'
import type { AchievementView, LearningActivityView, QuoteView } from '../../lib/types'
import { Card, SectionHeading } from '../ui'

/** Long enough to read a proverb twice without it feeling like a slideshow. */
const QUOTE_ROTATE_MS = 12_000

/**
 * The quote corner.
 *
 * Russian first and Uzbek underneath, not the other way round: the line is the thing being
 * read, and putting the translation on top turns a moment of practice into a caption.
 */
export function QuoteCard() {
  const t = useT()
  const [index, setIndex] = useState(0)

  const { data } = useQuery({
    queryKey: ['course-quotes'],
    queryFn: () => api.get<QuoteView[]>('/course/quotes'),
    staleTime: 60 * 60_000,
  })

  const quotes = data ?? []

  useEffect(() => {
    if (quotes.length < 2) return
    const id = window.setInterval(
      () => setIndex((current) => (current + 1) % quotes.length),
      QUOTE_ROTATE_MS,
    )
    return () => window.clearInterval(id)
  }, [quotes.length])

  if (quotes.length === 0) return null

  const quote = quotes[Math.min(index, quotes.length - 1)]

  return (
    <Card>
      <span aria-hidden="true" className="block text-2xl leading-none font-black text-signal">
        &ldquo;
      </span>

      {/* Polite: a line that changes itself must not interrupt whatever is being read. */}
      <blockquote aria-live="polite" className="mt-2">
        <p className="text-[15px] leading-snug font-bold text-ink">{quote.textRu}</p>
        {quote.textUz && <p className="text-support mt-1.5 text-xs">{quote.textUz}</p>}
        <footer className="text-support mt-2.5 text-xs">— {quote.attributionRu}</footer>
      </blockquote>

      {quotes.length > 1 && (
        <div className="mt-3 flex items-center gap-1.5">
          {quotes.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={t.home.quote.show.replace('{n}', String(i + 1))}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-signal' : 'w-1.5 bg-hairline'
              }`}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

/**
 * Where the learner is on the ninety days, as a ring.
 *
 * The ring is an SVG rather than a conic gradient so the track and the fill can carry the
 * product's own tokens and the whole thing survives a theme change without a second palette.
 */
export function ProgressRing({ currentDay, total = 90 }: { currentDay: number; total?: number }) {
  const t = useT()
  const done = Math.max(0, Math.min(currentDay - 1, total))
  const remaining = total - done

  const radius = 42
  const circumference = 2 * Math.PI * radius
  const filled = total === 0 ? 0 : (done / total) * circumference

  return (
    <Card>
      <SectionHeading action={<Link to="/progress" className="text-sm font-bold text-signal-ink">{t.home.more}</Link>}>
        {t.home.progressPanel.title}
      </SectionHeading>

      <div className="mt-3 flex items-center gap-5">
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 100" className="size-24 -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-hairline)" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--color-signal)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference - filled}`}
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg leading-none font-black text-ink">
              {done}/{total}
            </span>
            <span className="text-support text-[11px]">{t.home.progressPanel.days}</span>
          </span>
        </div>

        <dl className="min-w-0 flex-1 space-y-2 text-sm">
          <LegendRow color="var(--color-signal)" label={t.home.progressPanel.done} value={done} />
          <LegendRow color="var(--color-hairline)" label={t.home.progressPanel.left} value={remaining} />
        </dl>
      </div>
    </Card>
  )
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <dt className="text-support min-w-0 flex-1 truncate">{label}</dt>
      <dd className="font-bold text-ink">{value}</dd>
    </div>
  )
}

/**
 * The achievement tiles.
 *
 * A track with no number behind it yet is drawn closed rather than at zero. Zero is a score,
 * and scoring somebody on work the course has never offered them is just a small lie told in
 * a friendly font.
 */
export function AchievementsPanel() {
  const t = useT()
  const { data } = useQuery({
    queryKey: ['course-achievements'],
    queryFn: () => api.get<AchievementView[]>('/course/achievements'),
    staleTime: 60_000,
  })

  const tiles = data ?? []
  if (tiles.length === 0) return null

  return (
    <Card>
      <SectionHeading>{t.home.achievements.title}</SectionHeading>

      <ul className="mt-3 grid grid-cols-4 gap-2">
        {tiles.map((tile) => {
          // Nullish, not `=== null`: the API drops null keys entirely, so an unavailable
          // track arrives as a missing property rather than an explicit null.
          const locked = (tile.value ?? null) === null
          return (
            <li key={tile.code} className="text-center">
              <span
                aria-hidden="true"
                className={`mx-auto grid size-11 place-items-center rounded-full ${
                  locked ? 'bg-ground-sunken text-ink-faint' : 'bg-signal-soft text-signal'
                }`}
              >
                <AchievementGlyph code={tile.code} locked={locked} />
              </span>
              <span className="mt-1.5 block text-base font-black text-ink">
                {locked ? '?' : tile.value}
              </span>
              <span className="text-support block text-[10px] leading-tight">{tile.titleUz}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function AchievementGlyph({ code, locked }: { code: string; locked: boolean }) {
  if (locked) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[2]">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
      </svg>
    )
  }

  if (code === 'streak_days') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[1.9]">
        <path
          d="M12 3s5 4.2 5 8.5a5 5 0 0 1-10 0C7 9 9 7.5 9 7.5s.5 2 1.5 2S12 3 12 3Z"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[2]">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** How many finished lessons the panel lists before it stops being a summary. */
const RECENT_LIMIT = 4

/**
 * The last few lessons finished.
 *
 * Read out of the activity window the streak already uses rather than from a new endpoint —
 * that response carries every completed lesson per day, so the list is a flattening of data
 * the page has in hand instead of a second round trip for the same facts.
 */
export function RecentActivity() {
  const t = useT()
  const { data } = useQuery({
    queryKey: ['learning-activity'],
    queryFn: () => api.post<LearningActivityView>('/course/activity/check-in'),
    staleTime: 60_000,
  })

  const recent = (data?.days ?? [])
    .flatMap((day) => day.completedLessons)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, RECENT_LIMIT)

  if (recent.length === 0) return null

  return (
    <Card>
      <SectionHeading>{t.home.recent.title}</SectionHeading>

      <ul className="mt-3 space-y-3">
        {recent.map((lesson) => (
          <li key={`${lesson.missionId}-${lesson.completedAt}`} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-signal-soft text-signal"
            >
              <BookGlyph />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{lesson.titleUz}</span>
              {lesson.courseDay != null && (
                <span className="text-support block text-xs">
                  {t.home.recent.day.replace('{day}', String(lesson.courseDay))}
                </span>
              )}
            </span>
            <span aria-label={t.path.done} className="shrink-0 text-milestone">
              <TickGlyph />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function BookGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5 fill-none stroke-current stroke-[1.9]">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" strokeLinejoin="round" />
    </svg>
  )
}

function TickGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current stroke-[2.2]">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
