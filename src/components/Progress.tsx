import { formatDelta, skillLabelUz } from '../lib/format'
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
  const measured = value !== null && value !== undefined
  const deltaLabel = formatDelta(delta)

  return (
    <div className="flex items-center gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="w-28 shrink-0 text-sm font-medium text-ink">{skillLabelUz[skill]}</span>

      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ground-sunken">
        {measured && (
          <div
            className="h-full rounded-full bg-signal transition-[width] duration-500"
            style={{ width: `${Math.min(100, value)}%` }}
          />
        )}
      </div>

      <span className="w-16 shrink-0 text-right text-sm tabular-nums text-ink-muted">
        {measured ? value : 'Hali yo’q'}
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

/** Milestone timeline for the 90-day path (PRD §7 progress component). */
export function MilestoneTimeline({
  milestones,
  currentDay,
}: {
  milestones: MilestoneView[]
  currentDay: number
}) {
  return (
    <ol className="relative ml-2 border-l border-hairline pl-6">
      {milestones.map((milestone) => {
        const isNext = !milestone.isCompleted && milestone.day >= currentDay
        return (
          <li key={milestone.slug} className="relative pb-7 last:pb-0">
            <span
              aria-hidden="true"
              className={`absolute -left-[1.9rem] top-1 size-3 rounded-full border-2 ${
                milestone.isCompleted
                  ? 'border-milestone bg-milestone'
                  : isNext
                    ? 'border-signal bg-ground'
                    : 'border-hairline bg-ground'
              }`}
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {milestone.day}-kun
              </span>
              {milestone.isCompleted && <Badge tone="milestone">Bajarildi</Badge>}
              {isNext && !milestone.isCompleted && (
                <Badge tone="signal">
                  {milestone.daysRemaining === 0
                    ? 'Bugun'
                    : `${milestone.daysRemaining} kun qoldi`}
                </Badge>
              )}
            </div>

            <h3 className="mt-1 text-base font-semibold text-ink">{milestone.titleUz}</h3>
            <p className="text-support">{milestone.outcomeUz}</p>
          </li>
        )
      })}
    </ol>
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
  if (value === null || value === undefined) {
    return (
      <div>
        <p className="text-3xl font-semibold tracking-tight text-ink-faint">—</p>
        <p className="text-support">Birinchi ovozli mashqdan keyin paydo bo’ladi.</p>
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
            {deltaLabel} · 30 kun
          </span>
        )}
      </div>
      <p className="text-support">Gapirishga ishonch</p>
    </div>
  )
}
