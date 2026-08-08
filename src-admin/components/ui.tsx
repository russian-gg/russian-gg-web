import { useEffect } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cx } from '../../src/lib/cx'

/**
 * The admin panel's pieces, built from the learner product's own tokens rather than a second
 * design of its own: same Nunito, same signal blue, same card radius, same control that sits
 * on a solid edge and sinks onto it when pressed. Nothing here introduces a colour — every
 * value is a `--color-*` the learner app already defines.
 *
 * Kept local rather than imported from `src/components/ui.tsx`, which is bound to the
 * learner's router and dictionary; the admin bundle should carry neither.
 */

const press =
  'shadow-[0_4px_0_0_var(--depth)] ' +
  'hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_var(--depth)] ' +
  'active:translate-y-1 active:shadow-none'

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-bold ' +
  'transition-[background-color,box-shadow,transform,border-color] duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none'

const variants = {
  primary:
    'border border-transparent bg-signal text-on-signal hover:bg-signal-hover ' +
    `[--depth:var(--color-signal-depth)] ${press}`,
  secondary:
    'border-2 border-hairline bg-ground-raised text-ink hover:border-ink-faint ' +
    `[--depth:var(--color-control-depth)] ${press}`,
  ghost:
    'border border-transparent text-ink-muted hover:bg-ground-sunken hover:text-ink active:translate-y-px',
  danger:
    'border border-danger bg-transparent text-danger hover:bg-danger-soft ' +
    `[--depth:var(--color-danger-depth)] ${press}`,
} as const

const sizes = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
} as const

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  block?: boolean
}) {
  return (
    <button
      {...props}
      type={type}
      className={cx(buttonBase, variants[variant], sizes[size], block && 'w-full', className)}
    />
  )
}

export function Card({
  children,
  className,
  as: Tag = 'section',
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode; as?: 'section' | 'article' | 'div' }) {
  return (
    <Tag
      {...props}
      className={cx(
        'rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
    </header>
  )
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-faint">{children}</h2>
      {action}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'signal' | 'milestone' | 'caution' | 'danger'
}) {
  const tones = {
    neutral: 'bg-ground-sunken text-ink-muted',
    signal: 'bg-signal-soft text-signal-ink',
    milestone: 'bg-milestone-soft text-milestone',
    caution: 'bg-caution-soft text-caution',
    danger: 'bg-danger-soft text-danger',
  } as const

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-bold',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

/**
 * A figure and what it counts. The label comes first and small: an operator scanning the row
 * is looking for the number, and a heading the same weight as the value makes them read twice.
 */
export function Stat({
  label,
  value,
  note,
  badge,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  badge?: ReactNode
}) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">{label}</span>
        {badge}
      </div>
      <div className="text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">{value}</div>
      {note && <div className="text-sm text-ink-muted">{note}</div>}
    </Card>
  )
}

/** The 7/30/90 switch. One control, three states, and the current one is filled. */
export function PeriodToggle({
  value,
  onChange,
  options = [7, 30, 90],
}: {
  value: number
  onChange: (days: number) => void
  options?: number[]
}) {
  return (
    <div
      className="inline-flex rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised p-1"
      role="group"
      aria-label="Davr"
    >
      {options.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          aria-pressed={value === days}
          className={cx(
            'rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-bold transition-colors',
            value === days ? 'bg-signal text-on-signal' : 'text-ink-muted hover:text-ink',
          )}
        >
          {days} kun
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ id: T; label: string; badge?: number }>
}) {
  return (
    <div
      className="inline-flex rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised p-1"
      role="tablist"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={cx(
            'relative rounded-[var(--radius-control)] px-4 py-1.5 text-sm font-bold transition-colors',
            value === option.id ? 'bg-signal text-on-signal' : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
          {/*
            Sits on the corner rather than in the line, so a count that appears and disappears
            never reflows the row of tabs under the pointer. Ringed in the surface colour so it
            reads as sitting on top of the tab instead of denting its edge.
          */}
          {option.badge !== undefined && option.badge > 0 && (
            <span
              aria-label={`${option.badge} ta o'qilmagan`}
              className="absolute -top-1.5 -right-1 min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-center text-[11px] leading-none font-extrabold text-on-danger ring-2 ring-ground-raised"
            >
              {option.badge > 99 ? '99+' : option.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function TextField({
  value,
  onChange,
  placeholder,
  onSubmit,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onSubmit?: () => void
  className?: string
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSubmit?.()
      }}
      className={cx(
        'h-11 rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4',
        'text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none',
        className,
      )}
    />
  )
}

export function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  label: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 max-w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-3 text-sm font-semibold text-ink focus:border-signal focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/* ------------------------------------------------------------------------------- tables */

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {head.map((column) => (
              <th
                key={column}
                className="border-b-2 border-hairline px-3 py-3 text-xs font-extrabold whitespace-nowrap uppercase tracking-[0.12em] text-ink-faint sm:px-4"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Row({
  children,
  onClick,
}: {
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        'border-b border-hairline last:border-b-0',
        onClick && 'cursor-pointer hover:bg-ground-sunken',
      )}
    >
      {children}
    </tr>
  )
}

export function Cell({
  children,
  strong = false,
  muted = false,
  wrap = false,
}: {
  children: ReactNode
  strong?: boolean
  muted?: boolean
  /**
   * Let this cell's text wrap. Off by default: a table that has to scroll sideways is only
   * readable if its columns keep their shape, and a date broken over three lines on a phone
   * makes every row a different height.
   */
  wrap?: boolean
}) {
  return (
    <td
      className={cx(
        'px-3 py-3 align-middle text-sm sm:px-4',
        wrap ? 'whitespace-normal' : 'whitespace-nowrap',
        strong ? 'font-bold text-ink' : muted ? 'text-ink-muted' : 'text-ink',
      )}
    >
      {children}
    </td>
  )
}

export function Pager({
  page,
  total,
  pageSize = 20,
  onPage,
}: {
  page: number
  total: number
  pageSize?: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex items-center justify-end gap-3 pt-4">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Oldingi
      </Button>
      <span className="text-sm tabular-nums text-ink-muted">
        {page} / {pages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Keyingi
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------------------- states */

/**
 * Asked before something that cannot be taken back.
 *
 * A dialog rather than window.confirm because the native one cannot say *what* is about to
 * go — and "are you sure?" over a list of twelve weeks is not a question anybody can answer
 * correctly. The name of the thing is in the body.
 *
 * Escape and the backdrop both cancel; only the button confirms. Cancel is the primary-looking
 * button on purpose, so the emphasis sits on the reversible choice.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string
  body: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <Card
        as="div"
        className="w-full max-w-md"
        // The card is inside the backdrop, so a click on it would otherwise close the dialog
        // the moment somebody reaches for the buttons.
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            Bekor qilish
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Bajarilmoqda…' : confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function Loading({ label = 'Yuklanmoqda' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-ink-muted" role="status">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-hairline border-t-signal"
      />
      {label}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[var(--radius-card)] border-2 border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{children}</p>
}
