import { Info } from 'lucide-react'
import { fill, useT } from '../../lib/i18n'
import { clockTime } from '../../lib/usage'

/**
 * Shown instead of a score once the day's graded answers are used. The answer still came back
 * as text; only the grade is held until the learner's next day.
 * Design: 8 · Limits & trials › "30 ta javob · baholash ertaga".
 */
export function ScoringPausedNote({ total, resumesAt }: { total: number; resumesAt?: string | null }) {
  const copy = useT().limits

  return (
    <div role="status" className="flex gap-2.5 rounded-xl bg-caution-soft px-3.5 py-3 text-caution">
      <Info aria-hidden="true" strokeWidth={2.2} className="mt-px size-5 shrink-0" />
      <div>
        <p className="text-[15px] leading-snug font-black">{fill(copy.scoringTitle, { total })}</p>
        <p className="mt-1 text-[13px] leading-normal font-semibold">
          {fill(copy.scoringBody, { total, time: clockTime(resumesAt) })}
        </p>
      </div>
    </div>
  )
}
