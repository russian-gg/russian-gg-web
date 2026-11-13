import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '../../src/lib/cx'
import { Card } from './ui'

/*
 * The visual pieces the center pages share — the team's page for one center and the center's
 * own portal — so both read as one product: a tinted round icon beside every figure and every
 * card title.
 */

const tones = {
  signal: 'bg-signal-soft text-signal-ink',
  milestone: 'bg-milestone-soft text-milestone',
  purple: 'bg-[#f1ecfd] text-[#6d4bd8]',
  caution: 'bg-caution-soft text-caution',
  danger: 'bg-danger-soft text-danger',
} as const

export type IconTone = keyof typeof tones

export function IconDot({ Icon, tone = 'signal', size = 'md' }: { Icon: LucideIcon; tone?: IconTone; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={cx('flex shrink-0 items-center justify-center rounded-full', tones[tone], size === 'sm' ? 'size-9' : 'size-11')}
    >
      <Icon className={size === 'sm' ? 'size-[18px]' : 'size-5'} strokeWidth={1.8} />
    </span>
  )
}

/** A figure with a tinted icon beside it. Pass `onClick` and the whole card opens what it counts. */
export function IconStat({
  Icon,
  tone,
  label,
  value,
  note,
  onClick,
}: {
  Icon: LucideIcon
  tone: IconTone
  label: string
  value: ReactNode
  note?: ReactNode
  onClick?: () => void
}) {
  const body = (
    <>
      <IconDot Icon={Icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-extrabold tracking-[0.12em] text-ink-faint uppercase">{label}</div>
        <div className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{value}</div>
        {note && <div className="mt-1 text-sm text-ink-muted">{note}</div>}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex h-full gap-4 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-5 text-left transition-colors hover:border-ink-faint"
      >
        {body}
      </button>
    )
  }

  return (
    <Card as="div" className="flex h-full gap-4">
      {body}
    </Card>
  )
}

/** A card's heading: icon, title, an optional line under it, and an action on the right. */
export function CardTitle({
  Icon,
  tone = 'signal',
  title,
  subtitle,
  action,
  id,
}: {
  Icon: LucideIcon
  tone?: IconTone
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  id?: string
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <IconDot Icon={Icon} tone={tone} size="sm" />
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-lg leading-9 font-extrabold text-ink">
          {title}
        </h2>
        {subtitle && <p className="-mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** A thin bar for "how much of the limit is used". Amber once it is full. */
export function UsageBar({ used, max }: { used: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((100 * used) / max)) : 0
  return (
    <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-ground-sunken">
      <span className={cx('block h-full rounded-full', percent >= 100 ? 'bg-caution' : 'bg-signal')} style={{ width: `${percent}%` }} />
    </span>
  )
}
