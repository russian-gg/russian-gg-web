import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, RequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useTheme, type Theme } from '../lib/theme'
import { LOCALES, LOCALE_NAMES, useLocale, useT, type Dictionary } from '../lib/i18n'
import { formatDate } from '../lib/format'
import type {
  ConsentKind,
  ConsentState,
  EntitlementView,
  ProgressView,
  SubscriptionStatus,
  VoiceGender,
  VoiceMood,
} from '../lib/types'
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  RadioOption,
  Rule,
  SectionHeading,
  Spinner,
  Switch,
  TabLinks,
  UzHint,
} from '../components/ui'

/**
 * Everything about the account, in one place, behind three tabs.
 *
 * Profile, billing and settings used to be three destinations in the account menu covering
 * one subject, so "where do I change my plan?" had three plausible answers and two wrong
 * ones. Each tab keeps its own URL — a tab that cannot be reloaded, linked or reached with
 * the back button is a tab in name only.
 */
const TAB_PROFILE = '/settings'
const TAB_GENERAL = '/settings/general'
const TAB_BILLING = '/settings/billing'

export function Settings() {
  const t = useT()
  const { user } = useAuth()
  const { pathname } = useLocation()

  const tabs = [
    { to: TAB_PROFILE, label: t.settings.tabProfile },
    { to: TAB_GENERAL, label: t.settings.tabGeneral },
    { to: TAB_BILLING, label: t.settings.tabBilling },
  ]

  const active = tabs.some((tab) => tab.to === pathname) ? pathname : TAB_PROFILE

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.settings.title}</h1>
        <p className="text-support mt-1">{user?.email}</p>
      </header>

      <TabLinks tabs={tabs} active={active} />

      {active === TAB_PROFILE && <ProfileTab />}
      {active === TAB_GENERAL && <GeneralTab />}
      {active === TAB_BILLING && <BillingTab />}
    </div>
  )
}

/* -------------------------------------------------------------------------- profile */

