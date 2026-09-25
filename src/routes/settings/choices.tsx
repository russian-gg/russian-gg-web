import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

/**
 * The selection controls on the settings screens.
 *
 * All three are the same thing underneath: a real `<input type="radio">`, visually hidden,
 * with the surrounding label painted to suit. That is not a detail worth economising on —
 * grouping, arrow-key navigation, the screen-reader announcement and the browser's own form
 * semantics all come free from the native input, and every hand-rolled `role="radio"` div has
 * to reimplement them and usually reimplements only some.
 *
 * The painted dot carries `peer-focus-visible`, so a keyboard user sees the focus ring on the
 * thing that looks like the control rather than on a `sr-only` input nobody can see.
 */

const dot = (checked: boolean) =>
  cx(
    'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
    'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal',
    checked ? 'border-signal bg-signal' : 'border-hairline bg-ground',
  )

const surface = (checked: boolean) =>
  cx(
    'relative cursor-pointer rounded-2xl border-2 transition-colors',
    checked ? 'border-signal bg-signal-soft/50' : 'border-hairline bg-ground-raised hover:border-ink-faint',
  )

/**
 * A choice with room to explain itself: a mark, a name, and a line about what picking it means.
 *
 * The radio sits in the top-right rather than beside the title, because the title is not the
 * whole option — the description under it is part of what is being chosen, and a dot indented
 * against one line of a two-line block reads as belonging only to that line.
 */
export function ChoiceTile({
  name,
  checked,
  onChange,
  icon: Icon,
  title,
  hint,
  iconStyle = 'contained',
}: {
  name: string
  checked: boolean
  onChange: () => void
  icon: LucideIcon
  title: string
  hint?: string
  /**
   * How the mark is drawn.
   *
   * `contained` sits it on a tile of its own, which fills solid when the option is picked —
   * the mark is then a second, larger signal of the selection, readable before the radio dot
   * is. That suits the tutor options, where the choice is between characters and the icon is
   * doing most of the telling apart.
   *
   * `bare` is the glyph alone. The theme options are a pair, their names already say which is
   * which, and a filled tile behind a sun would put a second box inside a box for no gain.
   */
  iconStyle?: 'contained' | 'bare'
}) {
  return (
    <label className={cx(surface(checked), 'block p-4')}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />

      <span className="flex items-start justify-between gap-3">
        {iconStyle === 'contained' ? (
          <span
            aria-hidden="true"
            className={cx(
              'grid size-10 shrink-0 place-items-center rounded-xl transition-colors',
              checked ? 'bg-signal text-on-signal' : 'bg-ground-sunken text-ink-muted',
            )}
          >
            <Icon strokeWidth={1.9} className="size-5" />
          </span>
        ) : (
          <Icon
            aria-hidden="true"
            strokeWidth={2}
            className={cx(
              'size-6 shrink-0 transition-colors',
              checked ? 'text-signal-ink' : 'text-ink-faint',
            )}
          />
        )}

        <span aria-hidden="true" className={dot(checked)}>
          {checked && <span className="size-1.5 rounded-full bg-on-signal" />}
        </span>
      </span>

      <span className="mt-3 block font-extrabold text-ink">{title}</span>
      {hint && <span className="text-support mt-0.5 block text-sm leading-snug">{hint}</span>}
    </label>
  )
}

/**
 * A choice that is only its own name — the language picker.
 *
 * One line, so the radio goes back to the left where a list of short options reads fastest.
 * The flag is beside the name rather than instead of it: a flag is a country and these are
 * languages, and the two are not the same claim.
 */
export function ChoiceRow({
  name,
  checked,
  onChange,
  flag,
  label,
}: {
  name: string
  checked: boolean
  onChange: () => void
  flag: ReactNode
  label: string
}) {
  return (
    <label className={cx(surface(checked), 'flex items-center gap-3 px-4 py-3')}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />

      <span aria-hidden="true" className={dot(checked)}>
        {checked && <span className="size-1.5 rounded-full bg-on-signal" />}
      </span>

      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full border border-hairline">
        {flag}
      </span>

      <span className="min-w-0 truncate font-bold text-ink">{label}</span>
    </label>
  )
}

/* ---------------------------------------------------------------------------- flags */

/**
 * The three flags, drawn.
 *
 * Not emoji: flag emoji are regional-indicator pairs, and Windows ships no glyphs for them at
 * all — every one of these would render as the two-letter country code on the desktop half of
 * the audience. Not Lucide either, which carries no flags. So they are drawn, and `aria-hidden`
 * because the language name beside each one is the actual label.
 *
 * `slice` is what makes them fill the circle. These are 3:2 in a round 28px hole, and the
 * default `meet` letterboxes — it scales to fit the width and leaves a band of nothing above
 * and below, which inside a circle reads as a flag floating in a white disc. `slice` scales to
 * cover and crops the sides instead. The Tailwind `object-cover` that used to be here did
 * nothing at all: `object-fit` applies to replaced elements, and an inline `<svg>` is not one.
 *
 * Colour only. No crescent, no stars, no canton detail — at 28px those collapse into specks
 * that read as dirt on the glyph, and the bands alone are what identifies each of these.
 */
export function FlagUz() {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" preserveAspectRatio="xMidYMid slice" className="size-full">
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="5.33" fill="#0099b5" />
      <rect y="10.67" width="24" height="5.33" fill="#1eb53a" />
      <rect y="5.0" width="24" height="0.66" fill="#ce1126" />
      <rect y="10.34" width="24" height="0.66" fill="#ce1126" />
    </svg>
  )
}

export function FlagRu() {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" preserveAspectRatio="xMidYMid slice" className="size-full">
      <rect width="24" height="16" fill="#fff" />
      <rect y="5.33" width="24" height="5.34" fill="#0039a6" />
      <rect y="10.67" width="24" height="5.33" fill="#d52b1e" />
    </svg>
  )
}

export function FlagEn() {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" preserveAspectRatio="xMidYMid slice" className="size-full">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="3" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="3" />
    </svg>
  )
}
