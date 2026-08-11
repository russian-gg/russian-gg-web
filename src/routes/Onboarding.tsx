import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { onboardingDraft } from '../lib/onboardingDraft'
import { LiveVoiceSession, releaseMicrophone, requestMicrophone } from '../lib/liveVoice'
import type { VoiceErrorCode } from '../lib/liveVoice'
import type { AnonymousAssessment, OnboardingAssessment, VoiceSessionOutcome } from '../lib/types'
import { LevelDashboard } from '../components/LevelDashboard'
import { VoiceSignal } from '../components/VoiceSignal'
import { Button, ErrorNote, Spinner } from '../components/ui'
import { cx } from '../lib/cx'

type Stage = 'intro' | 'speaking' | 'analysing' | 'result'

const MIC_MESSAGE: Partial<Record<VoiceErrorCode, string>> = {
  mic_denied: "Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.",
  mic_blocked: "Mikrofon bloklangan. Brauzer sozlamalaridan ruxsat bering.",
  mic_not_found: 'Mikrofon topilmadi.',
  mic_busy: 'Mikrofonni boshqa dastur band qilgan.',
  mic_insecure: "Sahifani https orqali oching — mikrofon aks holda ishlamaydi.",
}

/**
 * The first minute of an account.
 *
 * It used to be ten questions establishing something we already assumed and the learner
 * already knew: they follow Russian and cannot speak it. Now the microphone opens, they talk
 * about their own Russian for forty seconds in whatever mix of Uzbek and Russian comes out,
 * and the result is a measurement of them rather than a summary of their answers.
 *
 * Forty seconds is the whole design constraint. Long enough to hear a sentence attempted,
 * short enough that nobody has to think of something to say — and short enough that stopping
 * halfway is itself the finding rather than a failure.
 */
