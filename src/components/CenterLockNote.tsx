import { Building2 } from 'lucide-react'
import { centerLockText, type CenterLock } from '../lib/center'
import { cx } from '../lib/cx'
import { useT } from '../lib/i18n'

/**
 * What a center's student reads where anyone else would be offered Pro: whose move it is.
 *
 * Neutral, not an alarm and not a button. Nothing the learner can press opens it — the
 * center pays, or its admin switches the seat back on — so the note only says which of the
 * two they are waiting for.
 */
export function CenterLockNote({ lock, className }: { lock: CenterLock; className?: string }) {
  const t = useT()
  return (
    <p
      role="status"
      className={cx(
        'flex items-start gap-2 rounded-2xl px-4 py-3 text-sm leading-snug font-semibold',
        lock === 'paused' ? 'bg-caution-soft text-caution' : 'bg-ground-sunken text-ink-muted',
        className,
      )}
    >
      <Building2 aria-hidden="true" strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">{centerLockText(lock, t)}</span>
    </p>
  )
}
