import { useEffect } from 'react'
import { Mic } from 'lucide-react'
import { useFocusTrap } from '../lib/focus-trap'
import { useT } from '../lib/i18n'
import { Button } from './ui'

/*
 * What every voice screen says when the microphone or the connection fails. The step player
 * and the live conversation both use these, so a learner meets the same words and the same
 * way out wherever speaking breaks.
 */

export function DailyLimitDialog({
  isPro,
  onDismiss,
  onBuy,
}: {
  isPro: boolean
  onDismiss: () => void
  onBuy: () => void
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const t = useT()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4" onClick={onDismiss}>
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-card)] bg-ground p-5 shadow-soft sm:p-6"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-limit-title"
      >
        <h2 id="daily-limit-title" className="text-lg font-extrabold text-ink">
          {t.player.dailyLimitTitle}
        </h2>
        <p className="text-support mt-2">
          {isPro ? t.player.dailyLimitBodyPro : t.player.dailyLimitBody}
        </p>
        {!isPro && (
          <Button className="mt-5" block onClick={onBuy}>
            {t.player.buyAccess}
          </Button>
        )}
        <Button variant={isPro ? 'primary' : 'ghost'} block className="mt-2" onClick={onDismiss}>
          {isPro ? t.player.dailyLimitDismissPro : t.common.later}
        </Button>
      </div>
    </div>
  )
}

export function MicrophonePermissionDialog({
  busy,
  onRetry,
  onDismiss,
}: {
  busy: boolean
  onRetry: () => void
  onDismiss: () => void
}) {
  const micRef = useFocusTrap<HTMLDivElement>()
  const t = useT()
  const platform = microphonePermissionPlatform()
  const instructions =
    platform === 'android'
      ? t.player.micPermissionAndroid
      : platform === 'ios'
        ? t.player.micPermissionIos
        : t.player.micPermissionBrowser

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-card)] bg-ground p-5 shadow-soft sm:p-6"
        ref={micRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="microphone-permission-title"
        aria-describedby="microphone-permission-description"
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
          <MicGlyph />
        </div>
        <h2
          id="microphone-permission-title"
          className="mt-4 text-center text-lg font-extrabold text-ink"
        >
          {t.player.micPermissionTitle}
        </h2>
        <p id="microphone-permission-description" className="text-support mt-2 text-center">
          {t.player.micPermissionBody}
        </p>
        <div className="mt-4 rounded-xl bg-ground-sunken px-4 py-3 text-sm leading-relaxed text-ink">
          {instructions}
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-ink-faint">
          {t.player.micPermissionRemembered}
        </p>
        <Button block className="mt-5" disabled={busy} onClick={onRetry}>
          {busy ? t.player.micPermissionChecking : t.player.micPermissionGrant}
        </Button>
        <Button variant="ghost" block className="mt-2" disabled={busy} onClick={onDismiss}>
          {t.player.micPermissionUnderstood}
        </Button>
      </div>
    </div>
  )
}

function microphonePermissionPlatform(): 'android' | 'ios' | 'browser' {
  if (typeof navigator === 'undefined') return 'browser'
  if (/Android/i.test(navigator.userAgent)) return 'android'
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios'
  return 'browser'
}

function MicGlyph() {
  return <Mic aria-hidden="true" strokeWidth={1.7} className="size-8 text-on-signal" />
}
