import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { BookOpen, CircleCheck, Flame, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useT } from '../../lib/i18n'
import type { AchievementView, LearningActivityView, QuoteView } from '../../lib/types'
import { Card, SectionHeading } from '../ui'
import * as m from 'motion/react-m'
import { Reveal, Sequence } from '../motion'
import { ease, pop, stagger } from '../../lib/motion'

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
  /*
    A bar sweeping for twelve seconds is motion, and somebody who asked for less of it should
    get the filled pill the row used to show rather than a permanent animation in the corner
    of their eye. `MotionConfig` cannot make this call for us: it drops transforms, and this
    animates width.
  */
  const reduced = useReducedMotion()

  const { data } = useQuery({
    queryKey: ['course-quotes'],
    queryFn: () => api.get<QuoteView[]>('/course/quotes'),
    staleTime: 60 * 60_000,
  })

  const quotes = data ?? []

  useEffect(() => {
    if (quotes.length < 2) return
    const id = window.setTimeout(
      () => setIndex((current) => (current + 1) % quotes.length),
      QUOTE_ROTATE_MS,
    )
    return () => window.clearTimeout(id)
  }, [quotes.length, index])

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
        /*
          The current dot is a track rather than a filled pill: blue runs across the grey over
          the twelve seconds until the quote turns over, so the row says how long is left
          rather than only which one is up. It is the same information the rotation already
          had, and it was previously invisible — a line changing itself with no warning reads
          as a glitch the first time somebody catches it mid-sentence.
        */
        <div className="mt-3 flex items-center gap-1.5">
          {quotes.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={t.home.quote.show.replace('{n}', String(i + 1))}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-1.5 overflow-hidden rounded-full bg-hairline transition-[width] duration-300 ${
                i === index ? 'w-6' : 'w-1.5'
              }`}
            >
              {i === index && (
                <m.span
                  /*
                    Keyed on the index so each new quote starts the sweep from empty. Without
                    the key Motion sees the same element with the same target and leaves it
                    sitting at full width.
                  */
                  key={index}
                  aria-hidden="true"
                  className="block h-full rounded-full bg-signal"
                  initial={{ width: reduced ? '100%' : 0 }}
                  animate={{ width: '100%' }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: QUOTE_ROTATE_MS / 1000, ease: 'linear' }
                  }
                />
              )}
            </button>
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
            {/*
              The arc draws rather than appears.

              It is the clearest statement of progress on the home screen, and an arc that is
              simply there is a picture of a number, while an arc that sweeps to its position
              is the ninety days being counted out. The dash array is what is animated -
              `filled` against the rest of the circumference - so the stroke grows along the
              path instead of fading in along its whole length.

              A second, and a slow one by this file's standards. This is the one thing on the
              home rail worth watching finish, and the rail is already a fifth of a second
              behind the lesson card, so nothing is waiting on it.
            */}
            <m.circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--color-signal)"
              strokeWidth="9"
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${filled} ${circumference - filled}` }}
              transition={{ duration: 0.9, ease: ease.enter }}
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
    /*
      A container query, not a breakpoint.

      This panel is one of the few in the product whose width does not follow the viewport: it
      is full width on a phone and then moves into a 21rem rail from `xl`, which is *narrower*
      than the phone. Four columns keyed to the viewport therefore broke in both places at once
      — a `sm:grid-cols-4` would have gone back to four the moment the rail appeared. Asking
      the card how wide it actually is gets the answer right in both.

      Below 24rem of card it is a 2×2 block, which is what the labels need: "Kun ketma-ket"
      does not fit on one line in a quarter of 296px, and it was spilling out of the card.
    */
    <Card className="@container">
      <SectionHeading>{t.home.achievements.title}</SectionHeading>

      {/*
        Small square badges, so they swell in rather than sliding: `pop` is the variant for a
        thing asserting itself, and an achievement is exactly that.
      */}
      <Sequence as="ul" className="mt-3 grid grid-cols-2 gap-x-2 gap-y-4 @[24rem]:grid-cols-4" gap={stagger.tight}>
        {tiles.map((tile) => {
          // Nullish, not `=== null`: the API drops null keys entirely, so an unavailable
          // track arrives as a missing property rather than an explicit null.
          const locked = (tile.value ?? null) === null
          return (
            <Reveal as="li" key={tile.code} variants={pop} className="text-center">
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
              {/* Two lines is the normal case here, so it wraps rather than truncating —
                  a clipped achievement name is worse than a tall one. */}
              <span className="text-support block text-[11px] leading-tight text-balance">
                {tile.titleUz}
              </span>
            </Reveal>
          )
        })}
      </Sequence>
    </Card>
  )
}

function AchievementGlyph({ code, locked }: { code: string; locked: boolean }) {
  if (locked) {
    return (
      <Lock aria-hidden="true" strokeWidth={2} className="size-5" />
    )
  }

  if (code === 'streak_days') {
    return (
      <Flame aria-hidden="true" strokeWidth={1.9} className="size-5" />
    )
  }

  return (
    <CircleCheck aria-hidden="true" strokeWidth={2} className="size-5" />
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

      <Sequence as="ul" className="mt-3 space-y-3" gap={stagger.base}>
        {recent.map((lesson) => (
          <Reveal as="li" key={`${lesson.missionId}-${lesson.completedAt}`} className="flex items-center gap-3">
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
          </Reveal>
        ))}
      </Sequence>
    </Card>
  )
}

function BookGlyph() {
  return (
    <BookOpen aria-hidden="true" strokeWidth={1.9} className="size-4.5" />
  )
}

function TickGlyph() {
  return (
    <CircleCheck aria-hidden="true" strokeWidth={2.2} className="size-5" />
  )
}
