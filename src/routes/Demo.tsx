import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { LiveVoiceSession, releaseMicrophone, requestMicrophone } from '../lib/liveVoice'
import type { VoiceErrorCode } from '../lib/liveVoice'
import type { VoiceSessionOutcome } from '../lib/types'
import { Button, Spinner } from '../components/ui'
import { VoiceSignal } from '../components/VoiceSignal'
import { cx } from '../lib/cx'

type DemoPhrase = { russian: string; uzbek: string }

type DemoView = {
  titleUz: string
  situationUz: string
  phrases: DemoPhrase[]
  /** "ready", "spent" or "expired". */
  status: string
  maxSeconds: number
}

const TELEGRAM_URL = 'https://t.me/russian_gg'

const MIC_MESSAGE: Partial<Record<VoiceErrorCode, string>> = {
  mic_denied: "Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.",
  mic_blocked: "Mikrofon bloklangan. Brauzer sozlamalaridan ruxsat bering.",
  mic_not_found: 'Mikrofon topilmadi.',
  mic_busy: 'Mikrofonni boshqa dastur band qilgan.',
  mic_insecure: "Havolani https orqali oching — mikrofon aks holda ishlamaydi.",
}

/**
 * One minute of the product, built for the situation somebody described in Telegram, opened
 * from a link by a person with no account.
 *
 * The whole page is the market stall handing over a taste: no sign-up, no explanation of what
 * the app is, no price. A title, the three lines they will need, and a button. Everything else
 * on this screen would be something to read instead of speak.
 *
 * The voice session itself is the product's own — the same module the paid missions use, given
 * a ticket the server minted for this link. Nothing about it is a mock.
 */
