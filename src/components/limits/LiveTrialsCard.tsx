import { Check, Clock, Mic, RotateCcw, Flame } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import type { UsageAllowance } from '../../lib/types'
import { clockTime, timeUntil, trialChips } from '../../lib/usage'

/**
 * How many live conversations are left today, drawn as one chip per try: the day's own,
 * the one carried from yesterday, streak trials, and the ones already used.
 * Design: All Screens › 8 · Limits & trials › "Jonli urinishlar".
 */
export function LiveTrialsCard({ usage, minutes }: { usage: UsageAllowance; minutes: number }) {
  const copy = useT().limits
  const chips = trialChips(usage)
  const left = usage.liveTrialsLeft
  const wait = timeUntil(usage.resetsAt)

  return (
    <section
      aria-labelledby="live-trials-title"
      className="flex flex-col gap-3.5 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black tracking-[0.12em] text-ink-faint uppercase">{copy.liveEyebrow}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ground-sunken px-2.5 py-1 text-xs font-extrabold text-ink-muted">
          <Clock aria-hidden="true" strokeWidth={2.2} className="size-4" />
          {fill(copy.liveEach, { minutes })}
        </span>
      </div>

      <h2 id="live-trials-title" className="text-xl leading-snug font-black text-ink">
        {left > 0 ? fill(copy.liveHave, { count: left }) : copy.liveUsedTitle}
      </h2>

      <ul aria-label={copy.liveTitle} className="flex gap-2">
        {Array.from({ length: chips.today }, (_, index) => (
          <TrialChip key={`today-${index}`} tone="signal" icon={<Mic aria-hidden="true" strokeWidth={2.2} className="size-[18px]" />}>
            {copy.chipToday}
          </TrialChip>
        ))}
        {Array.from({ length: chips.carried }, (_, index) => (
          <TrialChip key={`carried-${index}`} tone="coin" icon={<RotateCcw aria-hidden="true" strokeWidth={2.4} className="size-4" />}>
            {copy.chipCarried}
          </TrialChip>
        ))}
        {Array.from({ length: chips.bonus }, (_, index) => (
          <TrialChip key={`bonus-${index}`} tone="coin" icon={<Flame aria-hidden="true" strokeWidth={2.2} className="size-4" />}>
            {copy.chipBonus}
          </TrialChip>
        ))}
        {Array.from({ length: chips.used }, (_, index) => (
          <TrialChip key={`used-${index}`} tone="used" icon={<Check aria-hidden="true" strokeWidth={3} className="size-4" />}>
            {copy.chipDone}
          </TrialChip>
        ))}
      </ul>

      <p className="text-sm leading-relaxed text-ink-muted">
        {left > 0
          ? fill(copy.liveRule, { perDay: usage.liveTrialsPerDay }) + (chips.carried > 0 ? copy.liveRuleCarried : '')
          : copy.liveUsedBody}
      </p>

      <p className="flex items-center gap-1.5 text-[13px] leading-snug font-bold text-ink-faint">
        <Clock aria-hidden="true" strokeWidth={2.2} className="size-4 shrink-0" />
        {left > 0
          ? fill(copy.liveNewAt, { time: clockTime(usage.resetsAt) })
          : wait.hours > 0
            ? fill(copy.liveNextIn, { count: usage.liveTrialsPerDay, hours: wait.hours, minutes: wait.minutes })
            : fill(copy.liveNextInMinutes, { count: usage.liveTrialsPerDay, minutes: wait.minutes })}
      </p>
    </section>
  )
}

const CHIP_TONES = {
  signal: 'border-2 border-signal bg-signal-soft text-signal-ink',
  coin: 'border-2 border-coin-border bg-coin-faint text-coin-ink',
  used: 'border-2 border-dashed border-control-depth bg-ground-sunken text-ink-muted',
} as const

function TrialChip({ tone, icon, children }: { tone: keyof typeof CHIP_TONES; icon: ReactNode; children: ReactNode }) {
  return (
    <li className={cx('flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[14px] px-2 py-2.5 text-center', CHIP_TONES[tone])}>
      {icon}
      <span className="text-xs leading-4 font-extrabold">{children}</span>
    </li>
  )
}
