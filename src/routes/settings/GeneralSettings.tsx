import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, RequestError } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import { useTheme, type Theme } from '../../lib/theme'
import { LOCALES, LOCALE_NAMES, useLocale, useT, type Dictionary } from '../../lib/i18n'
import type { ConsentKind, ConsentState, VoiceGender, VoiceMood } from '../../lib/types'
import {
  AudioLines,
  BarChart3,
  Bell,
  Heart,
  Mic,
  Moon,
  PlayCircle,
  ShieldCheck,
  Smile,
  Sun,
  User,
  type LucideIcon,
} from 'lucide-react'
import { ErrorNote, QueryError, Spinner, Switch } from '../../components/ui'
import { ChoiceRow, ChoiceTile, FlagEn, FlagRu, FlagUz } from './choices'
import { InfoNote, SectionCard } from './stats'

/**
 * How the app behaves: what it looks like, what language it speaks, who the tutor sounds
 * like, and what it is allowed to keep.
 *
 * Two columns from `xl`, and the split is by *kind* rather than by whatever fits. The left
 * column is preference — four choices the learner makes because they prefer them. The right
 * is permission — four things the product is asking to be allowed to do. They were
 * interleaved in one flowing grid, so a privacy toggle sat directly under a theme picker and
 * the page had no argument to it.
 */
