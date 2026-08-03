import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, track } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { onboardingDraft } from '../lib/onboardingDraft'
import { useSpeechRecognition } from '../lib/speech'
import { fill, useT, type Dictionary } from '../lib/i18n'
import type {
  DiagnosticAnswer,
  DiagnosticItemView,
  DiagnosticPreview,
  DiagnosticResult,
  DiagnosticSession,
  LearningGoal,
  ProficiencyLevel,
} from '../lib/types'
import { VoiceSignal } from '../components/VoiceSignal'
import { Button, Card, ErrorNote, ProgressBar, RadioOption, Spinner, UzHint } from '../components/ui'

type Stage = 'goal' | 'self' | 'items' | 'gate' | 'result'

const goalOptions = (t: Dictionary): Array<{ value: LearningGoal; title: string; body: string }> => [
  { value: 'Work', title: t.onboarding.goalWork, body: t.onboarding.goalWorkBody },
  { value: 'DailyLife', title: t.onboarding.goalDaily, body: t.onboarding.goalDailyBody },
  { value: 'Both', title: t.onboarding.goalBoth, body: t.onboarding.goalBothBody },
]

const selfScale = (t: Dictionary) => [
  { value: 1, label: t.onboarding.scale1 },
  { value: 2, label: t.onboarding.scale2 },
  { value: 3, label: t.onboarding.scale3 },
  { value: 4, label: t.onboarding.scale4 },
  { value: 5, label: t.onboarding.scale5 },
]

/** The short claim above the result. The CEFR code is a caption, never the headline. */
const resultHeadline = (t: Dictionary): Record<ProficiencyLevel, string> => ({
  A0: t.onboarding.headlineA0,
  A1: t.onboarding.headlineA1,
  A2: t.onboarding.headlineA2,
  B1: t.onboarding.headlineB1,
  B2: t.onboarding.headlineB2,
})

