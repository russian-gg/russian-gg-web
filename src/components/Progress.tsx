import { Link } from 'react-router-dom'
import {
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  Headphones,
  Lock,
  Mic,
  type LucideIcon,
} from 'lucide-react'
import { formatDelta } from '../lib/format'
import { pickContent } from '../lib/content'
import { cx } from '../lib/cx'
import { fill, useLocale, useT } from '../lib/i18n'
import type { MilestoneView, SkillArea } from '../lib/types'
import { Badge } from './ui'
import { CountUp, Meter, Reveal, SequenceInView } from './motion'
import { fadeIn, pop, stagger } from '../lib/motion'

// A stage slides in from the rail it hangs on.
const fromRail = fadeIn('left', 16)

const SKILL_ICONS: Record<SkillArea, LucideIcon> = {
  Listening: Headphones,
  Speaking: Mic,
  Pronunciation: AudioLines,
  Vocabulary: BookOpen,
  Grammar: FileText,
}

/**
 * A skill row. An unmeasured skill shows a dash rather than a zero bar: "not measured" and
 * "measured badly" must not look the same (PRD principle 6).
 */
export function SkillRow({
  skill,
  value,
  delta,
}: {
  skill: SkillArea
  value: number | null | undefined
  delta?: number | null
}) {
  const t = useT()
  const measured = value !== null && value !== undefined
  const deltaLabel = formatDelta(delta)
  const Icon = SKILL_ICONS[skill]

  return (
    <div className="group flex items-center gap-2 py-2 sm:gap-3">
      <span className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-ground-sunken text-ink-muted transition-colors sm:flex duration-150 group-hover:bg-signal-soft group-hover:text-signal-ink">
        <Icon aria-hidden="true" strokeWidth={1.8} className="size-[1.15rem]" />
      </span>

      <span className="w-24 shrink-0 text-sm font-semibold wrap-break-word text-ink sm:w-28">{t.labels.skill[skill]}</span>

      <Meter
        value={measured ? value : null}
        label={t.labels.skill[skill]}
        className="h-3 flex-1 overflow-hidden rounded-full bg-ground-sunken"
        fillClassName="rounded-full bg-signal"
      />

      <span className="min-w-9 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-muted">
        {measured ? <CountUp value={value} /> : t.common.notYet}
      </span>

      {deltaLabel && (
        <span
          className={`w-9 shrink-0 text-right text-xs font-semibold tabular-nums ${
            (delta ?? 0) >= 0 ? 'text-milestone' : 'text-signal-ink'
          }`}
        >
          {deltaLabel}
        </span>
      )}
    </div>
  )
}

/**
 * The 90-day path as a path: a rail the learner walks down, with one node per milestone.
 *
 * Each node carries its own day, so the shape of the journey is readable without counting
 * rows. The stage being walked toward is the only one that is a surface you can press — it
 * leads to the course map — and the ones beyond it show a lock, because they are exactly that.
 */
