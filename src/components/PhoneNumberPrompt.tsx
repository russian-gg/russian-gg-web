import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useT } from '../lib/i18n'
import { Button, Card, ErrorNote } from './ui'

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

  if (!open || !user || user.phoneNumber) {
    return null
  }

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={dismiss}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-prompt-title"
        className="relative w-full max-w-xl border-none px-5 py-5 text-center shadow-2xl sm:px-6 sm:py-6"
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

        <span
          aria-hidden="true"
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-signal-soft text-signal"
        >
          <PhoneGlyph />
        </span>

        <h2 id="phone-prompt-title" className="mx-auto mt-4 max-w-lg text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          {t.phonePrompt.title}
        </h2>
        <p className="text-support mx-auto mt-2.5 max-w-lg text-base leading-relaxed">
          {t.phonePrompt.body}
          <br />
          {t.phonePrompt.bodyLine2}
        </p>

        <div className="mx-auto mt-5 grid max-w-lg gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t.phonePrompt.label}</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder={t.phonePrompt.placeholder}
              className="h-12 w-full rounded-2xl border-2 border-hairline bg-ground-raised px-4 text-base text-ink placeholder:text-ink-faint focus:border-signal"
            />
          </label>
          <Button
            size="md"
            className="w-full sm:min-w-32 sm:w-auto"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? t.common.sending : t.common.send}
          </Button>
        </div>

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      </Card>
    </div>
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 fill-none stroke-current stroke-[1.9]">
      <path
        d="M7.2 19.2c6.1 0 11-4.4 11-9.9 0-5.4-4.9-9.8-11-9.8-6.1 0-11 4.4-11 9.8 0 2 .7 3.9 2 5.4L-2 23l6.4-2.5c.9.4 1.8.7 2.8.7Z"
        transform="translate(3 1)"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 fill-none stroke-current stroke-[1.9]">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  )
}
