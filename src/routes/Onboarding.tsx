import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, track } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { onboardingDraft } from '../lib/onboardingDraft'
import { useSpeechRecognition } from '../lib/speech'
import { phaseLabelUz, levelDescriptionUz } from '../lib/format'
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

const GOALS: Array<{ value: LearningGoal; title: string; body: string }> = [
  { value: 'Work', title: 'Ish uchun', body: 'Hamkasblar, rahbar va mijozlar bilan muloqot.' },
  { value: 'DailyLife', title: 'Kundalik hayot', body: "Do'kon, transport, uy-joy va xizmatlar." },
  { value: 'Both', title: 'Ikkalasi ham', body: 'Ish va kundalik hayot birgalikda.' },
]

const SELF_SCALE = [
  { value: 1, label: 'Deyarli hech narsa' },
  { value: 2, label: "Ayrim so'zlar" },
  { value: 3, label: 'Oddiy gaplar' },
  { value: 4, label: "Ko'p narsani" },
  { value: 5, label: 'Deyarli hammasini' },
]

/** The short claim above the result. The CEFR code is a caption, never the headline. */
const RESULT_HEADLINE_UZ: Record<ProficiencyLevel, string> = {
  A0: 'Noldan boshlaymiz',
  A1: 'Oddiy iboralar sizda bor',
  A2: 'Kundalik muloqotni uddalaysiz',
  B1: 'Mustaqil gapira olasiz',
  B2: 'Erkin gapirasiz',
}

