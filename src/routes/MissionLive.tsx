import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { characterColors, characterName, characterPalette } from '../lib/character'
import { fill, useT } from '../lib/i18n'
import { LiveVoiceSession, releaseMicrophone, requestMicrophone } from '../lib/liveVoice'
import type { LiveVoiceStatus } from '../lib/liveVoice'
import type { MissionDetail, StartAttemptResponse, VoiceSessionOutcome } from '../lib/types'
import { CharacterOrb, type OrbState } from '../components/CharacterOrb'
import { Button, ErrorNote, Spinner } from '../components/ui'

type Phase = 'ready' | 'connecting' | 'live' | 'finishing' | 'unavailable'

/** What the sphere shows for each state of the connection. */
const ORB_STATE: Record<LiveVoiceStatus, OrbState> = {
  idle: 'idle',
  connecting: 'thinking',
  listening: 'listening',
  thinking: 'thinking',
  closed: 'idle',
}

/**
 * The conversation itself: one character, one goal, five minutes.
 *
 * The learner talks to a sphere rather than a chat log — the point is to speak and be heard,
 * and a transcript on screen invites reading instead. What is on screen is the character's
 * colour, how far through the scene they are, and how long they have left.
 */
export function MissionLive() {
  const t = useT()
  const copy = t.missionLive
  const navigate = useNavigate()
  const { missionId } = useParams<{ missionId: string }>()

  const { data: mission, isLoading } = useQuery({
    queryKey: ['mission-detail', missionId],
    queryFn: () => api.get<MissionDetail>(`/missions/${missionId}`),
    enabled: Boolean(missionId),
  })

  const [phase, setPhase] = useState<Phase>('ready')
  const [status, setStatus] = useState<LiveVoiceStatus>('idle')
  const [beatIndex, setBeatIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [goalReached, setGoalReached] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sessionRef = useRef<LiveVoiceSession | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const attemptRef = useRef<StartAttemptResponse | null>(null)
  const learnerRef = useRef('')
  const tutorRef = useRef('')
  const beatRef = useRef(0)
  const finishingRef = useRef(false)
  /** Every exchange as it happened, handed to the server when the conversation ends. */
  const turnsRef = useRef<{ stepIndex: number; learnerTranscript: string; tutorTranscript: string | null }[]>([])

  const beats = mission?.dialogue?.beats ?? []
  const phrases = mission?.targetPhrases ?? []
  const character = mission?.dialogue?.character ?? 'None'
  const colors = characterColors(character)
  const palette = characterPalette(character)
  const name = characterName(character, t)

  /** Ends the conversation the same way whatever stopped it: time, goal, or the learner. */
  const finish = useCallback(async () => {
    if (finishingRef.current) return
    finishingRef.current = true
    setPhase('finishing')

    const session = sessionRef.current
    const sessionId = sessionIdRef.current
    const attempt = attemptRef.current
    sessionRef.current = null

    if (session) {
      const elapsed = session.elapsedSeconds
      await session.close().catch(() => {})
      releaseMicrophone()
      if (sessionId) {
        await api
          .post('/missions/voice/sessions/end', {
            sessionId,
            elapsedSeconds: elapsed,
            lastStepIndex: beatRef.current,
            completed: true,
            failureReason: null,
          })
          .catch(() => {})
      }
    }

    if (!attempt) {
      navigate(`/missions/${missionId}`, { replace: true })
      return
    }

    try {
      // Everything the learner said, graded in one pass now that the conversation is over.
      // Scoring answer by answer put a model call between the learner and their next sentence.
      if (turnsRef.current.length > 0) {
        await api
          .post('/missions/attempts/dialogue-turns', {
            attemptId: attempt.attemptId,
            turns: turnsRef.current,
          })
          .catch(() => {})
        turnsRef.current = []
      }

      await api.post(`/missions/attempts/${attempt.attemptId}/complete`)
      navigate(`/missions/attempts/${attempt.attemptId}/result`, { replace: true })
    } catch {
      navigate(`/missions/${missionId}`, { replace: true })
    }
  }, [missionId, navigate])

  // The session's own clock. The server caps and clamps what it bills; this is what the
  // learner sees, and it is what stops the conversation on time.
  useEffect(() => {
    if (phase !== 'live' || secondsLeft === null) return
    if (secondsLeft <= 0) {
      void finish()
      return
    }

    const timer = window.setTimeout(() => setSecondsLeft((left) => (left ?? 1) - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, secondsLeft, finish])

  useEffect(() => () => {
    void sessionRef.current?.close().catch(() => {})
    releaseMicrophone()
  }, [])

  /**
   * Reopens the microphone for the learner's next answer.
   *
   * The session stops recording the moment a turn completes and only starts again when it is
   * asked to. Without this the conversation died after the first exchange: the learner kept
   * talking into a microphone that was no longer sending anything, and Google closed the idle
   * socket about a minute later with no error anywhere.
   */
  const listenAgain = useCallback(async () => {
    if (finishingRef.current) return

    await sessionRef.current?.beginNextTurn().catch(() => {})
  }, [])

  /**
   * One exchange of the scene. Nothing is sent while the conversation is running: the answer is
   * kept for the single grading pass at the end, and the scene moves on immediately.
   */
  function recordTurn() {
    const spoken = learnerRef.current.trim()
    learnerRef.current = ''
    const tutor = tutorRef.current.trim()
    tutorRef.current = ''

    // The character spoke but the learner has not answered yet — that is the tutor's own turn,
    // not an exchange, and the scene has not moved.
    if (!attemptRef.current || spoken.length === 0) {
      void listenAgain()
      return
    }

    turnsRef.current.push({
      stepIndex: beatRef.current,
      learnerTranscript: spoken,
      tutorTranscript: tutor || null,
    })

    // The dots follow the conversation, not the score. Following the server's step index made
    // them sit still through an answer that was understood but imperfect, and jump two beats
    // when a later answer covered them both.
    const next = Math.min(beatRef.current + 1, Math.max(beats.length - 1, 0))
    beatRef.current = next
    setBeatIndex(next)

    if (beats.length > 0 && turnsRef.current.length >= beats.length) {
      setGoalReached(true)
      // Let the character finish its closing line before the screen changes.
      window.setTimeout(() => void finish(), 1800)
      return
    }

    void listenAgain()
  }

  async function connect() {
    if (!missionId) return
    setError(null)
    setPhase('connecting')

    try {
      // Kept inside the learner's tap: Android grants the microphone to a gesture, and a
      // billed session should never be opened before the browser has said yes.
      await requestMicrophone()
    } catch {
      setPhase('ready')
      setError(copy.startFailed)
      return
    }

    try {
      let attempt = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts`)
      if (attempt.requiresExplicitRestart) {
        attempt = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts?restart=true`)
      }
      attemptRef.current = attempt

      const outcome = await api.post<VoiceSessionOutcome>('/missions/voice/sessions', {
        attemptId: attempt.attemptId,
        stepIndex: 0,
      })

      if (!outcome.isAvailable || !outcome.ticket) {
        setPhase('unavailable')
        setError(outcome.unavailable?.messageUz ?? copy.unavailable)
        releaseMicrophone()
        return
      }

      const ticket = outcome.ticket
      sessionIdRef.current = ticket.sessionId
      setSecondsLeft(ticket.maxDurationSeconds)

      const session = new LiveVoiceSession(
        ticket,
        {
          onStatus: setStatus,
          onConnected: () => {
            setPhase('live')
            void api
              .post('/missions/voice/sessions/connected', { sessionId: ticket.sessionId, connectMilliseconds: 0 })
              .catch(() => {})
          },
          onInputTranscript: (text) => {
            learnerRef.current += text
          },
          onOutputTranscript: (text) => {
            tutorRef.current += text
          },
          onTurnComplete: () => recordTurn(),
          onSilenceTimeout: () => {},
          onNoSpeech: () => {},
          onDropped: () => setError(copy.unavailable),
          onError: () => setError(copy.startFailed),
        },
        // A conversation, not a form: the microphone stays open for the whole scene and the
        // character can be interrupted mid-sentence.
        { continuous: true },
      )

      sessionRef.current = session
      await session.start()
    } catch (caught) {
      releaseMicrophone()
      setPhase('ready')
      setError(caught instanceof RequestError ? caught.message : copy.startFailed)
    }
  }

  function toggleMute() {
    const session = sessionRef.current
    if (!session) return

    if (muted) {
      session.resumeInput()
      setMuted(false)
    } else {
      session.pauseInput()
      setMuted(true)
    }
  }

  if (isLoading) return <Spinner />
  if (!mission?.dialogue) {
    navigate(`/missions/${missionId}`, { replace: true })
    return null
  }

  const orbState: OrbState = goalReached
    ? 'talking'
    : phase === 'live'
      ? ORB_STATE[status]
      : phase === 'connecting'
        ? 'thinking'
        : 'idle'

  const caption = goalReached
    ? copy.goalReached
    : phase === 'connecting'
      ? copy.connecting
      : phase === 'live'
        ? status === 'thinking'
          ? copy.thinking
          : status === 'listening'
            ? copy.listening
            : copy.talking
        : ''

  const started = phase === 'live' || phase === 'connecting' || phase === 'finishing'
  const lowOnTime = secondsLeft !== null && secondsLeft <= 30

  return (
    <div
      className="flex min-h-dvh flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      style={{
        // The character's own light, thrown from behind the sphere.
        background: `radial-gradient(115% 70% at 50% 18%, ${palette.light}24 0%, var(--color-ground-sunken) 58%)`,
      }}
    >
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => void finish()}
          className="-ml-1 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          <BackGlyph />
          {copy.leave}
        </button>

        {secondsLeft !== null && started && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-1.5 text-sm font-extrabold tabular-nums transition-colors ${
              lowOnTime
                ? 'border-caution/40 bg-caution-soft text-caution'
                : 'border-hairline bg-ground-raised/80 text-ink'
            }`}
            aria-label={fill(copy.timeLeft, { time: formatClock(secondsLeft) })}
          >
            <ClockGlyph />
            {formatClock(secondsLeft)}
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-7 py-6">
        <div className="relative grid place-items-center">
          <CharacterOrb
            colors={colors}
            agentState={orbState}
            manualInput={orbState === 'listening' ? 0.5 : 0.1}
            manualOutput={orbState === 'talking' ? 0.65 : 0.1}
            label={fill(copy.orbLabel, { character: name })}
          />
        </div>

        <div className="flex min-h-16 flex-col items-center gap-2 text-center">
          <p
            className={`text-xl font-extrabold tracking-tight transition-colors ${
              goalReached ? 'text-milestone' : 'text-ink'
            }`}
            aria-live="polite"
          >
            {caption || name}
          </p>

          {mission.dialogue.goalUz && !goalReached && (
            <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{mission.dialogue.goalUz}</p>
          )}
        </div>

        {/* How far through the scene, without putting the script on screen to be read. */}
        {beats.length > 0 && started && (
          <div
            className="flex items-center gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={beats.length}
            aria-valuenow={Math.min(beatIndex + 1, beats.length)}
            aria-label={fill(copy.beat, { current: Math.min(beatIndex + 1, beats.length), total: beats.length })}
          >
            {beats.map((beat, index) => (
              <span
                key={beat.order}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: index === beatIndex ? '1.75rem' : '0.5rem',
                  background: index <= beatIndex ? palette.light : 'var(--color-hairline)',
                }}
              />
            ))}
          </div>
        )}

        {/*
          * The lesson's own phrases, kept in reach while the learner speaks. The scene itself
          * stays off the screen — this is the vocabulary they were taught, not the script —
          * so someone who freezes mid-conversation has something to say rather than a silence
          * to explain.
          */}
        {phrases.length > 0 && started && (
          <section className="w-full max-w-md" aria-label={copy.phrases}>
            <p className="mb-2 text-center text-[11px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">
              {copy.phrases}
            </p>
            <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
              {phrases.map((phrase) => (
                <li
                  key={phrase.order}
                  className="flex items-baseline justify-between gap-3 rounded-xl bg-ground-sunken px-3 py-2"
                >
                  <span className="text-sm font-bold text-ink">{phrase.russian}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{phrase.uzbekMeaning}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <div className="w-full max-w-sm">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-center gap-3">
        {started ? (
          <>
            <Button variant="secondary" onClick={toggleMute} disabled={phase !== 'live'}>
              {muted ? copy.unmute : copy.mute}
            </Button>
            <Button onClick={() => void finish()} disabled={phase === 'finishing'}>
              {copy.finish}
            </Button>
          </>
        ) : (
          <Button size="lg" block className="max-w-sm" onClick={() => void connect()}>
            {t.missionBrief.start}
          </Button>
        )}
      </footer>
    </div>
  )
}

function formatClock(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  const rest = Math.max(0, seconds) % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

function ClockGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-none stroke-current stroke-2" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  )
}
