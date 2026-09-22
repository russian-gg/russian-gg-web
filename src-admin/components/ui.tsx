import { Children, isValidElement, useEffect } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useFocusTrap } from '../../src/lib/focus-trap'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from '../../src/lib/cx'
import { Overlay, Reveal, Sequence } from '../../src/components/motion'
import { fadeUp, rise, stagger } from '../../src/lib/motion'

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
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode
  as?: 'section' | 'article' | 'div'
  /* React 19 passes `ref` through as an ordinary prop; `HTMLAttributes` just does not say so. */
  ref?: Ref<HTMLDivElement>
}) {
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

/**
 * An admin screen's outermost element. Its top-level blocks arrive in order.
 *
 * Every screen in the panel is a stack of sections — a header, a row of figures, a table —
 * and before this they all appeared in the same frame, which on a screen with twelve cards
 * reads as a flash rather than as a page. `Sequence` gives them a beat.
 *
 * The children are wrapped here rather than at each call site. Twelve screens rewriting their
 * own section list into `<Reveal>`s is twelve chances to miss one and leave a section that
 * jumps in ahead of its neighbours — and a screen should not have to know it is being
 * animated in order to be animated correctly.
 *
 * `tight` because these stacks run long. At the base gap a ten-section screen would still be
 * arriving 600ms in, which is the panel feeling slow rather than feeling considered.
 *
 * Anything that is not an element — a `false` from a conditional section, a bare string — is
 * passed through untouched. Wrapping `{error && <ErrorNote/>}` when `error` is null would put
 * an empty animated div in the middle of the stack and break the spacing above it.
 */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Sequence gap={stagger.tight} className={className}>
      {Children.map(children, (child) =>
        isValidElement(child) ? <Reveal variants={fadeUp}>{child}</Reveal> : child,
      )}
    </Sequence>
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
    /*
      A `Reveal` rather than a bare card, so a row of figures arrives in order when it sits
      inside a `Sequence` — and still animates on its own when it does not. The context in
      `components/motion.tsx` is what decides which; nothing here has to know.
    */
    <Reveal variants={rise}>
      <Card className="flex h-full flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">{label}</span>
          {badge}
        </div>
        <div className="text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">{value}</div>
        {note && <div className="text-sm text-ink-muted">{note}</div>}
      </Card>
    </Reveal>
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
                /* Without `scope` a screen reader reads a cell as a bare value with nothing
                   naming it — on a twelve-column table that is a list of numbers. */
                scope="col"
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

/**
 * A table row, optionally one that opens something.
 *
 * A clickable row used to be a bare `<tr onClick>` wearing `cursor-pointer`: it looked like a
 * control, and to a keyboard it was not one. On Foydalanuvchilar and Tranzaksiyalar the row
 * *is* the only way into the user drawer, so an operator working by keyboard could not open a
 * record at all.
 *
 * `role="button"` and a tab stop fix the reachability; Enter and Space are handled because a
 * click handler on a non-button element gets neither for free. `label` names the row for
 * anyone who cannot see which one has focus — "Row 4" is not an answer to "open what?".
 *
 * A row with no `onClick` stays a plain `<tr>`: adding a tab stop to every row of a
 * two-hundred-row table would bury the pager behind two hundred presses of Tab.
 */
export function Row({
  children,
  onClick,
  label,
}: {
  children: ReactNode
  onClick?: () => void
  /** Accessible name for a clickable row — usually the thing it opens. */
  label?: string
}) {
  if (!onClick) {
    return <tr className="border-b border-hairline last:border-b-0">{children}</tr>
  }

  return (
    <tr
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        // Space scrolls the page otherwise, which is the opposite of activating the row.
        event.preventDefault()
        onClick()
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
      className={cx(
        'border-b border-hairline last:border-b-0',
        'cursor-pointer hover:bg-ground-sunken',
        // The global `:focus-visible` outline is drawn outside the element, and a table row
        // clips it against its neighbours. Inset instead, so the focused row is unmistakable.
        'focus-visible:outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-signal',
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
  const dialogRef = useFocusTrap<HTMLDivElement>()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    /*
      The dim and the panel animate in and — the part CSS could never do — out. `Overlay` holds
      the subtree mounted until the exit finishes; before it, confirming or cancelling made the
      dialog disappear between two frames, which reads as the panel having crashed rather than
      having been answered.

      The focus trap, Escape and the aria wiring stay here on purpose: `Overlay` animates a
      layer, it is not a dialog framework. See the note on it in `components/motion.tsx`.
    */
    <Overlay open onDismiss={onCancel} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md"
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
    </Overlay>
  )
}

export function Loading({ label = 'Yuklanmoqda' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-ink-muted" role="status">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-signal" strokeWidth={2.4} />
      {label}
    </div>
  )
}

/**
 * The shape of the thing that is coming, drawn in grey while it is fetched.
 *
 * A spinner says "wait"; this says "wait, and here is what for". On the panel that matters
 * more than it sounds — most of these screens resolve into a table or a row of figures, and a
 * placeholder with the right geometry means the page does not jump when the data lands.
 *
 * `role="status"` with the same label the spinner used, so nothing changes for a screen
 * reader: the bars are decoration and are hidden from it entirely.
 */
export function LoadingRows({
  rows = 5,
  label = 'Yuklanmoqda',
}: {
  rows?: number
  label?: string
}) {
  return (
    <div role="status" aria-label={label} className="space-y-2 py-2">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="skeleton h-12 w-full"
          /*
            Each bar's shimmer starts a beat after the one above it, so the highlight travels
            down the list instead of every row pulsing in lockstep — which reads as a strobe.
          */
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
    </div>
  )
}

/** The same idea for a row of figures: three cards' worth of grey. */
export function LoadingStats({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Yuklanmoqda" className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="skeleton h-28 w-full"
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
    </div>
  )
}

/**
 * `role="alert"` so a failure that arrives after the page has settled is announced rather
 * than only drawn — an operator who has tabbed into a filter is told the table underneath did
 * not load. The learner app's note has always done this; this one had not.
 *
 * `onRetry` takes `useAdminQuery`'s `refresh`. Every failure here is a fetch that can simply
 * be run again, and sending somebody to the reload button costs them their filters and their
 * place in a list.
 */
export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border-2 border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      <span>{children}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Qayta urinish
        </Button>
      )}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-ink-muted">{children}</p>
}