export function MilestoneTimeline({
  milestones,
  nextHref,
  nextLabel,
}: {
  milestones: MilestoneView[]
  /** Where the stage being walked toward leads. */
  nextHref: string
  nextLabel: string
}) {
  const t = useT()
  const { locale } = useLocale()

  /*
   * Exactly one milestone is the one being walked toward: the first that is not done. This
   * used to be `!isCompleted && day >= currentDay`, which is true of every milestone ahead —
   * so on day one all seven lit up as "next" with seven identical countdown chips, and
   * nothing on the screen said where the learner actually was.
   */
  const nextIndex = milestones.findIndex((milestone) => !milestone.isCompleted)

  return (
    /*
      The stages arrive when the list is scrolled to, one after another, each from the side of
      the rail it hangs on — the order they will be walked in. On a phone this list is below
      the fold, and a sequence that had already played by the time it was reached would be a
      list that just sat there.
    */
    <SequenceInView as="ol" gap={stagger.base}>
      {milestones.map((milestone, index) => {
        const isNext = index === nextIndex
        const isLast = index === milestones.length - 1
        const title = pickContent(locale, { uz: milestone.titleUz, ru: milestone.titleRu, en: milestone.titleEn })
        const outcome = pickContent(locale, { uz: milestone.outcomeUz, ru: milestone.outcomeRu, en: milestone.outcomeEn })

        const body = (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cx(
                    'text-xs font-extrabold tracking-widest uppercase',
                    isNext ? 'text-signal-ink' : 'text-ink-faint',
                  )}
                >
                  {fill(t.common.day, { day: milestone.day })}
                </span>
                {milestone.isCompleted && <Badge tone="milestone">{t.path.done}</Badge>}
                {isNext && (
                  <Badge tone="milestone">
                    {milestone.daysRemaining === 0
                      ? t.path.today
                      : fill(t.progress.daysLeft, { count: milestone.daysRemaining })}
                  </Badge>
                )}
              </div>

              <h3 className="mt-1 text-base font-extrabold text-ink">{title}</h3>
              <p className="text-sm leading-snug text-ink-muted">{outcome}</p>
            </div>

            <span
              aria-hidden="true"
              className={cx(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                isNext
                  ? 'bg-ground-raised text-signal-ink shadow-[0_2px_8px_rgb(31_111_224/0.18)]'
                  : milestone.isCompleted
                    ? 'bg-milestone-soft text-milestone'
                    : 'bg-ground-sunken text-ink-faint',
              )}
            >
              {isNext ? (
                <ChevronRight strokeWidth={2.4} className="size-5 transition-transform duration-150 group-hover:translate-x-0.5" />
              ) : milestone.isCompleted ? (
                <Check strokeWidth={2.6} className="size-4.5" />
              ) : (
                <Lock strokeWidth={1.9} className="size-4" />
              )}
            </span>
          </>
        )

        return (
          <Reveal key={milestone.slug} as="li" variants={fromRail} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3">
            <div className="flex flex-col items-center">
              <Reveal as="span" variants={pop} className="flex">
                <MilestoneNode
                  day={milestone.day}
                  isCompleted={milestone.isCompleted}
                  isNext={isNext}
                  doneLabel={t.path.done}
                />
              </Reveal>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cx(
                    'my-1 w-0 flex-1 border-l-2',
                    milestone.isCompleted ? 'border-milestone' : 'border-dashed border-hairline',
                  )}
                />
              )}
            </div>

            <div className={isLast ? '' : 'pb-3'}>
              {isNext ? (
                <Link
                  to={nextHref}
                  aria-label={`${title}. ${nextLabel}`}
                  data-ui-sound="select"
                  className="group flex items-center gap-3 rounded-2xl border border-signal/45 bg-signal-soft/55 px-4 py-3.5 shadow-[0_8px_24px_rgb(31_111_224/0.07)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-signal hover:shadow-[0_12px_28px_rgb(31_111_224/0.13)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-hairline/70 bg-ground-raised px-4 py-3.5">
                  {body}
                </div>
              )}
            </div>
          </Reveal>
        )
      })}
    </SequenceInView>
  )
}

/**
 * One stop on the path. It carries its day rather than a generic dot, so the distance
 * between milestones is legible at a glance.
 */
function MilestoneNode({
  day,
  isCompleted,
  isNext,
  doneLabel,
}: {
  day: number
  isCompleted: boolean
  isNext: boolean
  doneLabel: string
}) {
  if (isCompleted) {
    return (
      <span
        role="img"
        aria-label={doneLabel}
        className="mt-2.5 flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-milestone bg-milestone-soft"
      >
        {/*
          Soft fill with a milestone stroke rather than white on green: `--color-milestone` is
          a deep green in light and a light green in dark, so a white tick would vanish in one
          of them. Same pairing as CheckCircle and Badge tone="milestone".
        */}
        <Check aria-hidden="true" strokeWidth={3} className="size-5 text-milestone" />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cx(
        'mt-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold tabular-nums',
        isNext
          ? 'bg-signal text-on-signal shadow-[0_6px_16px_rgb(31_111_224/0.28)] ring-4 ring-signal-soft'
          : 'border-2 border-hairline bg-ground-raised text-ink-muted',
      )}
    >
      {day}
    </span>
  )
}

/**
 * The headline confidence number. Deliberately shows nothing until there is real evidence,
 * rather than inventing a starting score.
 */
export function ConfidenceTrend({
  value,
  delta,
}: {
  value: number | null | undefined
  delta: number | null | undefined
}) {
  const t = useT()

  if (value === null || value === undefined) {
    return (
      <div>
        <p className="text-3xl font-semibold tracking-tight text-ink-faint">—</p>
        <p className="text-support">{t.progress.confidenceEmpty}</p>
      </div>
    )
  }

  const deltaLabel = formatDelta(delta)

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
        {deltaLabel && (
          <span
            className={`text-sm font-semibold tabular-nums ${
              (delta ?? 0) >= 0 ? 'text-milestone' : 'text-signal-ink'
            }`}
          >
            {fill(t.progress.days30, { delta: deltaLabel })}
          </span>
        )}
      </div>
      <p className="text-support">{t.progress.confidence}</p>
    </div>
  )
}
