import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../lib/cx'

/* -------------------------------------------------------------------------- buttons */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * Controls are pills. Shared geometry lives here so a button, a link styled as a button
 * and a badge can never drift apart.
 *
 * A button label is a target, not running text: heavier than the surrounding type, and the
 * body's negative tracking is not just cancelled but reversed a little, so short Uzbek and
 * Russian words read as a solid block rather than a cluster.
 */
const base =
  'inline-flex select-none touch-manipulation items-center justify-center gap-2 ' +
  'rounded-[var(--radius-control)] font-extrabold tracking-[0.01em] whitespace-nowrap ' +
  'transition-[background-color,border-color,box-shadow,transform] duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none'

/**
 * The press. A control rests on a solid edge of its own colour and, when pushed, sinks
 * onto it: the button drops by exactly the depth while the edge disappears, so the
 * bottom stays put and only the face moves.
 *
 * Drawn with a shadow rather than a bottom border because the shadow follows the pill
 * radius exactly — a 4px border on a 999px radius renders as a lopsided crescent — and
 * because it costs no layout height, so nothing reflows on press.
 *
 * Each variant supplies its own `--depth`, which is why this string is shared.
 */
const press =
  'shadow-[0_4px_0_0_var(--depth)] ' +
  // Hover lifts: the button rises and its edge grows, so it reads as coming toward the
  // cursor. It used to only darken, which is what a disabled control does.
  'hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_var(--depth)] ' +
  'active:translate-y-1 active:shadow-none'

/**
 * Every variant states its own hover *and* border, so a variant is never distinguished
 * by colour alone — the outline button keeps a visible edge in both themes.
 */
const variants: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-signal text-on-signal hover:bg-signal-hover ' +
    `[--depth:var(--color-signal-depth)] ${press}`,
  // Stays on the raised surface on hover. Sinking it to `ground-sunken` dimmed the one
  // control on the screen the learner was reaching for.
  secondary:
    'border-2 border-hairline bg-ground-raised text-ink hover:border-ink-faint ' +
    `[--depth:var(--color-control-depth)] ${press}`,
  // Flat on purpose: a tertiary action has no face to sink, so it keeps the small nudge.
  ghost:
    'border border-transparent text-ink-muted hover:bg-ground-sunken hover:text-ink active:translate-y-px',
  danger:
    'border border-danger bg-transparent text-danger hover:bg-danger-soft ' +
    `[--depth:var(--color-danger-depth)] ${press}`,
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  // 56px tall with generous horizontal padding: the mission player's answer action.
  lg: 'h-14 px-7 text-base',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Full width. The PRD requires this for the primary action on mobile. */
  block?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx(base, variants[variant], sizes[size], block && 'w-full', className)}
    />
  )
}

export function LinkButton({
  to,
  children,
  variant = 'primary',
  size = 'lg',
  block = false,
  className,
  onClick,
}: {
  to: string
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
  onClick?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cx(base, variants[variant], sizes[size], block && 'w-full', className)}
    >
      {children}
    </Link>
  )
}

/**
 * The play glyph on "Eshitish". Drawn rather than an emoji or an icon font, matching the
 * abstract-iconography rule (PRD §7).
 */
export function PlayGlyph() {
  return (
    <svg viewBox="0 0 10 12" aria-hidden="true" className="size-2.5 fill-current">
      <path d="M0 0.8v10.4a.8.8 0 0 0 1.23.67l8.2-5.2a.8.8 0 0 0 0-1.34L1.23.13A.8.8 0 0 0 0 .8Z" />
    </svg>
  )
}

