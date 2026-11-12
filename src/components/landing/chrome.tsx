import { cx } from '../../lib/cx'
import { LOCALES, useLocale } from '../../lib/i18n'

/*
  The marketing pages' own chrome: the wordmark and the language switch.

  Lifted out of `Landing` when `/markazlar` arrived, because a second public page that drew its
  own copy of either would be the first place the two drifted apart.
*/

/**
 * `onSignal` is the variant for a signal-filled surface, where the mark's own accent colour is
 * the background it sits on. The two-tone reading survives by dropping `.gg` to a lighter tint
 * of the label instead — the mark stays the mark rather than flattening to one solid word.
 */
export function Wordmark({ className, onSignal = false }: { className?: string; onSignal?: boolean }) {
  return (
    <span
      className={cx('font-extrabold tracking-tight', onSignal ? 'text-on-signal' : 'text-ink', className)}
    >
      russian<span className={onSignal ? 'text-on-signal/70' : 'text-signal'}>.gg</span>
    </span>
  )
}

export function LocaleSwitch({ className, onSignal = false }: { className?: string; onSignal?: boolean }) {
  const { locale, setLocale } = useLocale()
  return (
    <div
      className={cx(
        'inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border p-0.5',
        onSignal ? 'border-on-signal/35' : 'border-hairline',
        className,
      )}
      role="group"
      aria-label="Til / Язык / Language"
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={cx(
            'rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-extrabold uppercase transition-colors',
            // On a signal fill the selected pill inverts: the label colour becomes the fill and
            // the hue moves to the text, which is what `signal-ink` exists for.
            locale === code
              ? onSignal
                ? 'bg-on-signal text-signal-ink'
                : 'bg-signal text-on-signal'
              : onSignal
                ? 'text-on-signal/80 hover:text-on-signal'
                : 'text-ink-muted hover:text-ink',
          )}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
