import { useEffect, useId, useState, type ReactNode } from 'react'
import { useFocusTrap } from '../lib/focus-trap'
import { useT } from '../lib/i18n'
import { Overlay } from './motion'
import { Button, Card } from './ui'

/**
 * The product's own confirmation, in place of `window.confirm()` and `prompt()`.
 *
 * The browser's dialogs speak the browser's language rather than the learner's, look like a
 * system warning rather than part of the app, and the Telegram in-app browser can block them
 * outright — so a cancel or a delete could silently do nothing. This one is a card in the page.
 *
 * `confirmWord`, when given, must be typed before the action unlocks: the deliberate step for
 * something that cannot be undone, such as deleting the account.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  confirmWord,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  confirmWord?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useT()
  const titleId = useId()
  const dialogRef = useFocusTrap<HTMLDivElement>(open)
  const [typed, setTyped] = useState('')
  const unlocked = !confirmWord || typed.trim().toLocaleUpperCase() === confirmWord.toLocaleUpperCase()

  useEffect(() => {
    if (!open) {
      setTyped('')
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, busy, onCancel])

  return (
    // Portalled: it is opened from inside cards and game screens whose transforms would
    // otherwise trap a fixed overlay inside them.
    <Overlay open={open} portal onDismiss={busy ? undefined : onCancel} backdropClassName="bg-black/40">
      <Card
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-extrabold text-ink">
          {title}
        </h2>
        <div className="text-support mt-2 space-y-2 text-sm leading-relaxed">{body}</div>

        {confirmWord && (
          <label className="mt-4 block">
            <span className="text-sm font-bold text-ink">{confirmWord}</span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="mt-1.5 h-11 w-full rounded-2xl border-2 border-hairline bg-ground-raised px-3.5 text-sm font-bold text-ink focus:border-signal"
            />
          </label>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={!unlocked || busy}>
            {busy ? t.common.loading : confirmLabel}
          </Button>
        </div>
      </Card>
    </Overlay>
  )
}
