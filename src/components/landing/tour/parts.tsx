import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../../lib/cx'

/** Resting heights of the bars, so an idle signal still reads as a waveform rather than a row of dots. */
const REST = [0.35, 0.6, 0.85, 0.5, 0.95, 0.55, 0.7, 0.4, 0.8, 0.45, 0.65, 0.3]

/**
 * A voice signal in the product's own idiom (`components/VoiceSignal.tsx`): plain bars that
 * move only while a voice is being heard.
 */
export function VoiceBars({
  active,
  count = 7,
  className,
  barClassName = 'bg-signal',
}: {
  active: boolean
  count?: number
  className?: string
  barClassName?: string
}) {
  return (
    <span className={cx('tour-bars', active && 'tour-bars-on', className)}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cx('tour-bar', barClassName)}
          style={{ '--rest': REST[i % REST.length], animationDelay: `${(i * 97) % 520}ms` } as CSSProperties}
        />
      ))}
    </span>
  )
}

/** The app's top bar inside a mock. */
export function MockHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-hairline bg-ground px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-signal text-[13px] font-black text-on-signal">R</span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-black text-ink">{title}</p>
          {sub && <p className="truncate text-[11px] font-bold text-ink-faint">{sub}</p>}
        </div>
      </div>
      {right}
    </header>
  )
}

/** The gold energy/points chip the product shows in its headers. */
export function CoinChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-coin-border bg-coin-faint px-2.5 py-1 text-[13px] font-black text-coin-ink tabular-nums">
      <span className="size-3.5 rounded-full border-2 border-coin-strong bg-coin" />
      {children}
    </span>
  )
}
