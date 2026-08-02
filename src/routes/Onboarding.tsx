import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, track } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { phaseLabelUz, levelDescriptionUz } from '../lib/format'
import type { DiagnosticAnswer, DiagnosticResult, DiagnosticSession, LearningGoal } from '../lib/types'
import { Button, Card, ErrorNote, ProgressBar, Spinner, UzHint } from '../components/ui'

type Stage = 'goal' | 'self' | 'items' | 'result'

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

export function Onboarding() {
  const navigate = useNavigate()
  const { completePendingOnboarding } = useAuth()
  const [stage, setStage] = useState<Stage>('goal')
  const [goal, setGoal] = useState<LearningGoal>('Both')
  const [comprehension, setComprehension] = useState(3)
  const [speaking, setSpeaking] = useState(2)
  const [session, setSession] = useState<DiagnosticSession | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([])
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function startDiagnostic() {
    setBusy(true)
    setError(null)
    try {
      const started = await api.post<DiagnosticSession>('/onboarding/diagnostic', {
        goal,
        selfRatedComprehension: comprehension,
        selfRatedSpeaking: speaking,
      })
      setSession({
        ...started,
        items: started.items.map((item) => ({
          ...item,
          options: shuffleOptions(item.options, `${started.attemptId}:${item.code}`),
        })),
      })
      setStage('items')
    } catch {
      setError("Testni boshlashda xatolik. Qayta urinib ko'ring.")
    } finally {
      setBusy(false)
    }
  }

  async function recordAnswer(answer: DiagnosticAnswer) {
    const next = [...answers, answer]
    setAnswers(next)

    if (!session || index + 1 < session.items.length) {
      setIndex(index + 1)
      return
    }

    setBusy(true)
    try {
      const submitted = await api.post<DiagnosticResult>('/onboarding/diagnostic/submit', {
        attemptId: session.attemptId,
        answers: next,
      })
      await completePendingOnboarding()
      setResult(submitted)
      setStage('result')
    } catch {
      setError("Natijani saqlashda xatolik. Qayta urinib ko'ring.")
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'goal') {
    return (
      <Layout step={1} total={4} title="Rus tilini nima uchun o'rganyapsiz?">
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
      <Layout step={2} total={4} title="O'zingizni qanday baholaysiz?">
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

        <Button size="lg" block className="mt-8" disabled={busy} onClick={() => void startDiagnostic()}>
          {busy ? 'Tayyorlanmoqda...' : 'Qisqa testni boshlash'}
        </Button>
        <UzHint>5-7 daqiqa. Ovozli savollar ixtiyoriy, istasangiz o'tkazib yuborishingiz mumkin.</UzHint>
      </Layout>
    )
  }

  if (stage === 'items') {
    if (!session) return <Spinner />
    if (busy) return <Spinner label="Natija hisoblanmoqda" />

    const item = session.items[index]
    if (!item) return <Spinner />

    return (
      <Layout
        step={3}
        total={4}
        title={`Savol ${index + 1} / ${session.items.length}`}
        progress={{ value: index, max: session.items.length }}
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
            {item.options.map((option) => (
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

  if (!result) return <Spinner />

  return (
    <Layout step={4} total={4} title="Sizning boshlang'ich darajangiz">
      <Card>
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Tushunish</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">{result.comprehension}</p>
            <p className="text-support">{levelDescriptionUz[result.comprehension]}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Gapirish</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">{result.speaking}</p>
            <p className="text-support">{levelDescriptionUz[result.speaking]}</p>
          </div>
        </div>

        <p className="mt-6 border-t border-hairline pt-5 text-base text-ink">
          {result.recommendedStartDay}-kundan boshlaysiz · {phaseLabelUz[result.startPhase]} bosqichi
        </p>
        <UzHint>{result.summaryUz}</UzHint>
      </Card>

      <p className="text-support mt-4">
        Bu dastlabki baho, rasmiy til sertifikati emas. Har bir ovozli mashqdan keyin yangilanadi.
      </p>

      <Button
        size="lg"
        block
        className="mt-7"
        onClick={() => {
          track('mission_opened', { source: 'onboarding' })
          navigate(result.firstMissionId ? `/missions/${result.firstMissionId}` : '/home')
        }}
      >
        Birinchi mashqni boshlash
      </Button>
      <Button variant="ghost" block className="mt-2" onClick={() => navigate('/home')}>
        Keyinroq
      </Button>
    </Layout>
  )
}

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
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
              value === option.value ? 'border-signal bg-signal-soft' : 'border-hairline bg-ground-raised'
            }`}
          >
            <input
              type="radio"
              name={legend}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="accent-[var(--color-signal)]"
            />
            <span className="text-base text-ink">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SpokenItem({
  onSubmit,
  onSkip,
}: {
  onSubmit: (transcript: string) => void
  onSkip: () => void
}) {
  const [transcript, setTranscript] = useState('')

  return (
    <div className="mt-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Javobingizni yozing</span>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-hairline bg-ground-raised px-3.5 py-3 text-base text-ink"
          placeholder="Masalan: Меня зовут Рустам. Я из Самарканда. Я работаю на складе."
        />
      </label>
      <UzHint>Istasangiz og'zaki aytib, keyin yozing. Istamasangiz savolni o'tkazib yuboring.</UzHint>

      <Button size="lg" block className="mt-4" disabled={!transcript.trim()} onClick={() => onSubmit(transcript)}>
        Javobni yuborish
      </Button>
      <Button variant="secondary" block className="mt-2" onClick={onSkip}>
        O'tkazib yuborish
      </Button>
    </div>
  )
}

function Layout({
  step,
  total,
  title,
  children,
  progress,
}: {
  step: number
  total: number
  title: string
  children: React.ReactNode
  progress?: { value: number; max: number }
}) {
  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Qadam {step} / {total}
        </p>
        <ProgressBar
          value={progress ? progress.value : step}
          max={progress ? progress.max : total}
          label="Onboarding progressi"
        />
      </div>

      <h1 className="mb-6 text-2xl font-semibold leading-snug tracking-tight text-ink">{title}</h1>
      {children}
    </div>
  )
}