export function Onboarding() {
  const navigate = useNavigate()
  const { user, completePendingOnboarding } = useAuth()

  const [stage, setStage] = useState<Stage>('intro')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [total, setTotal] = useState(40)
  const [speaking, setSpeaking] = useState(false)
  const [failure, setFailure] = useState('')

  /*
   * Two buffers. The session hands over the whole of the current turn each time it updates,
   * so appending would print the sentence again on every chunk — but a turn that ends is gone
   * from it entirely, and forty seconds is usually several turns. What is finished is kept
   * here and what is still being said is kept beside it.
   */
  const [saidSoFar, setSaidSoFar] = useState('')
  const [saying, setSaying] = useState('')

  const [assessment, setAssessment] = useState<OnboardingAssessment | null>(null)

  const session = useRef<LiveVoiceSession | null>(null)
  const transcript = useRef({ committed: '', live: '' })

  /**
   * Somebody who already spoke gets their result back rather than being asked again — and
   * somebody who spoke before signing up has their recording attached to the account that
   * just opened, which is what stops them being measured twice.
   */
  useEffect(() => {
    if (!user) return

    let cancelled = false
    const pending = onboardingDraft.read()

    const load = pending
      ? api
          .post<OnboardingAssessment | null>('/onboarding/claim', { token: pending })
          .finally(() => onboardingDraft.clear())
      : api.get<OnboardingAssessment | null>('/onboarding/assessment')

    void load
      .then((existing) => {
        if (!cancelled && existing) {
          setAssessment(existing)
          setStage('result')
        }
      })
      .catch(() => {
        // Nothing placed yet is the ordinary case, and not an error worth showing.
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const finish = useCallback(async () => {
    const live = session.current
    session.current = null

    const elapsed = Math.round(live?.elapsedSeconds ?? 0)
    await live?.close()
    releaseMicrophone()

    const spoken = `${transcript.current.committed} ${transcript.current.live}`.trim()

    setStage('analysing')

    try {
      const result = await api.post<AnonymousAssessment>('/onboarding/assess', {
        transcript: spoken,
        elapsedSeconds: elapsed || total,
      })

      // Held for the hop through sign-up. A signed-in learner is already placed and gets no
      // token, so there is nothing to carry.
      if (result.token) onboardingDraft.save(result.token)
      else await completePendingOnboarding()

      setAssessment(result.assessment)
      setStage('result')
    } catch {
      setFailure("Natijani hisoblab bo'lmadi. Qayta urinib ko'ring.")
      setStage('intro')
    }
  }, [completePendingOnboarding, total])

  // The clock the learner watches, and the one that ends the session.
  useEffect(() => {
    if (stage !== 'speaking') return

    const timer = window.setInterval(() => {
      setSecondsLeft((left) => {
        if (left <= 1) {
          window.clearInterval(timer)
          void finish()

          return 0
        }

        return left - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [stage, finish])

  // A tab closed mid-sentence still frees the microphone.
  useEffect(() => () => void session.current?.close().then(() => releaseMicrophone()), [])

  async function start() {
    setFailure('')
    setStage('speaking')
    setSaidSoFar('')
    setSaying('')
    transcript.current = { committed: '', live: '' }

    // Fired, not awaited: the permission prompt and the ticket are independent, and asking
    // for them in series is a second of the forty this page only has.
    void requestMicrophone().catch(() => {})

    let outcome: VoiceSessionOutcome
    try {
      outcome = await api.post<VoiceSessionOutcome>('/onboarding/voice', {})
    } catch {
      setFailure("Ulanib bo'lmadi. Birozdan keyin urinib ko'ring.")
      setStage('intro')

      return
    }

    if (!outcome.isAvailable || !outcome.ticket) {
      setFailure(outcome.unavailable?.messageUz ?? "Ovoz hozir ishlamayapti.")
      setStage('intro')

      return
    }

    const ticket = outcome.ticket
    const live = new LiveVoiceSession(ticket, {
      onStatus: (status) => setSpeaking(status === 'listening'),
      onConnected: () => {
        setTotal(ticket.maxDurationSeconds)
        setSecondsLeft(ticket.maxDurationSeconds)
      },
      onInputTranscript: (text) => {
        transcript.current.live = text
        setSaying(text)
      },
      // The tutor asks one question and then stays quiet, so there is nothing worth showing
      // from its side — and printing it would compete with the learner's own words.
      onOutputTranscript: () => {},
      onError: (code) => {
        setFailure(MIC_MESSAGE[code] ?? "Ovoz ulanmadi. Birozdan keyin urinib ko'ring.")
        void finish()
      },
      // Forty seconds is too short to reconnect through. Whatever was said already counts.
      onDropped: () => void finish(),
      onTurnComplete: () => {
        transcript.current.committed = `${transcript.current.committed} ${transcript.current.live}`.trim()
        transcript.current.live = ''
        setSaidSoFar(transcript.current.committed)
        setSaying('')
        void live.beginNextTurn()
      },
      onSilenceTimeout: () => void live.finishCurrentTurn(),
      onNoSpeech: () => void live.finishCurrentTurn(),
    })

    session.current = live

    try {
      await live.start()
    } catch {
      setFailure("Mikrofon ochilmadi. Ruxsat berilganini tekshiring.")
      void finish()
    }
  }

  if (stage === 'result' && assessment) {
    return (
      <Layout wide>
        <LevelDashboard
          assessment={assessment}
          continueLabel={user ? 'Birinchi mashqni boshlash' : "Rejani saqlab, boshlash"}
          onContinue={() =>
            navigate(
              !user
                ? '/signup'
                : assessment.firstMissionId
                  ? `/missions/${assessment.firstMissionId}`
                  : '/home',
            )
          }
        />
      </Layout>
    )
  }

  if (stage === 'analysing') {
    return (
      <Layout>
        <div className="space-y-4 py-10 text-center">
          <Spinner />
          <h1 className="text-xl font-black text-ink">Darajangiz tahlil qilinmoqda</h1>
          <p className="text-[15px] text-ink-muted">
            Aytganlaringizni o'qiyapmiz — bir necha soniya.
          </p>
        </div>
      </Layout>
    )
  }

  if (stage === 'speaking') {
    const said = `${saidSoFar} ${saying}`.trim()
    const elapsed = total - secondsLeft

    return (
      <Layout>
        <div className="space-y-5">
          <Countdown secondsLeft={secondsLeft} total={total} />

          <p className="text-center text-lg font-black text-ink">
            Rus tilingiz haqida gapiring
          </p>
          <p className="-mt-3 text-center text-sm text-ink-muted">
            O'zbekcha aralashtirsangiz ham bo'ladi — qayerda qiynalasiz?
          </p>

          <div className="flex justify-center">
            <VoiceSignal state={speaking ? 'listening' : 'thinking'} />
          </div>

          {/*
            Printed as they speak, because seeing your own sentence stop is the moment this
            screen exists for. It is also the evidence behind the number on the next screen.
          */}
          <div className="min-h-28 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-4 py-3">
            {said ? (
              <p className="text-[15px] leading-relaxed text-ink">{said}</p>
            ) : (
              <p className="text-[15px] text-ink-faint">
                {elapsed < 4 ? 'Tinglayapmiz…' : 'Boshlang — bir gap ham yetadi.'}
              </p>
            )}
          </div>

          <Button variant="secondary" block onClick={() => void finish()}>
            Yakunlash
          </Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-5 text-center">
        <p className="text-xs font-black tracking-[0.16em] text-ink-faint uppercase">1 qadam</p>
        <h1 className="text-2xl leading-tight font-black text-ink sm:text-3xl">
          Rus tili darajangiz haqida aytib bering
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          Mikrofonni bosing va 40 soniya gapiring. Qayerda qiynalasiz — ishdami, ko'chadami?
          O'zbekcha aralashtirsangiz ham bo'ladi, savol yo'q, test yo'q.
        </p>

        {failure && <ErrorNote>{failure}</ErrorNote>}

        <button
          type="button"
          onClick={() => void start()}
          className="mx-auto grid size-24 place-items-center rounded-full bg-signal text-on-signal transition-transform hover:scale-105 active:scale-95"
          aria-label="Gapirishni boshlash"
        >
          <MicGlyph />
        </button>

        <p className="text-sm font-bold text-ink">Bosing va gapiring</p>
        <p className="text-xs text-ink-faint">40 soniya · javobingiz saqlanadi</p>
      </div>
    </Layout>
  )
}

/** The clock as a ring: a number alone does not read as running out. */
function Countdown({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const fraction = total === 0 ? 0 : secondsLeft / total
  const circumference = 2 * Math.PI * 34

  return (
    <div className="flex justify-center">
      <div className="relative grid size-20 place-items-center">
        <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-hairline)" strokeWidth="5" />
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke={secondsLeft <= 8 ? 'var(--color-caution)' : 'var(--color-signal)'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className="transition-[stroke-dashoffset,stroke] duration-1000 ease-linear motion-reduce:transition-none"
          />
        </svg>
        <span
          className={cx(
            'text-2xl font-black tabular-nums',
            secondsLeft <= 8 ? 'text-caution' : 'text-ink',
          )}
        >
          {secondsLeft}
        </span>
      </div>
    </div>
  )
}

function MicGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-10 fill-none stroke-current stroke-[1.8]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  )
}

function Layout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-ground-sunken px-4 py-8">
      <div className={cx('mx-auto', wide ? 'max-w-xl' : 'max-w-md')}>{children}</div>
    </main>
  )
}
