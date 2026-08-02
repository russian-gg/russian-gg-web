import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../lib/cx'

/* -------------------------------------------------------------------------- buttons */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * Controls are pills. Shared geometry lives here so a button, a link styled as a button
 * and a badge can never drift apart.
 *
 * `active:translate-y-px` is the only motion — a press should feel physical without
 * animating layout, and it is disabled automatically under reduced-motion.
 */
const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] ' +
  'font-semibold whitespace-nowrap transition-colors duration-150 ' +
  'active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-40'

/**
 * Every variant states its own hover *and* border, so a variant is never distinguished
 * by colour alone — the outline button keeps a visible edge in both themes.
 */
const variants: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-signal text-on-signal hover:bg-signal-strong',
  secondary:
    'border border-hairline bg-ground-raised text-ink hover:border-ink-faint hover:bg-ground-sunken',
  ghost: 'border border-transparent text-ink-muted hover:bg-ground-sunken hover:text-ink',
  danger: 'border border-danger bg-transparent text-danger hover:bg-danger-soft',
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
}: {
  to: string
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
}) {
  return (
    <Link
      to={to}
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
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'article' | 'div'
}) {
  return (
    <Tag
      className={cx(
        'rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-5',
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
      <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">
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
          'h-12 w-full rounded-xl border bg-ground-raised px-4 text-base text-ink',
          'placeholder:text-ink-faint',
          error ? 'border-danger' : 'border-hairline',
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
        'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        checked
          ? 'border-signal bg-signal-soft'
          : 'border-hairline bg-ground-raised hover:border-ink-faint',
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
      className="h-1.5 w-full overflow-hidden rounded-full bg-ground-sunken"
    >
      <div
        className="h-full rounded-full bg-signal transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
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
  tone?: 'neutral' | 'signal' | 'milestone' | 'caution'
  outline?: boolean
  /** `sm` is the counter chip that rides inside a nav row; `md` is the standalone badge. */
  size?: 'sm' | 'md'
}) {
  const filled = {
    neutral: 'bg-ground-sunken text-ink-muted',
    signal: 'bg-signal-soft text-signal-ink',
    milestone: 'bg-milestone-soft text-milestone',
    caution: 'bg-caution-soft text-caution',
  } as const

  const outlined = {
    neutral: 'border border-hairline text-ink-muted',
    signal: 'border border-signal text-signal-ink',
    milestone: 'border border-milestone text-milestone',
    caution: 'border border-caution text-caution',
  } as const

  const sizing = {
    sm: 'px-2 py-0.5 text-[11px] tabular-nums',
    md: 'px-3 py-1 text-xs',
  } as const

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-[var(--radius-control)] font-semibold',
        sizing[size],
        outline ? outlined[tone] : filled[tone],
      )}
    >
      {children}
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
      <h3 className="text-base font-semibold text-ink">{title}</h3>
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