function ProfileTab() {
  const t = useT()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { data: progress, isLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

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

  if (isLoading) return <Spinner />

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || t.account.learner
  const initials = name.trim().slice(0, 2).toUpperCase()

  return (
    <div className="space-y-10">
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex items-center gap-4">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-signal text-xl font-extrabold text-on-signal"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold text-ink">{name}</p>
          <p className="text-support truncate">{user?.email}</p>
        </div>
      </div>

      <section>
        <SectionHeading>{t.profile.level}</SectionHeading>
        <Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <LevelStat label={t.progress.comprehension} level={progress?.comprehensionLevel} t={t} />
            <LevelStat label={t.progress.speaking} level={progress?.speakingLevel} t={t} />
          </div>
          <UzHint>{t.profile.levelNote}</UzHint>
        </Card>
      </section>

      <section>
        <SectionHeading>{t.profile.coursePosition}</SectionHeading>
        <Card>
          <dl className="grid gap-5 sm:grid-cols-3">
            <Stat
              label={t.profile.currentDay}
              value={progress ? `${progress.currentDay}/90` : null}
              hint={progress ? t.labels.phase[progress.phase] : undefined}
            />
            <Stat label={t.profile.missionsDone} value={progress?.totalMissionsCompleted ?? null} />
            <Stat
              label={t.profile.streakDays}
              value={progress?.streakDays ?? null}
              hint={progress && progress.streakDays > 0 ? t.profile.keepGoing : undefined}
            />
          </dl>
        </Card>
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
        <p className="text-support mt-3">{t.settings.deleteNote}</p>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- general */

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

function GeneralTab() {
  const t = useT()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

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

  if (isLoading) return <Spinner />

  const consents_ = consentList(t)
  const granted = new Map(consents?.map((consent) => [consent.kind, consent.granted]) ?? [])

  return (
    <div className="space-y-10">
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
        <SectionHeading>{t.settings.voice}</SectionHeading>
        <VoiceChoice onError={setError} />
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

                  {/*
                    No word beside it. The switch says on or off with the knob's position,
                    which is not a colour-only signal, and the word was a different width in
                    each state — so a column of switches sat at a different x depending on
                    what each one happened to be set to.

                    The title names the button instead; "O'chiq" never told anyone what it
                    was the off state *of*.
                  */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isGranted}
                    aria-label={consent.title}
                    onClick={() => void toggle(consent.kind, !isGranted)}
                    className="shrink-0"
                  >
                    <Switch checked={isGranted} />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>

        <p className="text-support mt-3">{t.settings.privacyNote}</p>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- billing */

function BillingTab() {
  const t = useT()
  const { locale } = useLocale()
  const navigate = useNavigate()

  const { data: entitlement, isLoading } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    staleTime: 60_000,
    retry: false,
  })

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading>{t.profile.subscription}</SectionHeading>
        <Card>
          {entitlement ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-extrabold text-ink">{entitlement.tier}</span>
                <Badge tone={entitlement.hasProAccess ? 'signal' : 'neutral'}>
                  {statusLabel(entitlement.status, t)}
                </Badge>
                {entitlement.paymentProcessing && (
                  <Badge tone="caution">{t.profile.paymentChecking}</Badge>
                )}
              </div>

              <Rule className="my-4" />

              <dl className="grid gap-5 sm:grid-cols-2">
                <Stat label={t.profile.unlockedDays} value={`${entitlement.maxUnlockedDay}/90`} />
                <Stat
                  label={entitlement.cancelAtPeriodEnd ? t.profile.validUntil : t.profile.nextPayment}
                  value={
                    entitlement.currentPeriodEnd
                      ? formatDate(entitlement.currentPeriodEnd, locale)
                      : entitlement.trialEndsAt
                        ? formatDate(entitlement.trialEndsAt, locale)
                        : null
                  }
                />
              </dl>
            </>
          ) : (
            <p className="text-support">{t.profile.subscriptionUnavailable}</p>
          )}

          <Button className="mt-5" onClick={() => navigate('/paywall')}>
            {t.profile.manage}
          </Button>
        </Card>
      </section>
    </div>
  )
}

function statusLabel(status: SubscriptionStatus, t: Dictionary): string {
  const map: Record<SubscriptionStatus, string> = {
    None: t.profile.status.none,
    Trialing: t.profile.status.trialing,
    Active: t.profile.status.active,
    PastDue: t.profile.status.pastDue,
    Cancelled: t.profile.status.cancelled,
    Expired: t.profile.status.expired,
  }

  return map[status]
}

/* --------------------------------------------------------------------------- pieces */

function ThemeChoice() {
  const t = useT()
  const { theme, setTheme } = useTheme()

  const options: Array<{ value: Theme; label: string; hint: string }> = [
    { value: 'light', label: t.settings.themeLight, hint: t.settings.themeLightHint },
    { value: 'dark', label: t.settings.themeDark, hint: t.settings.themeDarkHint },
  ]

  /*
   * The radio carries the selection, and nothing else on the row is allowed to look like it.
   * Each option used to also draw a colour swatch — a circle the same size as the radio,
   * sitting right beside it — so every option appeared to have two radio buttons, and the
   * dark one's swatch was a solid black dot that read as the selected state.
   *
   * The swatch is gone rather than restyled: the words already say which theme this is.
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
            <span className="block">
              <span className="block font-bold text-ink">{option.label}</span>
              <span className="text-support block">{option.hint}</span>
            </span>
          }
        />
      ))}
    </div>
  )
}


/**
 * Who the tutor is. Two independent choices: the voice it speaks with, and the manner it
 * carries itself in.
 *
 * The manner is the only thing that moves. The lesson, the corrections and the rule that a
 * learner is never told their Russian is bad are fixed on the server and are not reachable
 * from this screen — which is why "blunt" can exist at all: it is a harder scene to rehearse,
 * not a worse teacher. The note under the options says so, because a learner choosing it
 * deserves to know what they are and are not agreeing to.
 */
function VoiceChoice({ onError }: { onError: (message: string | null) => void }) {
  const t = useT()
  const { user, refreshUser } = useAuth()
  const [busy, setBusy] = useState(false)

  const gender = user?.voiceGender ?? 'Female'
  const mood = user?.voiceMood ?? 'Gentle'

  async function save(next: { voiceGender?: VoiceGender; voiceMood?: VoiceMood }) {
    setBusy(true)
    onError(null)
    try {
      await api.patch('/auth/me', next)
      await refreshUser()
    } catch (caught) {
      onError(caught instanceof RequestError ? caught.message : t.settings.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        className="grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label={t.settings.voice}
      >
        {(['Female', 'Male'] as const).map((option) => (
          <RadioOption
            key={option}
            name="voice-gender"
            checked={gender === option}
            onChange={() => !busy && void save({ voiceGender: option })}
            label={<span className="font-bold text-ink">{t.settings.voiceGender[option]}</span>}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t.settings.voice}>
        {(['Gentle', 'Playful', 'Blunt'] as const).map((option) => (
          <RadioOption
            key={option}
            name="voice-mood"
            checked={mood === option}
            onChange={() => !busy && void save({ voiceMood: option })}
            label={
              <span className="block">
                <span className="block font-bold text-ink">{t.settings.voiceMood[option]}</span>
                <span className="text-support block">{t.settings.voiceMoodHint[option]}</span>
              </span>
            }
          />
        ))}
      </div>

      <p className="text-support">{t.settings.voiceNote}</p>
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

function LevelStat({
  label,
  level,
  t,
}: {
  label: string
  level?: ProgressView['speakingLevel']
  t: Dictionary
}) {
  return (
    <div>
      <p className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">{label}</p>
      {level ? (
        <>
          <p className="mt-1 text-2xl font-extrabold text-ink">{level}</p>
          <p className="text-support">{t.labels.level[level] ?? ''}</p>
        </>
      ) : (
        <p className="mt-1 text-2xl font-extrabold text-ink-faint">{t.common.notYet}</p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number | null
  hint?: string
}) {
  return (
    <div>
      <dt className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
        {value ?? <span className="text-ink-faint">—</span>}
      </dd>
      {hint && <p className="text-support">{hint}</p>}
    </div>
  )
}