export function Demo() {
  const { token = '' } = useParams()

  const [demo, setDemo] = useState<DemoView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState('')

  const [phase, setPhase] = useState<'idle' | 'connecting' | 'live' | 'done'>('idle')
  const [speaking, setSpeaking] = useState(false)
  const [heard, setHeard] = useState('')
  const [said, setSaid] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)

  const session = useRef<LiveVoiceSession | null>(null)

  useEffect(() => {
    let cancelled = false

    api
      .get<DemoView>(`/demo/${token}`)
      .then((next) => {
        if (!cancelled) setDemo(next)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setFailure(
          error instanceof RequestError && error.status === 404
            ? 'Bunday havola topilmadi.'
            : "Havolani ochib bo'lmadi.",
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  /** Ends the minute: closes the socket, frees the microphone, records how long it ran. */
  const stop = useCallback(async () => {
    const live = session.current
    session.current = null
    setPhase('done')

    const elapsed = live?.elapsedSeconds ?? 0
    await live?.close()
    releaseMicrophone()

    // Best effort. Somebody who closed the tab is somebody whose minute still happened, and
    // the panel would rather have an approximate length than none.
    await api.post(`/demo/${token}/end`, { elapsedSeconds: Math.round(elapsed) }).catch(() => {})
  }, [token])

  // The clock the learner sees, and the one that ends the session. Counted here rather than
  // trusted to the provider, which has no idea what this link is worth.
  useEffect(() => {
    if (phase !== 'live') return

    const timer = window.setInterval(() => {
      setSecondsLeft((left) => {
        if (left <= 1) {
          window.clearInterval(timer)
          void stop()

          return 0
        }

        return left - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [phase, stop])

  // A tab closed mid-sentence still frees the microphone.
  useEffect(() => () => void session.current?.close().then(() => releaseMicrophone()), [])

  async function start() {
    if (!demo) return

    setFailure('')
    setPhase('connecting')

    // Fired, not awaited: the permission prompt and the ticket request are independent, and
    // asking for them in series is a second of a minute this page only has sixty of.
    void requestMicrophone().catch(() => {})

    let outcome: VoiceSessionOutcome
    try {
      outcome = await api.post<VoiceSessionOutcome>(`/demo/${token}/session`, {})
    } catch {
      setFailure("Ulanib bo'lmadi. Birozdan keyin urinib ko'ring.")
      setPhase('idle')

      return
    }

    if (!outcome.isAvailable || !outcome.ticket) {
      setFailure(outcome.unavailable?.messageUz ?? "Bu havola endi ishlamaydi.")
      setPhase('idle')
      setDemo({ ...demo, status: 'spent' })

      return
    }

    const live = new LiveVoiceSession(outcome.ticket, {
      onStatus: (status) => setSpeaking(status === 'thinking'),
      onConnected: () => {
        setPhase('live')
        setSecondsLeft(outcome.ticket!.maxDurationSeconds)
      },
      onInputTranscript: (text) => setSaid((current) => current + text),
      onOutputTranscript: (text) => setHeard((current) => current + text),
      onError: (code) => {
        setFailure(MIC_MESSAGE[code] ?? "Ovoz ulanmadi. Birozdan keyin urinib ko'ring.")
        void stop()
      },
      // One minute is too short to reconnect through. Whatever was said already counts.
      onDropped: () => void stop(),
      onTurnComplete: () => {
        setSaid('')
        setHeard('')
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
      void stop()
    }
  }

  if (loading) return <Centred><Spinner /></Centred>

  if (failure && !demo) return <Centred><Closed message={failure} /></Centred>

  if (!demo) return null

  if (demo.status !== 'ready' && phase === 'idle') {
    return (
      <Centred>
        <Closed
          message={
            demo.status === 'spent'
              ? "Bu mashqdan bir marta foydalanilgan."
              : 'Havolaning muddati tugagan.'
          }
        />
      </Centred>
    )
  }

  return (
    <Centred>
      <div className="w-full max-w-md">
        <p className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
          Sizning holatingiz uchun
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{demo.titleUz}</h1>

        {phase === 'idle' && (
          <>
            <p className="text-support mt-2">
              1 daqiqa gaplashib ko'rasiz. Bepul, ro'yxatdan o'tish shart emas.
            </p>

            {/*
              The lines they will need, before they need them. Not a lesson — a person about to
              speak a language they are afraid of should be able to see that it is four short
              sentences, not a wall.
            */}
            {demo.phrases.length > 0 && (
              <ul className="mt-6 space-y-2.5">
                {demo.phrases.map((phrase) => (
                  <li
                    key={phrase.russian}
                    className="rounded-[var(--radius-card)] border-2 border-hairline px-4 py-3"
                  >
                    <p className="font-bold text-ink">{phrase.russian}</p>
                    {phrase.uzbek && <p className="text-support mt-0.5">{phrase.uzbek}</p>}
                  </li>
                ))}
              </ul>
            )}

            {failure && <p className="mt-6 text-sm font-bold text-danger">{failure}</p>}

            <Button className="mt-6" block onClick={() => void start()}>
              Mikrofonni yoqib, boshlash
            </Button>
            <p className="text-support mt-3 text-center">Suhbatni ustoz boshlaydi.</p>
          </>
        )}

        {phase === 'connecting' && (
          <div className="mt-10 flex flex-col items-center gap-4">
            <VoiceSignal state="thinking" />
            <p className="text-support">Ulanmoqda…</p>
          </div>
        )}

        {phase === 'live' && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink-muted">
                {speaking ? 'Ustoz gapirmoqda' : 'Gapiring'}
              </span>
              {/* A minute is short enough that the number is reassuring rather than pressing. */}
              <span
                className={cx(
                  'text-sm font-extrabold tabular-nums',
                  secondsLeft <= 10 ? 'text-danger' : 'text-ink-muted',
                )}
              >
                {secondsLeft}s
              </span>
            </div>

            <div className="mt-6 flex justify-center">
              <VoiceSignal state={speaking ? 'thinking' : 'listening'} />
            </div>

            {/*
              What was just said, both ways. It is what makes a first minute survivable: a
              beginner who missed the question can read it instead of freezing.
            */}
            <div className="mt-8 space-y-3">
              {heard && (
                <p className="rounded-[var(--radius-card)] bg-ground-sunken px-4 py-3 text-ink">{heard}</p>
              )}
              {said && (
                <p className="rounded-[var(--radius-card)] bg-signal-soft px-4 py-3 text-signal-ink">
                  {said}
                </p>
              )}
            </div>

            <Button variant="secondary" className="mt-8" block onClick={() => void stop()}>
              Tugatish
            </Button>
          </div>
        )}

        {phase === 'done' && (
          <div className="mt-8">
            <p className="text-lg font-extrabold text-ink">Mana shunday bo'ladi.</p>
            <p className="text-support mt-2">
              Har kuni 15 daqiqa — shu tarzda, sizning holatlaringiz bo'yicha. 90 kunda ish va
              kundalik hayot uchun gapira boshlaysiz.
            </p>

            {failure && <p className="mt-4 text-sm font-bold text-danger">{failure}</p>}

            {/*
              The placement test rather than the price. It is free, it takes two minutes, and it
              is the product's own front door — asking for money from somebody who has spoken
              Russian for sixty seconds is a step too early.
            */}
            <Link to="/onboarding" className="mt-6 block">
              <Button block>Darajangizni aniqlang · 2 daqiqa</Button>
            </Link>

            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-center text-sm font-bold text-signal-ink"
            >
              Telegramga qaytish
            </a>
          </div>
        )}
      </div>
    </Centred>
  )
}

function Centred({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-ground px-5 py-10">{children}</div>
}

/**
 * A spent or expired link. Ends on the way back to the conversation it came from rather than
 * on an apology — there is a person on the other end of that chat who can send another.
 */
function Closed({ message }: { message: string }) {
  return (
    <div className="w-full max-w-md text-center">
      <div className="text-xl font-extrabold tracking-tight text-ink">
        russian<span className="text-signal">.gg</span>
      </div>
      <p className="mt-4 text-ink">{message}</p>
      <p className="text-support mt-2">Telegramda yozing — yangisini yuboramiz.</p>
      <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="mt-6 block">
        <Button block>Telegramda yozish</Button>
      </a>
    </div>
  )
}
