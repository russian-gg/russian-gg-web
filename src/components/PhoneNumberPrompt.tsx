import { useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useFocusTrap } from '../lib/focus-trap'
import { useLocation } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useT } from '../lib/i18n'
import { Button, Card, ErrorNote } from './ui'
import { Overlay } from './motion'

const DISMISS_KEY_PREFIX = 'rgg.phone-prompt.dismissed-on'

export function PhoneNumberPrompt() {
  const t = useT()
  const { pathname } = useLocation()
  const { user, refreshUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('+998')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [todayKey, setTodayKey] = useState(getLocalDayKey)

  /*
    The prompt stays mounted while it is closed so it can animate *out* — see `Overlay`. That
    makes the focus trap's own flag load-bearing rather than incidental: without it the trap
    would be arming itself around a dialog nobody can see, and Tab would be held captive by
    an invisible panel on every screen in the app.
  */
  const visible = open && !!user && !user.phoneNumber
  const dialogRef = useFocusTrap<HTMLDivElement>(visible)

  useEffect(() => {
    if (!user || user.phoneNumber) {
      setOpen(false)
      return
    }

    const dismissedOn = readDismissedDay(user.id)
    if (dismissedOn === todayKey) {
      setOpen(false)
      return
    }

    setPhoneNumber('+998')
    setError(null)
    setOpen(true)
  }, [pathname, todayKey, user])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTodayKey((current) => {
        const next = getLocalDayKey()
        return current === next ? current : next
      })
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [])

  async function submit() {
    if (!user) {
      return
    }

    const normalized = normalizePhoneNumber(phoneNumber)
    if (!normalized) {
      setError(t.phonePrompt.invalid)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.patch('/auth/me', { phoneNumber: normalized })
      clearDismissedDay(user.id)
      await refreshUser()
      setOpen(false)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.settings.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  function dismiss() {
    if (!user) {
      return
    }

    writeDismissedDay(user.id, todayKey)
    setOpen(false)
    setError(null)
  }

  return (
    <Overlay open={visible} onDismiss={dismiss}>
      <Card
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-prompt-title"
        className="relative w-full max-w-sm border-none px-4 py-4 text-center shadow-2xl sm:px-5 sm:py-5"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={t.common.close}
          className="absolute top-3.5 right-3.5 text-ink-faint transition hover:text-ink"
          onClick={dismiss}
        >
          <CloseGlyph />
        </button>

        <div className="mx-auto flex max-w-[18rem] flex-col items-center">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full bg-signal-soft text-signal"
          >
            <PhoneGlyph />
          </span>

          <h2 id="phone-prompt-title" className="mt-3 max-w-[15rem] text-base font-extrabold tracking-tight text-ink sm:text-lg">
            {t.phonePrompt.title}
          </h2>
          <p className="text-support mt-1.5 max-w-[15rem] text-[11px] leading-5 sm:text-xs sm:leading-5">
            {t.phonePrompt.body}
            <br />
            {t.phonePrompt.bodyLine2}
          </p>

          <div className="mt-3.5 grid w-full max-w-[16rem] gap-2 sm:max-w-[18rem] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <label className="min-w-0">
            <span className="sr-only">{t.phonePrompt.label}</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder={t.phonePrompt.placeholder}
              className="h-10 w-full rounded-2xl border-2 border-hairline bg-ground-raised px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-signal"
            />
            </label>
            <Button
              size="sm"
              className="w-full sm:min-w-24 sm:w-auto"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? t.common.sending : t.common.send}
            </Button>
          </div>
        </div>

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      </Card>
    </Overlay>
  )
}

function getLocalDayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dismissedDayStorageKey(userId: string) {
  return `${DISMISS_KEY_PREFIX}.${userId}`
}

function readDismissedDay(userId: string) {
  try {
    return localStorage.getItem(dismissedDayStorageKey(userId))
  } catch {
    return null
  }
}

function writeDismissedDay(userId: string, dayKey: string) {
  try {
    localStorage.setItem(dismissedDayStorageKey(userId), dayKey)
  } catch {
    // Ignore storage failures; the prompt should still behave for the current page.
  }
}

function clearDismissedDay(userId: string) {
  try {
    localStorage.removeItem(dismissedDayStorageKey(userId))
  } catch {
    // Ignore storage failures; saving the number is the real source of truth.
  }
}

function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 15) {
    return null
  }

  return `+${digits}`
}

function PhoneGlyph() {
  return (
    <MessageCircle aria-hidden="true" strokeWidth={1.9} className="size-4" />
  )
}

function CloseGlyph() {
  return (
    <X aria-hidden="true" strokeWidth={1.9} className="size-6" />
  )
}
