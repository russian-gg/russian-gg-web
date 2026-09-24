import { Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Card } from '../../components/ui'

/**
 * A card that carries its own title.
 *
 * The settings cards used to sit under a small uppercase `SectionHeading` floating on the grey
 * page, which put each label outside the thing it labelled — four grey captions above four
 * white boxes, none of them visibly attached to the other. The heading moves inside, where it
 * reads as the card's own name, and the right-hand slot takes whatever the section needs to
 * say about itself.
 */
export function SectionCard({
  title,
  subtitle,
  aside,
  children,
  className,
}: {
  title: string
  /** One line saying what the card is for. The settings cards all carry one. */
  subtitle?: string
  /** A caption or a link, opposite the title. Wraps under it when there is no room. */
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-support mt-0.5 text-sm">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  )
}

/**
 * The figures on the settings screens.
 *
 * The mark sits beside the number rather than above it. Stacked, a tile runs four rows deep
 * and three in a row leave a band of empty card underneath; side by side the mark reads as
 * belonging to the figure, and the tile is only as tall as its own content.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'signal',
}: {
  label: string
  /** `null` when the number is not known yet — an em dash, never a zero. */
  value: string | number | null
  hint?: ReactNode
  icon?: LucideIcon
  /**
   * `coin` is the streak, and it is the one figure here that is not blue.
   *
   * Everything else on this screen is a measurement; a streak is the one thing that is
   * *earned*, and the product already reserves its warm colour for exactly that — the flame on
   * Home is the same mark in the same amber. A deliberate single exception, not a second
   * accent colour.
   */
  tone?: 'signal' | 'coin'
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-ground-raised p-4">
      {Icon && (
        <span
          aria-hidden="true"
          className={cx(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            tone === 'coin' ? 'bg-coin-faint text-coin-strong' : 'bg-signal-soft text-signal-ink',
          )}
        >
          <Icon strokeWidth={1.9} className="size-5" />
        </span>
      )}

      <div className="min-w-0">
        <p className="text-[11px] font-extrabold tracking-[0.1em] text-ink-faint uppercase">
          {label}
        </p>
        <p
          className={cx(
            'mt-0.5 text-2xl leading-tight font-extrabold tabular-nums',
            value === null ? 'text-ink-faint' : 'text-ink',
          )}
        >
          {value ?? '—'}
        </p>
        {hint && <div className="text-support mt-0.5 text-xs leading-snug">{hint}</div>}
      </div>
    </div>
  )
}

/**
 * A CEFR level and what it means in practice.
 *
 * The letter alone is jargon to most of this audience — "B2" is a number to somebody who has
 * never sat a language exam — so the plain-language line underneath is not decoration, it is
 * the part that gets read.
 */
export function LevelTile({
  label,
  level,
  meaning,
  icon: Icon,
}: {
  label: string
  level?: string
  meaning?: string
  icon: LucideIcon
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-ground-raised p-4">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal-soft text-signal-ink"
      >
        <Icon strokeWidth={1.9} className="size-5" />
      </span>

      <div className="min-w-0">
        <p className="text-[11px] font-extrabold tracking-[0.1em] text-ink-faint uppercase">
          {label}
        </p>
        <p
          className={cx(
            'mt-0.5 text-2xl leading-tight font-extrabold',
            level ? 'text-ink' : 'text-ink-faint',
          )}
        >
          {level ?? '—'}
        </p>
        {level && meaning && <p className="text-support mt-0.5 text-xs leading-snug">{meaning}</p>}
      </div>
    </div>
  )
}

/**
 * A note the reader is meant to take on board, not a warning.
 *
 * Tinted rather than bordered: this is the product explaining itself, and a box with an edge
 * around it sitting inside a card reads as something having gone wrong.
 */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-signal-soft/60 px-4 py-3">
      <Info aria-hidden="true" strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-signal-ink" />
      <p className="text-sm leading-snug text-ink-muted">{children}</p>
    </div>
  )
}
