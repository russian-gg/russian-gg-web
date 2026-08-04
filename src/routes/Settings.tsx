import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useTheme, type Theme } from '../lib/theme'
import { LOCALES, LOCALE_NAMES, useLocale, useT, type Dictionary } from '../lib/i18n'
import type { ConsentKind, ConsentState } from '../lib/types'
import { Button, Card, ErrorNote, RadioOption, SectionHeading, Spinner, UzHint } from '../components/ui'
import { cx } from '../lib/cx'

const consentList = (t: Dictionary): Array<{ kind: ConsentKind; title: string; body: string }> => [
  {
    kind: 'AudioRetention',
    title: t.settings.consents.audioRetention,
    body: t.settings.consents.audioRetentionBody,
  },
  {
    kind: 'AudioHumanReview',
    title: t.settings.consents.audioHumanReview,
    body: t.settings.consents.audioHumanReviewBody,
  },
  {
    kind: 'ProductReminders',
    title: t.settings.consents.productReminders,
    body: t.settings.consents.productRemindersBody,
  },
  {
    kind: 'ProductAnalytics',
    title: t.settings.consents.productAnalytics,
    body: t.settings.consents.productAnalyticsBody,
  },
]

export function Settings() {
  const t = useT()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackBusy, setFeedbackBusy] = useState(false)

  const { data: consents, isLoading } = useQuery({
    queryKey: ['consents'],
    queryFn: () => api.get<ConsentState[]>('/auth/consents'),
  })

  async function toggle(kind: ConsentKind, granted: boolean) {
    setError(null)
    try {
      await api.put<ConsentState[]>('/auth/consents', { kind, granted })
      await queryClient.invalidateQueries({ queryKey: ['consents'] })
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.settings.saveFailed)
    }
  }

  async function deleteAccount() {
    const confirmation = prompt(t.settings.deletePrompt)
    if (confirmation !== t.settings.deleteConfirmWord) return

    setBusy(true)
    try {
      await api.post('/auth/delete-account')
      await signOut()
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.settings.deleteFailed)
      setBusy(false)
    }
  }

  async function submitComment() {
    const message = feedbackMessage.trim()
    if (message.length < 8) {
      setError(t.settings.feedbackTooShort)
      return
    }

    setFeedbackBusy(true)
    setError(null)
    try {
      await api.post('/auth/feedback', {
        source: 'comment',
        message,
      })
      setFeedbackMessage('')
      setFeedbackOpen(false)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.settings.feedbackFailed)
    } finally {
      setFeedbackBusy(false)
    }
  }

  if (isLoading) return <Spinner />

  const consents_ = consentList(t)
  const granted = new Map(consents?.map((consent) => [consent.kind, consent.granted]) ?? [])

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.settings.title}</h1>
        <p className="text-support mt-1">{user?.email}</p>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section>
        <SectionHeading>{t.settings.appearance}</SectionHeading>
        <ThemeChoice />
      </section>

      <section>
        <SectionHeading>{t.settings.language}</SectionHeading>
        <LanguageChoice />
      </section>

      <section>
        <SectionHeading>{t.settings.privacy}</SectionHeading>
        <div className="space-y-3">
          {consents_.map((consent) => {
            const isGranted = granted.get(consent.kind) ?? false

            return (
              <Card key={consent.kind} as="article">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-extrabold text-ink">{consent.title}</h3>
                    <UzHint>{consent.body}</UzHint>
                  </div>

                  <button
                    type="button"
                    aria-pressed={isGranted}
                    onClick={() => void toggle(consent.kind, !isGranted)}
                    className="flex shrink-0 items-center gap-3"
                  >
                    <span
                      className={cx(
                        'relative inline-flex h-7 w-12 rounded-full border transition-colors',
                        isGranted ? 'border-signal bg-signal' : 'border-hairline bg-ground-sunken',
                      )}
                    >
                      <span
                        className={cx(
                          'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform',
                          isGranted ? 'translate-x-6' : 'translate-x-0.5',
                        )}
                      />
                    </span>
                    <span className="text-sm font-medium text-ink-muted">
                      {isGranted ? t.settings.on : t.settings.off}
                    </span>
                  </button>
                </div>
              </Card>
            )
          })}
        </div>

        <p className="text-support mt-3">
          {t.settings.privacyNote}
        </p>
      </section>

      <section>
        <SectionHeading>{t.settings.subscription}</SectionHeading>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => navigate('/paywall')}>
            {t.settings.manage}
          </Button>
          <Button variant="secondary" onClick={() => setFeedbackOpen(true)}>
            {t.settings.sendFeedback}
          </Button>
        </div>
      </section>

      <section>
        <SectionHeading>{t.settings.account}</SectionHeading>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => void signOut().then(() => navigate('/'))}>
            {t.account.signOut}
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void deleteAccount()}>
            {t.settings.deleteAccount}
          </Button>
        </div>
        <p className="text-support mt-3">
          {t.settings.deleteNote}
        </p>
      </section>

      {feedbackOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4"
          onClick={() => setFeedbackOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold text-ink">{t.settings.feedbackTitle}</h2>
            <p className="text-support mt-1">
              {t.settings.feedbackBody}
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{t.settings.feedbackLabel}</span>
              <textarea
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                rows={6}
                className="w-full rounded-xl border-2 border-hairline bg-ground-raised px-4 py-3 text-base text-ink placeholder:text-ink-faint"
                placeholder={t.settings.feedbackPlaceholder}
              />
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => setFeedbackOpen(false)} disabled={feedbackBusy}>
                {t.common.cancel}
              </Button>
              <Button type="button" onClick={() => void submitComment()} disabled={feedbackBusy}>
                {feedbackBusy ? t.common.sending : t.common.send}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ThemeChoice() {
  const t = useT()
  const { theme, setTheme } = useTheme()

  const options: Array<{ value: Theme; label: string; hint: string }> = [
    { value: 'light', label: t.settings.themeLight, hint: t.settings.themeLightHint },
    { value: 'dark', label: t.settings.themeDark, hint: t.settings.themeDarkHint },
  ]

  /*
   * A real radio carries the selection. The previous cards signalled it only with a tinted
   * border, while the dark option always drew a solid black swatch — the boldest mark on the
   * row belonged to the option that was not chosen, which read as "dark is on".
   */
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.settings.appearance}>
      {options.map((option) => (
        <RadioOption
          key={option.value}
          name="theme"
          checked={theme === option.value}
          onChange={() => setTheme(option.value)}
          label={
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cx(
                  'size-4 shrink-0 rounded-full border-2 border-hairline',
                  option.value === 'light' ? 'bg-white' : 'bg-[#101216]',
                )}
              />
              <span>
                <span className="block font-semibold text-ink">{option.label}</span>
                <span className="text-support block">{option.hint}</span>
              </span>
            </span>
          }
        />
      ))}
    </div>
  )
}

/** The same choice as the profile menu, spelled out where someone comes looking for it. */
function LanguageChoice() {
  const t = useT()
  const { locale, setLocale } = useLocale()

  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t.settings.language}>
      {LOCALES.map((option) => (
        <RadioOption
          key={option}
          name="locale"
          checked={locale === option}
          onChange={() => setLocale(option)}
          label={LOCALE_NAMES[option]}
        />
      ))}
    </div>
  )
}
