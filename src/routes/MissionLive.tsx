import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { characterColors, characterName } from '../lib/character'
import { fill, useT } from '../lib/i18n'
import { LiveVoiceSession, releaseMicrophone, requestMicrophone } from '../lib/liveVoice'
import type { LiveVoiceStatus } from '../lib/liveVoice'
import type {
  MissionDetail,
  StartAttemptResponse,
  TurnFeedback,
  VoiceSessionOutcome,
} from '../lib/types'
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

  const beats = mission?.dialogue?.beats ?? []
  const character = mission?.dialogue?.character ?? 'None'
  const colors = characterColors(character)
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

  /** One answer: scored against the beat it belongs to, which is what moves the scene on. */
  async function submitTurn() {
    const attempt = attemptRef.current
    const spoken = learnerRef.current.trim()
    learnerRef.current = ''
    const tutor = tutorRef.current.trim()
    tutorRef.current = ''

    if (!attempt || spoken.length === 0) return

    try {
      const feedback = await api.post<TurnFeedback>('/missions/attempts/turns', {
        attemptId: attempt.attemptId,
        stepIndex: beatRef.current,
        learnerTranscript: spoken,
        tutorTranscript: tutor || null,
        isRetry: false,
      })

      const next = Math.min(feedback.nextStepIndex, Math.max(beats.length - 1, 0))
      beatRef.current = next
      setBeatIndex(next)

      if (feedback.goalReached) {
        setGoalReached(true)
        // Let the character finish its closing line before the screen changes.
        window.setTimeout(() => void finish(), 1600)
      }
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : copy.startFailed)
    }
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

      const session = new LiveVoiceSession(ticket, {
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
        onTurnComplete: () => void submitTurn(),
        onSilenceTimeout: () => {},
        onNoSpeech: () => {},
        onDropped: () => setError(copy.unavailable),
        onError: () => setError(copy.startFailed),
      })

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
        : copy.listening

  return (
    <div className="flex min-h-dvh flex-col bg-ground-sunken px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => void finish()} className="text-sm font-semibold text-ink-muted">
          {copy.leave}
        </button>
        {secondsLeft !== null && (
          <span className="text-sm font-bold tabular-nums text-ink">
            {fill(copy.timeLeft, { time: formatClock(secondsLeft) })}
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <CharacterOrb
          colors={colors}
          agentState={orbState}
          manualInput={orbState === 'listening' ? 0.5 : 0.1}
          manualOutput={orbState === 'talking' ? 0.65 : 0.1}
          label={fill(copy.orbLabel, { character: name })}
        />

        <p className="text-lg font-extrabold text-ink" aria-live="polite">
          {caption}
        </p>

        {mission.dialogue.goalUz && (
          <p className="max-w-sm text-center text-sm text-ink-muted">{mission.dialogue.goalUz}</p>
        )}

        {beats.length > 0 && (
          <p className="text-xs font-bold tracking-[0.14em] text-ink-faint uppercase">
            {fill(copy.beat, { current: Math.min(beatIndex + 1, beats.length), total: beats.length })}
          </p>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}
      </div>

      <footer className="flex items-center justify-center gap-3 pb-[env(safe-area-inset-bottom)]">
        {phase === 'ready' || phase === 'unavailable' ? (
          <Button size="lg" onClick={() => void connect()} disabled={phase === 'unavailable'}>
            {copy.listening}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={toggleMute} disabled={phase !== 'live'}>
              {muted ? copy.unmute : copy.mute}
            </Button>
            <Button onClick={() => void finish()} disabled={phase === 'finishing'}>
              {copy.finish}
            </Button>
          </>
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