export function PauseGlyph() {
  return (
    <svg viewBox="0 0 10 12" aria-hidden="true" className="size-2.5 fill-current">
      <path d="M1 0h2.25A1 1 0 0 1 4.25 1v10a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V1A1 1 0 0 1 1 0Zm5.75 0H9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6.75a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

/* ------------------------------------------------------------------------- surfaces */

/** Whitespace and a thin separator, not a boxed dashboard widget (PRD §7). */
export function Card({
  children,
  className,
  as: Tag = 'section',
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode
  className?: string
  as?: 'section' | 'article' | 'div'
}) {
  return (
    <Tag
      {...props}
      className={cx(
        'rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-5',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
        {children}
      </h2>
      {action}
    </div>
  )
}

/** A thin full-width separator. The mission player is built from these. */
export function Rule({ className }: { className?: string }) {
  return <hr className={cx('border-0 border-t border-hairline', className)} />
}

/* ----------------------------------------------------------------------------- text */

/**
 * Uzbek support text. Visually secondary but never hidden, in every phase of the
 * course (PRD §7 language support).
 */
export function UzHint({ children }: { children: ReactNode }) {
  return <p className="text-support mt-1.5">{children}</p>
}

/* ---------------------------------------------------------------------------- forms */

export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const id = props.id ?? props.name ?? label
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cx(
          'h-12 w-full rounded-2xl border-2 bg-ground-raised px-4 text-base text-ink',
          'placeholder:text-ink-faint transition-colors',
          error
            ? 'border-danger'
            : 'border-hairline hover:border-ink-faint focus:border-signal',
          className,
        )}
      />
      {hint && !error && <span className="text-support mt-1 block">{hint}</span>}
      {error && (
        <span id={`${id}-error`} className="mt-1 block text-sm font-medium text-danger">
          {error}
        </span>
      )}
    </label>
  )
}

/**
 * A radio drawn from tokens rather than by the browser. `accent-color` on a native radio
 * leaves the user agent in charge of the ring, which renders near-black in several engines
 * and drags a colour into the palette that the design system does not contain. The input
 * itself stays a real radio — only its painting is ours — so keyboard, grouping and screen
 * readers behave exactly as before.
 */
export function RadioOption({
  name,
  label,
  checked,
  onChange,
}: {
  name: string
  label: ReactNode
  checked: boolean
  onChange: () => void
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3.5',
        'transition-[background-color,border-color,box-shadow,transform] duration-150',
        // The same press as a button: an option is a thing you push, and it now behaves like
        // one. Selected sits down on its edge and stays there.
        'active:translate-y-0.5 active:shadow-none',
        checked
          ? 'border-signal bg-signal-soft translate-y-0.5 shadow-none'
          : 'border-hairline bg-ground-raised shadow-[0_3px_0_0_var(--color-control-depth)] ' +
            'hover:border-ink-faint',
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cx(
          'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal',
          checked ? 'border-signal bg-signal' : 'border-ink-faint bg-ground',
        )}
      >
        {checked && <span className="size-1.5 rounded-full bg-on-signal" />}
      </span>
      <span className="text-base text-ink">{label}</span>
    </label>
  )
}

/**
 * A row of tabs that are real links. Each panel has its own URL, so a tab survives a reload,
 * can be sent to someone, and answers the back button — which a `useState` tab cannot.
 *
 * `role` is deliberately not `tablist`: these navigate rather than toggle, and telling a
 * screen reader they are tabs would promise keyboard behaviour links do not have.
 */
export function TabLinks({
  tabs,
  active,
}: {
  tabs: Array<{ to: string; label: string }>
  active: string
}) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const isActive = tab.to === active
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={isActive ? 'page' : undefined}
            className={cx(
              'shrink-0 rounded-[var(--radius-control)] px-4 py-2 text-sm font-extrabold',
              'transition-[background-color,color,box-shadow,transform] duration-150',
              isActive
                ? 'bg-signal text-on-signal shadow-[0_3px_0_0_var(--color-signal-depth)]'
                : 'text-ink-muted hover:bg-ground-sunken hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

/* ------------------------------------------------------------------------- feedback */

/** Linear mission progress for a session (PRD §7). */
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className="h-3 w-full overflow-hidden rounded-full bg-ground-sunken"
    >
      <div
        className="relative h-full rounded-full bg-signal transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      >
        {/*
          A highlight along the top of the fill. It is what stops a progress bar reading as a
          flat rectangle, and it is drawn rather than a second colour token because it is the
          same colour at a lower opacity whatever the fill happens to be.
        */}
        <span
          aria-hidden="true"
          className="absolute inset-x-1 top-[3px] h-[3px] rounded-full bg-white/35"
        />
      </div>
    </div>
  )
}

