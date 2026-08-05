import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useT } from '../lib/i18n'
import { Button, Card, ErrorNote } from './ui'

export function PhoneNumberPrompt() {
  const t = useT()
  const { pathname } = useLocation()
  const { user, refreshUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [dismissedPath, setDismissedPath] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('+998')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user || user.phoneNumber) {
      setOpen(false)
      setDismissedPath(null)
      return
    }

    if (dismissedPath === pathname) {
      return
    }

    setPhoneNumber('+998')
    setError(null)
    setOpen(true)
  }, [dismissedPath, pathname, user])

  if (!open || !user || user.phoneNumber) {
    return null
  }

  async function submit() {
    const normalized = normalizePhoneNumber(phoneNumber)
    if (!normalized) {
      setError(t.phonePrompt.invalid)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await api.patch('/auth/me', { phoneNumber: normalized })
      await refreshUser()
      setOpen(false)
      setDismissedPath(null)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.settings.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  function dismiss() {
    setOpen(false)
    setError(null)
    setDismissedPath(pathname)
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
        className="relative w-full max-w-3xl border-none px-8 py-10 text-center shadow-2xl sm:px-12"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={t.common.close}
          className="absolute top-5 right-5 text-ink-faint transition hover:text-ink"
          onClick={dismiss}
        >
          <CloseGlyph />
        </button>

        <span
          aria-hidden="true"
          className="mx-auto flex size-20 items-center justify-center rounded-full bg-signal-soft text-signal"
        >
          <PhoneGlyph />
        </span>

        <h2 id="phone-prompt-title" className="mt-7 text-3xl font-extrabold tracking-tight text-ink">
          {t.phonePrompt.title}
        </h2>
        <p className="text-support mx-auto mt-4 max-w-2xl text-xl leading-relaxed">
          {t.phonePrompt.body}
          <br />
          {t.phonePrompt.bodyLine2}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-start">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t.phonePrompt.label}</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder={t.phonePrompt.placeholder}
              className="h-18 w-full rounded-[28px] border-2 border-hairline bg-ground-raised px-7 text-2xl text-ink placeholder:text-ink-faint focus:border-signal"
            />
          </label>
          <Button
            size="lg"
            className="h-18 rounded-[28px] px-8 text-2xl sm:min-w-36"
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

function normalizePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 15) {
    return null
  }

  return `+${digits}`
}

function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-9 fill-none stroke-current stroke-[1.9]">
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7 fill-none stroke-current stroke-[1.9]">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  )
}
