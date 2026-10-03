import { Search, type LucideIcon } from 'lucide-react'
import { cx } from '../lib/cx'
import { CountUp, Reveal } from './motion'
import { Button } from './ui'
import { rise } from '../lib/motion'

/*
 * The pieces a catalogue screen is headed by — the Tests tab and the Missions tab both open
 * with a row of counts, a search field and a row of filter pills over a grid of cards. They
 * live here so the two screens are one design rather than two that happen to look alike today.
 */

/**
 * One count from the list below it: how many there are, how many are done.
 *
 * `markClassName` paints the icon's tile (its ground and its colour together) and
 * `valueClassName` the number, so a screen can colour the figure by state or leave it plain.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  markClassName,
  valueClassName = 'text-ink',
}: {
  icon: LucideIcon
  label: string
  value: number
  markClassName: string
  valueClassName?: string
}) {
  return (
    <Reveal variants={rise} className="h-full">
      <div className="flex h-full items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-4 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-signal/30">
        <span className={cx('flex size-11 shrink-0 items-center justify-center rounded-xl', markClassName)}>
          <Icon aria-hidden="true" strokeWidth={1.9} className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-tight text-ink-muted">{label}</p>
          <p className={cx('mt-0.5 text-3xl leading-none font-extrabold tabular-nums', valueClassName)}>
            <CountUp value={value} />
          </p>
        </div>
      </div>
    </Reveal>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  /** Also the field's accessible name: there is no visible label beside a search box. */
  placeholder: string
}) {
  return (
    <label className="relative block w-full lg:max-w-sm">
      <span className="sr-only">{placeholder}</span>
      <Search
        aria-hidden="true"
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-hairline bg-ground-raised pr-4 pl-11 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-signal"
      />
    </label>
  )
}

/**
 * The filters, as pills that wrap: each carries its own count, and four of those do not fit a
 * phone in one row.
 *
 * They are the product's own buttons — the chosen one primary, the others secondary — so they
 * sit on the same pressed edge as everything else that can be pushed. The row gap is a little
 * deeper than the column gap to leave that edge room when the pills wrap.
 */
export function FilterPills<Value extends string>({
  value,
  onChange,
  options,
}: {
  value: Value
  onChange: (value: Value) => void
  options: ReadonlyArray<{ value: Value; label: string; count: number }>
}) {
  return (
    <div className="flex flex-1 flex-wrap gap-x-2 gap-y-3 pb-1">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'primary' : 'secondary'}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label} ({option.count})
        </Button>
      ))}
    </div>
  )
}