/**
 * Status is never conveyed by colour alone: each badge carries its own word, so the
 * meaning survives a colour-vision difference or a greyscale screenshot.
 */
export function Badge({
  children,
  tone = 'neutral',
  outline = false,
  size = 'md',
}: {
  children: ReactNode
  tone?: 'neutral' | 'signal' | 'primary' | 'milestone' | 'caution'
  outline?: boolean
  /** `sm` is the counter chip that rides inside a nav row; `md` is the standalone badge. */
  size?: 'sm' | 'md'
}) {
  const filled = {
    neutral: 'bg-ground-sunken text-ink-muted',
    signal: 'bg-signal-soft text-signal-ink',
    // The brand blue itself rather than a tint of it: this one is meant to be seen from the
    // corner of the eye, against a row that is otherwise deliberately quiet.
    primary: 'bg-signal text-on-signal',
    milestone: 'bg-milestone-soft text-milestone',
    caution: 'bg-caution-soft text-caution',
  } as const

  const outlined = {
    neutral: 'border-2 border-hairline text-ink-muted',
    signal: 'border-2 border-signal text-signal-ink',
    primary: 'border-2 border-signal bg-signal text-on-signal',
    milestone: 'border-2 border-milestone text-milestone',
    caution: 'border-2 border-caution text-caution',
  } as const

  const sizing = {
    sm: 'px-2 py-0.5 text-[11px] tabular-nums',
    md: 'px-3 py-1 text-xs',
  } as const

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-[var(--radius-control)] font-extrabold',
        sizing[size],
        outline ? outlined[tone] : filled[tone],
      )}
    >
      {children}
    </span>
  )
}

/**
 * The track and knob only. The caller owns the button or label that wraps it, so the same
 * switch can sit in a settings row or inside a menu item without either one restyling it.
 */
export function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors',
        checked ? 'border-signal bg-signal' : 'border-hairline bg-ground-sunken',
      )}
    >
      <span
        className={cx(
          // The knob carries the same solid bottom edge the buttons do, so it reads as a
          // physical thing sitting in the track rather than a circle floating on it.
          'absolute size-5 rounded-full bg-white shadow-[0_2px_0_0_rgb(0_0_0/0.12)]',
          'transition-transform',
          checked ? 'translate-x-[1.4375rem]' : 'translate-x-[0.125rem]',
        )}
      />
    </span>
  )
}

/**
 * Completion, drawn instead of spelled out — a tick reads at a glance where a word has to be
 * parsed. It carries its own accessible name, so the meaning is not colour- or shape-only.
 *
 * Soft fill with a `milestone` stroke rather than white-on-green: `--color-milestone` is a
 * deep green in light and a light green in dark, so a white tick would vanish in one of them.
 * This is the same pairing `Badge tone="milestone"` already uses.
 */
export function CheckCircle({
  label = 'Bajarilgan',
  size = 'md',
}: {
  label?: string
  size?: 'sm' | 'md'
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full bg-milestone-soft',
        'border-2 border-milestone/25',
        size === 'sm' ? 'size-7' : 'size-8',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cx(
          'fill-none stroke-milestone stroke-[2.6]',
          size === 'sm' ? 'size-3.5' : 'size-4',
        )}
      >
        <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function Spinner({ label = 'Yuklanmoqda' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-faint" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-hairline border-t-signal" />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <Card className="text-center">
      <h3 className="text-base font-extrabold text-ink">{title}</h3>
      <p className="text-support mx-auto mt-2 max-w-sm">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
    >
      {children}
    </p>
  )
}
