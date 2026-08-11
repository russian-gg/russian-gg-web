import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSpeechRecognition } from '../../lib/speech'
import { Button, ErrorNote } from '../../components/ui'
import { cx } from '../../lib/cx'

/**
 * Arra — the saw.
 *
 * A question sits on the screen and a blade rolls toward you from the left. Speaking pushes it
 * back; silence and hesitation let it come on. Survive a minute and the round is yours.
 *
 * The blade is driven by the same arithmetic the placement uses — how much Russian comes out,
 * and whether it comes out in runs rather than single words — because a game that rewards a
 * model's opinion of you teaches you to please a model. This one rewards speaking, measurably.
 */

const ROUND_SECONDS = 60

/** How far the blade travels, in percent of the track, per second of each state. */
const ADVANCE_IDLE = 7
const ADVANCE_STALLED = 12
const RETREAT_MAX = 16

const QUESTIONS = [
  'Ismingiz nima va qayerda ishlaysiz?',
  "Bugun ertalab nima qildingiz? Ruscha aytishga harakat qiling.",
  'Do\'konda non so\'ramoqchisiz. Nima deysiz?',
  'Taksi haydovchisiga manzilingizni ayting.',
  'Ishdagi hamkasbingiz bilan tanishing.',
  'Shifokorga nima og\'riyotganini tushuntiring.',
  'Bozorda narxni so\'rang va savdolashing.',
  'Qo\'shningiz bilan ob-havo haqida gaplashing.',
]

type Phase = 'ready' | 'playing' | 'cut' | 'won'