export function GeneralSettings() {
  const t = useT()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const { data: consents, isLoading, isError, refetch } = useQuery({
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
  /* Falling through would render every consent as ungranted — a record of something the
     learner never chose, which is worse than saying the list did not load. */
  if (isError || !consents) return <QueryError onRetry={() => void refetch()} />

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2 xl:gap-8">
      {error && (
        <div className="xl:col-span-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="space-y-6">
        <AppearanceSettings />
        <LanguageSettings />
        <VoiceSettings onError={setError} />
      </div>

      <PrivacySettings consents={consents} onToggle={toggle} />
    </div>
  )
}

/* ---------------------------------------------------------------------- appearance */

function AppearanceSettings() {
  const t = useT()
  const { theme, setTheme } = useTheme()

  const options: Array<{ value: Theme; label: string; hint: string; icon: LucideIcon }> = [
    { value: 'light', label: t.settings.themeLight, hint: t.settings.themeLightHint, icon: Sun },
    { value: 'dark', label: t.settings.themeDark, hint: t.settings.themeDarkHint, icon: Moon },
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
    <SectionCard title={t.settings.appearance} subtitle={t.settings.appearanceHint}>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.settings.appearance}>
        {options.map((option) => (
          <ChoiceTile
            key={option.value}
            name="theme"
            checked={theme === option.value}
            onChange={() => setTheme(option.value)}
            icon={option.icon}
            iconStyle="bare"
            title={option.label}
            hint={option.hint}
          />
        ))}
      </div>
    </SectionCard>
  )
}

/* ------------------------------------------------------------------------ language */

/** The same choice as the profile menu, spelled out where someone comes looking for it. */
function LanguageSettings() {
  const t = useT()
  const { locale, setLocale } = useLocale()

  /*
    Each name is written in its own language and script, which is the whole label: somebody
    looking for Russian is looking for "Русский", not for a translation of the word. The flag
    is beside it as a second way in, not instead of it.
  */
  const flags = { uz: <FlagUz />, ru: <FlagRu />, en: <FlagEn /> }

  return (
    <SectionCard title={t.settings.language} subtitle={t.settings.languageHint}>
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t.settings.language}>
        {LOCALES.map((option) => (
          <ChoiceRow
            key={option}
            name="locale"
            checked={locale === option}
            onChange={() => setLocale(option)}
            flag={flags[option]}
            label={LOCALE_NAMES[option]}
          />
        ))}
      </div>
    </SectionCard>
  )
}

/* --------------------------------------------------------------------------- voice */

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
function VoiceSettings({ onError }: { onError: (message: string | null) => void }) {
  const t = useT()
  const { user, refreshUser } = useAuth()
  /*
   * The choice moves at once and is reconciled afterwards. Drawing it straight from the
   * account meant a press did nothing visible until the round trip came back — and nothing
   * at all if it failed, which is indistinguishable from a dead control.
   */
  const [pending, setPending] = useState<{ gender?: VoiceGender; mood?: VoiceMood }>({})

  const gender = pending.gender ?? user?.voiceGender ?? 'Female'
  const mood = pending.mood ?? user?.voiceMood ?? 'Gentle'

  async function save(next: { voiceGender?: VoiceGender; voiceMood?: VoiceMood }) {
    setPending({ gender: next.voiceGender ?? gender, mood: next.voiceMood ?? mood })
    onError(null)
    try {
      await api.patch('/auth/me', next)
      await refreshUser()
    } catch (caught) {
      // Put it back where it was. A control that keeps a change the server refused is lying.
      setPending({})
      onError(caught instanceof RequestError ? caught.message : t.settings.saveFailed)
      return
    }

    setPending({})
  }

  const genderIcon: Record<VoiceGender, LucideIcon> = { Female: PlayCircle, Male: User }
  const moodIcon: Record<VoiceMood, LucideIcon> = { Gentle: Heart, Playful: Smile, Blunt: AudioLines }

  return (
    <SectionCard title={t.settings.voice} subtitle={t.settings.voiceHint}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.settings.voiceGenderLabel}>
          {(['Female', 'Male'] as const).map((option) => (
            <ChoiceTile
              key={option}
              name="voice-gender"
              checked={gender === option}
              onChange={() => void save({ voiceGender: option })}
              icon={genderIcon[option]}
              title={t.settings.voiceGender[option]}
              hint={t.settings.voiceGenderHint[option]}
            />
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t.settings.voiceMoodLabel}>
          {(['Gentle', 'Playful', 'Blunt'] as const).map((option) => (
            <ChoiceTile
              key={option}
              name="voice-mood"
              checked={mood === option}
              onChange={() => void save({ voiceMood: option })}
              icon={moodIcon[option]}
              title={t.settings.voiceMood[option]}
              hint={t.settings.voiceMoodHint[option]}
            />
          ))}
        </div>

        <p className="text-support text-sm">{t.settings.voiceNote}</p>
      </div>
    </SectionCard>
  )
}

/* ------------------------------------------------------------------------- privacy */

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

/**
 * The four things the product asks permission for.
 *
 * One card with a divided list rather than four separate cards: these are a set, they are
 * answered together, and four bordered boxes in a column put three horizontal rules' worth of
 * furniture between four short sentences.
 */
const consentIcon: Record<ConsentKind, LucideIcon> = {
  AudioRetention: Mic,
  AudioHumanReview: ShieldCheck,
  ProductReminders: Bell,
  ProductAnalytics: BarChart3,
}

function PrivacySettings({
  consents,
  onToggle,
}: {
  consents: ConsentState[]
  onToggle: (kind: ConsentKind, granted: boolean) => void
}) {
  const t = useT()
  const granted = new Map(consents.map((consent) => [consent.kind, consent.granted]))

  return (
    <SectionCard title={t.settings.privacy} subtitle={t.settings.privacyHint}>
      <div className="space-y-3">
        {consentList(t).map((consent) => {
          const isGranted = granted.get(consent.kind) ?? false
          const Icon = consentIcon[consent.kind]

          return (
            <div
              key={consent.kind}
              className="flex items-start gap-3 rounded-2xl border border-hairline bg-ground-raised p-4"
            >
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal-soft text-signal-ink"
              >
                <Icon strokeWidth={1.9} className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-extrabold text-ink">{consent.title}</h3>
                <p className="text-support mt-0.5 text-sm leading-snug">{consent.body}</p>
              </div>

              {/*
                No word beside it. The switch says on or off with the knob's position, which is
                not a colour-only signal, and the word was a different width in each state — so
                a column of switches sat at a different x depending on what each one happened
                to be set to.

                The title names the button instead; "O'chiq" never told anyone what it was the
                off state *of*.
              */}
              <button
                type="button"
                role="switch"
                aria-checked={isGranted}
                aria-label={consent.title}
                onClick={() => onToggle(consent.kind, !isGranted)}
                className="mt-0.5 shrink-0"
              >
                <Switch checked={isGranted} />
              </button>
            </div>
          )
        })}
      </div>

      <InfoNote>{t.settings.privacyNote}</InfoNote>
    </SectionCard>
  )
}