export function Onboarding() {
  const t = useT()
  const navigate = useNavigate()
  const { user, completePendingOnboarding } = useAuth()

  const [stage, setStage] = useState<Stage>('goal')
  const [items, setItems] = useState<DiagnosticItemView[] | null>(null)
  const [goal, setGoal] = useState<LearningGoal>('Both')
  const [comprehension, setComprehension] = useState(3)
  const [speaking, setSpeaking] = useState(2)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([])
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const resumedRef = useRef(false)

  /**
   * Places a completed run. The attempt is only opened here for a draft taken while signed
   * out — a signed-in learner already opened one before the first question.
   */
  const place = useCallback(
    async (
      submitted: DiagnosticAnswer[],
      context: { goal: LearningGoal; comprehension: number; speaking: number },
      existingAttemptId: string | null,
    ) => {
      let id = existingAttemptId

      if (!id) {
        const started = await api.post<DiagnosticSession>('/onboarding/diagnostic', {
          goal: context.goal,
          selfRatedComprehension: context.comprehension,
          selfRatedSpeaking: context.speaking,
        })
        id = started.attemptId
      }

      const placement = await api.post<DiagnosticResult>('/onboarding/diagnostic/submit', {
        attemptId: id,
        answers: submitted,
      })

      onboardingDraft.clear()
      await completePendingOnboarding()
      setResult(placement)
      setStage('result')
    },
    [completePendingOnboarding],
  )

  // The item list is fetched anonymously so the question count — and therefore the honest
  // time estimate — is known before the learner commits to anything.
  useEffect(() => {
    let cancelled = false

    void api
      .get<DiagnosticPreview>('/onboarding/diagnostic/items')
      .then((preview) => {
        if (!cancelled) setItems(preview.items)
      })
      .catch(() => {
        if (!cancelled) setError(t.onboarding.loadFailed)
      })

    return () => {
      cancelled = true
    }
  }, [t])

  // Coming back from sign-up with answers already given: place them and go straight to the
  // result. The learner must never be asked the same ten questions twice.
  useEffect(() => {
    if (!user || resumedRef.current) return

    const draft = onboardingDraft.read()
    if (!draft) return

    resumedRef.current = true
    setBusy(true)
    setStage('gate')

    void place(
      draft.answers,
      {
        goal: draft.goal,
        comprehension: draft.selfRatedComprehension,
        speaking: draft.selfRatedSpeaking,
      },
      null,
    )
      .catch(() => {
        onboardingDraft.clear()
        setError(t.onboarding.resumeFailed)
        setStage('goal')
      })
      .finally(() => setBusy(false))
  }, [place, t, user])

  async function beginItems() {
    setError(null)

    // A signed-in learner opens the attempt now, so "started" and "completed" stay honest in
    // the funnel. Signed out, there is nobody to attribute it to yet.
    if (user) {
      setBusy(true)
      try {
        const started = await api.post<DiagnosticSession>('/onboarding/diagnostic', {
          goal,
          selfRatedComprehension: comprehension,
          selfRatedSpeaking: speaking,
        })
        setAttemptId(started.attemptId)
      } catch {
        setError(t.onboarding.startFailed)
        return
      } finally {
        setBusy(false)
      }
    }

    setStage('items')
  }

  async function recordAnswer(answer: DiagnosticAnswer) {
    const next = [...answers, answer]
    setAnswers(next)

    if (!items || index + 1 < items.length) {
      setIndex(index + 1)
      return
    }

    if (!user) {
      onboardingDraft.save({
        goal,
        selfRatedComprehension: comprehension,
        selfRatedSpeaking: speaking,
        answers: next,
      })
      setStage('gate')
      return
    }

    setBusy(true)
    try {
      await place(next, { goal, comprehension, speaking }, attemptId)
    } catch {
      setError(t.onboarding.submitFailed)
    } finally {
      setBusy(false)
    }
  }

  const total = items ? items.length + 2 : 2
  const position =
    stage === 'goal' ? 0 : stage === 'self' ? 1 : stage === 'items' ? 2 + index : total

  if (stage === 'goal') {
    return (
      <Layout caption={t.onboarding.goalCaption} progress={{ value: position, max: total }} title={t.onboarding.goalTitle}>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="space-y-3">
          {goalOptions(t).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setGoal(option.value)}
              aria-pressed={goal === option.value}
              className={`w-full rounded-[var(--radius-card)] border p-5 text-left transition ${
                goal === option.value
                  ? 'border-signal bg-signal-soft'
                  : 'border-hairline bg-ground-raised'
              }`}
            >
              <span className="block text-base font-semibold text-ink">{option.title}</span>
              <span className="text-support">{option.body}</span>
            </button>
          ))}
        </div>
        <Button size="lg" block className="mt-7" onClick={() => setStage('self')}>
          {t.common.continue}
        </Button>
      </Layout>
    )
  }

  if (stage === 'self') {
    return (
      <Layout caption={t.onboarding.selfCaption} progress={{ value: position, max: total }} title={t.onboarding.selfTitle}>
        {error && <ErrorNote>{error}</ErrorNote>}

        <Scale
          legend={t.onboarding.selfComprehension}
          value={comprehension}
          onChange={setComprehension}
        />

        <div className="mt-8">
          <Scale
            legend={t.onboarding.selfSpeaking}
            value={speaking}
            onChange={setSpeaking}
          />
        </div>

        <Button
          size="lg"
          block
          className="mt-8"
          disabled={busy || !items || items.length === 0}
          onClick={() => void beginItems()}
        >
          {busy ? t.onboarding.preparing : t.onboarding.start}
        </Button>
        {/* The honest cost, not a padded one: eight taps and two optional spoken answers. */}
        <UzHint>
          {items ? fill(t.onboarding.testHint, { count: items.length }) : t.onboarding.testLoading}
        </UzHint>
      </Layout>
    )
  }

  if (stage === 'items') {
    if (!items) return <Spinner />
    if (busy) return <Spinner label="Natija hisoblanmoqda" />

    const item = items[index]
    if (!item) return <Spinner />

    return (
      <Layout
        caption={fill(t.onboarding.questionCaption, { index: index + 1, total: items.length })}
        progress={{ value: position, max: total }}
        title={item.kind === 'Speaking' ? t.onboarding.voiceAnswerTitle : t.onboarding.chooseMeaning}
      >
        {error && <ErrorNote>{error}</ErrorNote>}

        <Card>
          <p className="text-xl font-medium leading-relaxed text-ink">{item.promptRu}</p>
          {item.promptUz && <UzHint>{item.promptUz}</UzHint>}
          {item.isOptional && (
            <UzHint>{t.onboarding.optionalQuestion}</UzHint>
          )}

          {item.audioUrl && (
            <audio controls src={item.audioUrl} className="mt-4 w-full">
              <track kind="captions" />
            </audio>
          )}
        </Card>

        {item.kind === 'Speaking' ? (
          <SpokenItem
            key={item.code}
            onSubmit={(transcript) =>
              void recordAnswer({ itemCode: item.code, spokenTranscript: transcript, skipped: false })
            }
            onSkip={() => void recordAnswer({ itemCode: item.code, skipped: true })}
          />
        ) : (
          <div className="mt-4 space-y-3">
            {shuffleOptions(item.options, item.code).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  void recordAnswer({ itemCode: item.code, selectedOption: option, skipped: false })
                }
                className="w-full rounded-xl border border-hairline bg-ground-raised px-4 py-4 text-left text-base text-ink transition hover:border-signal"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </Layout>
    )
  }

  if (stage === 'gate') {
    return (
      <Layout caption={t.onboarding.gateCaption} progress={{ value: total, max: total }} title={t.onboarding.gateTitle}>
        {error && <ErrorNote>{error}</ErrorNote>}

        {busy ? (
          <Spinner label={t.onboarding.gateCalculating} />
        ) : (
          <>
            <Card>
              <p className="text-base leading-relaxed text-ink">
                {t.onboarding.gateBody}
              </p>
              <UzHint>{t.onboarding.gateHint}</UzHint>
            </Card>

            <Button size="lg" block className="mt-7" onClick={() => navigate('/signup')}>
              {t.onboarding.gateCta}
            </Button>
            <p className="text-support mt-4 text-center">
              {t.auth.haveAccount}{' '}
              <Link to="/signin" className="font-semibold text-signal-ink">
                {t.auth.goSignIn}
              </Link>
            </p>
          </>
        )}
      </Layout>
    )
  }

  if (!result) return <Spinner />

  return (
    <Layout caption={t.onboarding.resultCaption} progress={{ value: total, max: total }} title={resultHeadline(t)[result.speaking]}>
      <Card>
        <p className="text-base leading-relaxed text-ink">{result.summaryUz}</p>

        {/* The codes stay, but as a caption under the claim — "A2" is not an answer. */}
        <p className="text-support mt-4 border-t border-hairline pt-4">
          {t.onboarding.comprehension} {result.comprehension} · {t.labels.level[result.comprehension]}
          {' — '}
          {t.onboarding.speaking} {result.speaking} · {t.labels.level[result.speaking]}
        </p>
      </Card>

      {result.selfPerceptionNoteUz && (
        <p className="mt-3 rounded-[var(--radius-card)] bg-signal-soft px-4 py-3 text-base text-signal-ink">
          {result.selfPerceptionNoteUz}
        </p>
      )}

      <Card className="mt-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">
          {t.onboarding.firstMission}
        </p>
        <p className="mt-1 text-lg font-semibold text-ink">
          {result.firstMissionTitleUz || t.onboarding.firstMissionFallback}
        </p>
        <p className="text-support">
          {fill(t.common.day, { day: result.recommendedStartDay })} · {t.labels.phase[result.startPhase]} · {t.onboarding.voiceTag}
        </p>
      </Card>

      <p className="text-support mt-4">
        {t.onboarding.estimateNote}
      </p>

      <Button
        size="lg"
        block
        className="mt-6"
        onClick={() => {
          track('mission_opened', { source: 'onboarding' })
          navigate(result.firstMissionId ? `/missions/${result.firstMissionId}` : '/home')
        }}
      >
        Boshlash
      </Button>
      <Button variant="ghost" block className="mt-2" onClick={() => navigate('/home')}>
        {t.common.later}
      </Button>
    </Layout>
  )
}

/**
 * Options are shuffled per item code, deterministically: the same learner sees a stable
 * order across a re-render, but the correct answer is not always in the same position.
 */
function shuffleOptions(options: string[], seed: string) {
  if (options.length < 2) return options

  const shuffled = [...options]
  let state = hashSeed(seed)

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    state = nextSeed(state)
    const j = state % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function nextSeed(seed: number) {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0
}

function Scale({
  legend,
  value,
  onChange,
}: {
  legend: string
  value: number
  onChange: (value: number) => void
}) {
  const t = useT()

  return (
    <fieldset>
      <legend className="mb-3 text-base font-medium text-ink">{legend}</legend>
      <div className="space-y-2">
        {selfScale(t).map((option) => (
          <RadioOption
            key={option.value}
            name={legend}
            label={option.label}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
        ))}
      </div>
    </fieldset>
  )
}

/**
 * The spoken item. Speaking is the product's whole promise, so the microphone is the default
 * path and typing is the fallback — not the other way round. Where the browser has no
 * recogniser, the text field is all that is offered, without pretending otherwise.
 */
function SpokenItem({
  onSubmit,
  onSkip,
}: {
  onSubmit: (transcript: string) => void
  onSkip: () => void
}) {
  const t = useT()
  const speech = useSpeechRecognition('ru-RU')
  const [typed, setTyped] = useState('')
  const [typing, setTyping] = useState(false)

  const useKeyboard = !speech.supported || typing || speech.status === 'denied' || speech.status === 'failed'
  const answer = useKeyboard ? typed : speech.transcript

  if (useKeyboard) {
    return (
      <div className="mt-4">
        {speech.status === 'denied' && (
          <p className="text-support mb-2">
            {t.onboarding.micDenied}
          </p>
        )}
        {speech.status === 'failed' && (
          <p className="text-support mb-2">
            {t.onboarding.micFailed}
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t.onboarding.writeAnswer}</span>
          <textarea
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-hairline bg-ground-raised px-3.5 py-3 text-base text-ink"
            placeholder={t.onboarding.writePlaceholder}
          />
        </label>

        <Button size="lg" block className="mt-4" disabled={!answer.trim()} onClick={() => onSubmit(answer)}>
          {t.onboarding.submitAnswer}
        </Button>
        {speech.supported && (
          <Button
            variant="secondary"
            block
            className="mt-2"
            onClick={() => {
              setTyping(false)
              speech.reset()
            }}
          >
            {t.onboarding.useVoice}
          </Button>
        )}
        <Button variant="ghost" block className="mt-2" onClick={onSkip}>
          {t.onboarding.skip}
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <Card className="flex flex-col items-center gap-4 py-7">
        <VoiceSignal state={speech.status === 'listening' ? 'listening' : answer ? 'feedback' : 'idle'} />
        {answer ? (
          <p className="text-center text-lg leading-relaxed text-ink">{answer}</p>
        ) : (
          <p className="text-support text-center">
            {t.onboarding.speakHint}
          </p>
        )}
      </Card>

      {speech.status === 'listening' ? (
        <Button size="lg" block className="mt-4" variant="secondary" onClick={speech.stop}>
          {t.onboarding.speakStop}
        </Button>
      ) : answer ? (
        <>
          <Button size="lg" block className="mt-4" onClick={() => onSubmit(answer)}>
            {t.onboarding.submitAnswer}
          </Button>
          <Button variant="secondary" block className="mt-2" onClick={speech.start}>
          {t.onboarding.speakAgain}
          </Button>
        </>
      ) : (
        <Button size="lg" block className="mt-4" onClick={speech.start}>
          {t.onboarding.speakStart}
        </Button>
      )}

      <Button variant="ghost" block className="mt-2" onClick={() => setTyping(true)}>
        {t.onboarding.typeInstead}
      </Button>
      <Button variant="ghost" block className="mt-1" onClick={onSkip}>
        {t.onboarding.skip}
      </Button>
    </div>
  )
}

/**
 * One continuous scale across the whole flow. The bar previously restarted at zero when the
 * questions began, so a learner who was halfway through watched their progress vanish.
 */
function Layout({
  caption,
  title,
  children,
  progress,
}: {
  caption: string
  title: string
  children: React.ReactNode
  progress: { value: number; max: number }
}) {
  const t = useT()

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {caption}
        </p>
        <ProgressBar value={progress.value} max={progress.max} label={t.onboarding.progressLabel} />
      </div>

      <h1 className="mb-6 text-2xl font-semibold leading-snug tracking-tight text-ink">{title}</h1>
      {children}
    </div>
  )
}
