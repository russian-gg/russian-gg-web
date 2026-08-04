import { formatDelta } from '../lib/format'
import { fill, useT } from '../lib/i18n'
import type { MilestoneView, SkillArea } from '../lib/types'
import { Badge } from './ui'

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

  return (
    <div className="flex items-center gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="w-28 shrink-0 text-sm font-medium text-ink">{t.labels.skill[skill]}</span>

      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ground-sunken">
        {measured && (
          <div
            className="h-full rounded-full bg-signal transition-[width] duration-500"
            style={{ width: `${Math.min(100, value)}%` }}
          />
        )}
      </div>

      <span className="w-16 shrink-0 text-right text-sm tabular-nums text-ink-muted">
        {measured ? value : t.common.notYet}
      </span>

      {deltaLabel && (
        <span
          className={`w-10 shrink-0 text-right text-xs font-semibold tabular-nums ${
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
 * The 90-day path as a path: a rail the learner walks up, with one node per milestone.
 *
 * Each node carries its own day, so the shape of the journey is readable without counting
 * rows, and the rail behind it fills in as milestones are reached — the only place in the
 * product that shows the whole 90 days at once.
 */
export function MilestoneTimeline({ milestones }: { milestones: MilestoneView[] }) {
  const t = useT()

  /*
   * Exactly one milestone is the one being walked toward: the first that is not done. This
   * used to be `!isCompleted && day >= currentDay`, which is true of every milestone ahead —
   * so on day one all seven lit up as "next" with seven identical countdown chips, and
   * nothing on the screen said where the learner actually was.
   */
  const nextIndex = milestones.findIndex((milestone) => !milestone.isCompleted)

  return (
    <ol>
      {milestones.map((milestone, index) => {
        const isNext = index === nextIndex
        const isLast = index === milestones.length - 1

        return (
          <li key={milestone.slug} className="grid grid-cols-[2.75rem_1fr] gap-x-4">
            <div className="flex flex-col items-center">
              <MilestoneNode
                day={milestone.day}
                isCompleted={milestone.isCompleted}
                isNext={isNext}
                doneLabel={t.path.done}
              />
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`w-1.5 flex-1 rounded-full ${
                    milestone.isCompleted ? 'bg-milestone' : 'bg-ground-sunken'
                  }`}
                />
              )}
            </div>

            <div className={isLast ? 'pb-1' : 'pb-6'}>
              {/* The one being walked toward gets a surface; the rest stay quiet text. */}
              <div
                className={
                  isNext ? 'rounded-2xl border-2 border-signal bg-signal-soft px-4 py-3' : ''
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
                    {fill(t.common.day, { day: milestone.day })}
                  </span>
                  {milestone.isCompleted && <Badge tone="milestone">{t.path.done}</Badge>}
                  {isNext && (
                    <Badge tone="signal">
                      {milestone.daysRemaining === 0
                        ? t.path.today
                        : fill(t.progress.daysLeft, { count: milestone.daysRemaining })}
                    </Badge>
                  )}
                </div>

                <h3 className="mt-1 text-base font-extrabold text-ink">{milestone.titleUz}</h3>
                <p className="text-support">{milestone.outcomeUz}</p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * One stop on the path. It carries its day rather than a generic dot, so the distance
 * between milestones is legible at a glance, and it sits on the same solid edge every
 * pushable thing in the product sits on — this one is not pushable, so it never sinks.
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
        className="flex size-11 shrink-0 items-center justify-center rounded-full border-2
          border-milestone bg-milestone-soft shadow-[0_3px_0_0_var(--color-milestone)]"
      >
        {/*
          Soft fill with a milestone stroke rather than white on green: `--color-milestone` is
          a deep green in light and a light green in dark, so a white tick would vanish in one
          of them. Same pairing as CheckCircle and Badge tone="milestone".
        */}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-milestone stroke-[3]">
          <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2
        text-sm font-extrabold tabular-nums ${
          isNext
            ? 'border-signal bg-signal text-on-signal shadow-[0_3px_0_0_var(--color-signal-depth)]'
            : 'border-hairline bg-ground-sunken text-ink-faint'
        }`}
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