export function Onboarding() {
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
        if (!cancelled) setError("Testni yuklab bo'lmadi. Sahifani yangilang.")
      })

    return () => {
      cancelled = true
    }
  }, [])

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
        setError("Natijani saqlashda xatolik. Testni qaytadan boshlang.")
        setStage('goal')
      })
      .finally(() => setBusy(false))
  }, [place, user])

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
        setError("Testni boshlashda xatolik. Qayta urinib ko'ring.")
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
      setError("Natijani saqlashda xatolik. Qayta urinib ko'ring.")
    } finally {
      setBusy(false)
    }
  }

  const total = items ? items.length + 2 : 2
  const position =
    stage === 'goal' ? 0 : stage === 'self' ? 1 : stage === 'items' ? 2 + index : total

  if (stage === 'goal') {
    return (
      <Layout caption="Maqsad" progress={{ value: position, max: total }} title="Rus tilini nima uchun o'rganyapsiz?">
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="space-y-3">
          {GOALS.map((option) => (
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
          Davom etish
        </Button>
      </Layout>
    )
  }

  if (stage === 'self') {
    return (
      <Layout caption="O'z bahoyingiz" progress={{ value: position, max: total }} title="O'zingizni qanday baholaysiz?">
        {error && <ErrorNote>{error}</ErrorNote>}

        <Scale
          legend="Ruscha nutqni qanchalik tushunasiz?"
          value={comprehension}
          onChange={setComprehension}
        />

        <div className="mt-8">
          <Scale
            legend="Ruscha gapirishga qanchalik ishonchingiz bor?"
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
          {busy ? 'Tayyorlanmoqda...' : 'Testni boshlash'}
        </Button>
        {/* The honest cost, not a padded one: eight taps and two optional spoken answers. */}
        <UzHint>
          {items ? `2 daqiqa · ${items.length} ta savol.` : 'Test yuklanmoqda…'} Ovozli savollar
          ixtiyoriy, istasangiz o'tkazib yuborishingiz mumkin.
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
        caption={`Savol ${index + 1} / ${items.length}`}
        progress={{ value: position, max: total }}
        title={item.kind === 'Speaking' ? 'Ovozli javob' : 'Ma’noni tanlang'}
      >
        {error && <ErrorNote>{error}</ErrorNote>}

        <Card>
          <p className="text-xl font-medium leading-relaxed text-ink">{item.promptRu}</p>
          {item.promptUz && <UzHint>{item.promptUz}</UzHint>}
          {item.isOptional && (
            <UzHint>Ixtiyoriy savol. Javob bersangiz gapirish darajasini aniqroq baholaymiz.</UzHint>
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
      <Layout caption="Natija tayyor" progress={{ value: total, max: total }} title="Javoblaringiz qabul qilindi">
        {error && <ErrorNote>{error}</ErrorNote>}

        {busy ? (
          <Spinner label="Darajangiz hisoblanmoqda" />
        ) : (
          <>
            <Card>
              <p className="text-base leading-relaxed text-ink">
                Darajangiz va 90 kunlik rejangiz tayyor. Uni ko'rish va saqlab qo'yish uchun
                qisqa hisob oching — javoblaringiz yo'qolmaydi.
              </p>
              <UzHint>Bir daqiqa vaqt oladi. Kartani so'ramaymiz.</UzHint>
            </Card>

            <Button size="lg" block className="mt-7" onClick={() => navigate('/signup')}>
              Natijani ko'rish
            </Button>
            <p className="text-support mt-4 text-center">
              Hisobingiz bormi?{' '}
              <Link to="/signin" className="font-semibold text-signal-ink">
                Kiring
              </Link>
            </p>
          </>
        )}
      </Layout>
    )
  }

  if (!result) return <Spinner />

  return (
    <Layout caption="Natija" progress={{ value: total, max: total }} title={RESULT_HEADLINE_UZ[result.speaking]}>
      <Card>
        <p className="text-base leading-relaxed text-ink">{result.summaryUz}</p>

        {/* The codes stay, but as a caption under the claim — "A2" is not an answer. */}
        <p className="text-support mt-4 border-t border-hairline pt-4">
          Tushunish {result.comprehension} · {levelDescriptionUz[result.comprehension]} — Gapirish{' '}
          {result.speaking} · {levelDescriptionUz[result.speaking]}
        </p>
      </Card>

      {result.selfPerceptionNoteUz && (
        <p className="mt-3 rounded-[var(--radius-card)] bg-signal-soft px-4 py-3 text-base text-signal-ink">
          {result.selfPerceptionNoteUz}
        </p>
      )}

      <Card className="mt-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">
          Birinchi mashqingiz
        </p>
        <p className="mt-1 text-lg font-semibold text-ink">
          {result.firstMissionTitleUz || 'Birinchi mashq'}
        </p>
        <p className="text-support">
          {result.recommendedStartDay}-kun · {phaseLabelUz[result.startPhase]} bosqichi · ovozli
        </p>
      </Card>

      <p className="text-support mt-4">
        Bu dastlabki baho, rasmiy til sertifikati emas. Har bir ovozli mashqdan keyin yangilanadi.
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
        Keyinroq
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
  return (
    <fieldset>
      <legend className="mb-3 text-base font-medium text-ink">{legend}</legend>
      <div className="space-y-2">
        {SELF_SCALE.map((option) => (
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
            Mikrofonga ruxsat berilmadi. Javobingizni yozib ham yuborishingiz mumkin.
          </p>
        )}
        {speech.status === 'failed' && (
          <p className="text-support mb-2">
            Ovozni aniqlab bo'lmadi. Javobingizni yozib yuboring.
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Javobingizni yozing</span>
          <textarea
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-hairline bg-ground-raised px-3.5 py-3 text-base text-ink"
            placeholder="Masalan: Меня зовут Рустам. Я из Самарканда. Я работаю на складе."
          />
        </label>

        <Button size="lg" block className="mt-4" disabled={!answer.trim()} onClick={() => onSubmit(answer)}>
          Javobni yuborish
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
            Ovoz bilan javob berish
          </Button>
        )}
        <Button variant="ghost" block className="mt-2" onClick={onSkip}>
          O'tkazib yuborish
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
            Tugmani bosing va ruscha javob bering. Gapirib bo'lgach o'zi to'xtaydi.
          </p>
        )}
      </Card>

      {speech.status === 'listening' ? (
        <Button size="lg" block className="mt-4" variant="secondary" onClick={speech.stop}>
          To'xtatish
        </Button>
      ) : answer ? (
        <>
          <Button size="lg" block className="mt-4" onClick={() => onSubmit(answer)}>
            Javobni yuborish
          </Button>
          <Button variant="secondary" block className="mt-2" onClick={speech.start}>
            Qayta aytish
          </Button>
        </>
      ) : (
        <Button size="lg" block className="mt-4" onClick={speech.start}>
          Gapirishni boshlash
        </Button>
      )}

      <Button variant="ghost" block className="mt-2" onClick={() => setTyping(true)}>
        Yozib yuboraman
      </Button>
      <Button variant="ghost" block className="mt-1" onClick={onSkip}>
        O'tkazib yuborish
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
  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {caption}
        </p>
        <ProgressBar value={progress.value} max={progress.max} label="Onboarding progressi" />
      </div>

      <h1 className="mb-6 text-2xl font-semibold leading-snug tracking-tight text-ink">{title}</h1>
      {children}
    </div>
  )
}
