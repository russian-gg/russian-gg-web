import { useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../lib/focus-trap'
import { Button, Card } from './ui'
import { Overlay } from './motion'

/**
 * What a card promises before the learner commits to it.
 *
 * Both lists in the product — the ninety days and the practice missions — answer the same
 * question when a card is tapped: what is this, and what is about to happen? The days used to
 * answer it in a drawer that arrived from the screen edge, and the missions did not answer it
 * at all: the card was a link straight into the thing. One dialog now does both, so the two
 * lists behave the same way and the explanation sits where the learner is looking rather than
 * off at the edge of the display.
 *
 * A dialog rather than a sheet: this is a short, self-contained answer with one obvious next
 * step, which is what a modal is for. A drawer implies a surface you browse and leave open
 * beside the page, and neither of these is that.
 *
 * The panel keeps the wiring `Overlay` deliberately does not own: the focus trap, Escape, the
 * scroll lock and the aria relationships. `portal` is on because the mission version opens
 * from inside a card in a grid, and a `fixed` panel rendered there is still bound by any
 * transform or overflow on its ancestors.
 */
export function PreviewDialog({
  open,
  eyebrow,
  title,
  closeLabel,
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  onDismiss,
  children,
}: {
  open: boolean
  eyebrow?: string
  title: string
  closeLabel: string
  primaryLabel: string
  primaryDisabled?: boolean
  onPrimary: () => void
  onDismiss: () => void
  children: ReactNode
}) {
  const panelRef = useFocusTrap<HTMLDivElement>()
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onDismiss])

  return (
    <Overlay open={open} onDismiss={onDismiss} align="bottom" portal>
      <Card
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[86dvh] w-full max-w-lg overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-black tracking-[.12em] text-signal-ink uppercase">{eyebrow}</p>
            )}
            <h2 id={titleId} className="mt-1 text-2xl font-black leading-snug text-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={closeLabel}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-ground-sunken hover:text-ink"
          >
            <X aria-hidden="true" strokeWidth={1.9} className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">{children}</div>

        <div className="mt-6 border-t border-hairline pt-5">
          <Button block size="lg" disabled={primaryDisabled} data-ui-sound="whoosh" onClick={onPrimary}>
            {primaryLabel}
          </Button>
          <Button block variant="ghost" size="lg" className="mt-2" onClick={onDismiss}>
            {closeLabel}
          </Button>
        </div>
      </Card>
    </Overlay>
  )
}

/**
 * One labelled fact inside a preview — minutes, pass mark, how many phrases. Short enough that
 * a learner takes the whole row in at a glance rather than reading it.
 */
export function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ground-sunken px-4 py-3">
      <p className="text-[11px] font-black tracking-[.1em] text-ink-faint uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-ink">{value}</p>
    </div>
  )
}