export function SawGame() {
  const navigate = useNavigate()
  // Russian recognition on purpose: the blade retreats for Russian, so Russian is the thing
  // that has to be heard well. Uzbek still registers as speech, which is what stops the stall.
  const speech = useSpeechRecognition('ru-RU')

  const [phase, setPhase] = useState<Phase>('ready')
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  /** 0 is the far left, 100 is the avatar. */
  const [blade, setBlade] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)

  const heard = useRef({ text: '', at: 0, words: 0, russian: 0 })
  const question = QUESTIONS[round % QUESTIONS.length]

  const start = useCallback(() => {
    heard.current = { text: '', at: Date.now(), words: 0, russian: 0 }
    speech.reset()
    speech.start()
    setBlade(0)
    setSecondsLeft(ROUND_SECONDS)
    setPhase('playing')
  }, [speech])

  const stop = useCallback(() => {
    speech.stop()
  }, [speech])

  /*
   * Every transcript update is a heartbeat: it says they are still talking, and how much of
   * what they said was Russian. Held in a ref so the blade loop can read it without a render
   * per syllable.
   */
  useEffect(() => {
    if (phase !== 'playing') return

    const text = speech.transcript.trim()
    if (!text || text === heard.current.text) return

    const words = text.split(/\s+/).filter(Boolean)
    const russian = words.filter((word) => /[Ѐ-ӿ]/.test(word)).length

    heard.current = { text, at: Date.now(), words: words.length, russian }
  }, [speech.transcript, phase])

  // The blade, and the clock it is racing.
  useEffect(() => {
    if (phase !== 'playing') return

    const tick = window.setInterval(() => {
      const since = (Date.now() - heard.current.at) / 1000
      const { words, russian } = heard.current

      setBlade((position) => {
        /*
         * Three states, and the middle one is the point of the game: a sentence in progress
         * pushes the blade away, a pause lets it drift in, and a long silence brings it on
         * fast. Nothing here punishes a wrong word — only stopping.
         */
        const step =
          since < 1.5
            ? -Math.min(RETREAT_MAX, 4 + russian * 3 + Math.min(words, 12) * 0.5)
            : since < 3
              ? ADVANCE_IDLE
              : ADVANCE_STALLED

        const next = position + step / 10

        if (next >= 100) {
          setPhase('cut')

          return 100
        }

        return Math.max(0, next)
      })
    }, 100)

    return () => window.clearInterval(tick)
  }, [phase])

  useEffect(() => {
    if (phase !== 'playing') return

    const timer = window.setInterval(() => {
      setSecondsLeft((left) => {
        if (left <= 1) {
          setPhase('won')

          return 0
        }

        return left - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [phase])

  // Whatever ends the round, the microphone closes with it.
  useEffect(() => {
    if (phase === 'cut' || phase === 'won') stop()
  }, [phase, stop])

  useEffect(() => () => speech.stop(), [speech])

  useEffect(() => {
    if (phase === 'won') setScore((current) => current + 1)
  }, [phase])

  const danger = blade > 68

  const spoken = useMemo(() => speech.transcript.trim(), [speech.transcript])

  return (
    <main className="min-h-screen bg-ground-sunken px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/games')}
            className="text-sm font-bold text-ink-muted transition-colors hover:text-ink"
          >
            ← O'yinlar
          </button>

          <div className="flex items-center gap-3 text-sm font-black">
            <span className="text-ink-muted">
              Ball: <span className="text-ink tabular-nums">{score}</span>
            </span>
            {phase === 'playing' && (
              <span className={cx('tabular-nums', secondsLeft <= 10 ? 'text-caution' : 'text-ink')}>
                {secondsLeft}s
              </span>
            )}
          </div>
        </header>

        <section className="rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-5">
          <p className="text-xs font-black tracking-[0.14em] text-ink-faint uppercase">
            {round + 1}-savol
          </p>
          <h1 className="mt-1.5 text-xl leading-snug font-black text-ink">{question}</h1>
        </section>

        {/* The track. Everything about the danger is spatial — distance, speed, colour. */}
        <section
          className={cx(
            'relative overflow-hidden rounded-[var(--radius-card)] border-2 p-4 transition-colors duration-300',
            danger ? 'border-danger bg-danger-soft/30' : 'border-hairline bg-ground-raised',
          )}
        >
          <div className="relative h-28">
            <div className="absolute inset-x-0 bottom-6 h-1 rounded-full bg-hairline" />

            <div
              className="absolute bottom-2 transition-[left] duration-100 ease-linear"
              style={{ left: `calc(${blade}% - ${blade * 0.56}px)` }}
            >
              <Blade spinning={phase === 'playing'} />
            </div>

            <div className="absolute right-0 bottom-2">
              <Avatar scared={danger} cut={phase === 'cut'} />
            </div>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ground-sunken">
            <div
              className={cx(
                'h-full rounded-full transition-[width,background-color] duration-100 ease-linear',
                danger ? 'bg-danger' : 'bg-signal',
              )}
              style={{ width: `${blade}%` }}
            />
          </div>
        </section>

        {phase === 'playing' && (
          <div className="min-h-16 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-4 py-3">
            <p className={cx('text-[15px] leading-relaxed', spoken ? 'text-ink' : 'text-ink-faint')}>
              {spoken || 'Gapiring — jim turmang, arra yaqinlashadi.'}
            </p>
          </div>
        )}

        {!speech.supported && (
          <ErrorNote>
            Bu brauzer ovozni tanimaydi. Chrome yoki Safari'da oching.
          </ErrorNote>
        )}

        {speech.status === 'denied' && (
          <ErrorNote>Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.</ErrorNote>
        )}

        {phase === 'ready' && (
          <Button block disabled={!speech.supported} onClick={start}>
            Boshlash
          </Button>
        )}

        {phase === 'cut' && (
          <div className="space-y-3 rounded-[var(--radius-card)] border-2 border-danger bg-danger-soft/30 p-5 text-center">
            <p className="text-2xl font-black text-danger">Vaa! 😱</p>
            <p className="text-[15px] text-ink">
              Arra yetib keldi. Jim qolgan payting — u yaqinlashadi.
            </p>
            <Button block onClick={start}>
              Qayta urinish
            </Button>
          </div>
        )}

        {phase === 'won' && (
          <div className="space-y-3 rounded-[var(--radius-card)] border-2 border-milestone bg-milestone-soft/40 p-5 text-center">
            <p className="text-2xl font-black text-milestone">Omon qoldingiz! 🎉</p>
            <p className="text-[15px] text-ink">Bir daqiqa to'xtamay gapirdingiz. Bitta ball sizniki.</p>
            <Button
              block
              onClick={() => {
                setRound((current) => current + 1)
                setPhase('ready')
              }}
            >
              Keyingi savol
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}

/** A circular blade. It spins while the round is live, and stops dead when it lands. */
function Blade({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 56 56"
      aria-hidden
      className={cx('size-14 drop-shadow-sm', spinning && 'motion-safe:animate-spin')}
      style={spinning ? { animationDuration: '0.7s' } : undefined}
    >
      <circle cx="28" cy="28" r="20" className="fill-[var(--color-ink-faint)]" />
      {Array.from({ length: 12 }, (_, index) => (
        <rect
          key={index}
          x="26"
          y="1"
          width="4"
          height="10"
          rx="1"
          className="fill-[var(--color-ink-muted)]"
          transform={`rotate(${index * 30} 28 28)`}
        />
      ))}
      <circle cx="28" cy="28" r="9" className="fill-[var(--color-ground-raised)]" />
      <circle cx="28" cy="28" r="3" className="fill-[var(--color-ink-faint)]" />
    </svg>
  )
}

/** The learner, as a shape rather than a portrait: this has to read at a glance, mid-panic. */
function Avatar({ scared, cut }: { scared: boolean; cut: boolean }) {
  return (
    <svg
      viewBox="0 0 48 56"
      aria-hidden
      className={cx('size-14 transition-transform duration-200', cut && 'rotate-12 opacity-60')}
    >
      <circle cx="24" cy="16" r="12" className={cx(cut ? 'fill-danger' : 'fill-[var(--color-signal)]')} />
      <path
        d="M8 54c0-9 7-15 16-15s16 6 16 15"
        className={cx(cut ? 'fill-danger' : 'fill-[var(--color-signal)]')}
      />
      <circle cx="19" cy="14" r={scared ? 3 : 2} className="fill-[var(--color-on-signal)]" />
      <circle cx="29" cy="14" r={scared ? 3 : 2} className="fill-[var(--color-on-signal)]" />
      <path
        d={scared ? 'M19 23a5 5 0 0 1 10 0' : 'M19 21a5 5 0 0 0 10 0'}
        className="fill-none stroke-[var(--color-on-signal)] stroke-2"
        strokeLinecap="round"
      />
    </svg>
  )
}
