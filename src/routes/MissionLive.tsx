import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api, RequestError } from '../lib/api'
import { characterColors, characterName, characterPalette } from '../lib/character'
import { cx } from '../lib/cx'
import { foundationLessons } from '../lib/foundation-lessons'
import { fill, useT } from '../lib/i18n'
import { LiveVoiceSession, releaseMicrophone, requestMicrophone } from '../lib/liveVoice'
import type { LiveFunctionDeclaration, LiveVoiceStatus } from '../lib/liveVoice'
import type { MissionDetail, StartAttemptResponse, VoiceSessionOutcome } from '../lib/types'
import { CharacterOrb, type OrbState } from '../components/CharacterOrb'
import { Button, ErrorNote, QueryError, Spinner } from '../components/ui'

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
 * How the character reports what the conversation has achieved.
 *
 * The screen used to decide that itself by counting: four things said to a four-step scene and
 * the mission closed and was graded — wrong answers, a half sentence and an off-topic remark
 * counted the same as right ones. Only the character hears whether an answer was right, so it
 * is the one that moves the scene on and ends it. The clock and the finish button still stop
 * the conversation whatever the character does.
 */
const MISSION_TOOLS: LiveFunctionDeclaration[] = [
  {
    name: 'step_completed',
    description: 'The learner has just correctly said the answer this step of the scene was waiting for.',
    parameters: {
      type: 'OBJECT',
      properties: { step: { type: 'INTEGER', description: 'The step number, starting at 1.' } },
      required: ['step'],
    },
  },
  {
    name: 'finish_mission',
    description: 'Every step of the scene is complete and the closing line has been said. Ends the conversation.',
  },
]

/** Long enough for the character's closing line to finish playing before the screen changes. */
const CLOSING_LINE_MS = 3500

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

  const { data: mission, isLoading, isError, refetch } = useQuery({
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
  const [phrasesOpen, setPhrasesOpen] = useState(false)
  const phrasesPanelId = useId()

  const sessionRef = useRef<LiveVoiceSession | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const attemptRef = useRef<StartAttemptResponse | null>(null)
  const learnerRef = useRef('')
  const tutorRef = useRef('')
  const beatRef = useRef(0)
  /** The character's line the learner is answering — what their answer is graded against. */
  const questionRef = useRef('')
  const finishRequestedRef = useRef(false)
  const finishingRef = useRef(false)
  /** Every exchange as it happened, handed to the server when the conversation ends. */
  const turnsRef = useRef<{ stepIndex: number; learnerTranscript: string; tutorTranscript: string | null }[]>([])

  const beats = mission?.dialogue?.beats ?? []
  /*
   * The phrases the lesson itself taught, which is what the learner has actually been given to
   * say. The mission's own target phrases are a two-to-five line summary of the scene, so a
   * learner who froze found almost nothing to reach for; the lesson day behind the mission
   * carries the full set.
   */
  const helpers = useMemo(() => {
    const day = mission?.summary.courseDay ?? dayFromSlug(mission?.summary.slug)
    const lesson = day === null ? undefined : foundationLessons[day]

    if (lesson) {
      return lesson.phrases.map((phrase) => ({ ru: phrase.ru, uz: phrase.uz, hint: phrase.pronunciation }))
    }

    return (mission?.targetPhrases ?? []).map((phrase) => ({
      ru: phrase.russian,
      uz: phrase.uzbekMeaning,
      hint: phrase.transliteration ?? undefined,
    }))
  }, [mission])
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
    const reply = tutorRef.current.trim()
    tutorRef.current = ''

    // The character spoke but the learner has not answered yet — that is the tutor's own turn,
    // not an exchange, and it is the line the learner will be answering next.
    if (!attemptRef.current || spoken.length === 0) {
      if (reply) questionRef.current = reply
      void listenAgain()
      return
    }

    /*
     * Graded against the line it answered. The reply that follows is the character reacting to
     * it — praise, or a correction — and grading against that is how a right answer to "как вас
     * зовут?" was marked against "где вы живёте?". The step is only the conversation's position;
     * the server works out the beat from the two lines themselves.
     */
    turnsRef.current.push({
      stepIndex: beatRef.current,
      learnerTranscript: spoken,
      tutorTranscript: questionRef.current || null,
    })
    if (reply) questionRef.current = reply

    // Wrong answers, retries and detours do not move the scene or end it: the character reports
    // each step it heard done (step_completed) and the end of the scene (finish_mission).
    if (finishRequestedRef.current) return

    void listenAgain()
  }

  /** The character's own report of what the conversation has achieved. See MISSION_TOOLS. */
  function handleToolCall(name: string, args: Record<string, unknown>) {
    if (name === 'step_completed') {
      const step = Number(args.step)
      if (!Number.isFinite(step) || step < 1) return

      // Steps are numbered from one, so the step just completed is also the index of the next.
      const next = Math.min(Math.round(step), Math.max(beats.length - 1, 0))
      if (next > beatRef.current) {
        beatRef.current = next
        setBeatIndex(next)
      }
      return
    }

    if (name === 'finish_mission' && !finishRequestedRef.current) {
      finishRequestedRef.current = true
      beatRef.current = Math.max(beats.length - 1, 0)
      setBeatIndex(beatRef.current)
      setGoalReached(true)
      window.setTimeout(() => void finish(), CLOSING_LINE_MS)
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

      const session = new LiveVoiceSession(
        ticket,
        {
          onStatus: (next) => {
            setStatus(next)
            // A new listening turn: whatever the character said since the last exchange — the
            // opening, above all — is the line the learner is about to answer.
            if (next === 'listening' && tutorRef.current.trim()) {
              questionRef.current = tutorRef.current.trim()
              tutorRef.current = ''
            }
          },
          onConnected: () => {
            setPhase('live')
            void api
              .post('/missions/voice/sessions/connected', { sessionId: ticket.sessionId, connectMilliseconds: 0 })
              .catch(() => {})
          },
          // Both arrive as the whole turn so far, not as the latest piece. Appending them wrote
          // every answer out several times over ("Меня Меня зовут Меня зовут Али"), and that
          // is what was graded.
          onInputTranscript: (text) => {
            learnerRef.current = text
          },
          onOutputTranscript: (text) => {
            tutorRef.current = text
          },
          onTurnComplete: () => recordTurn(),
          onToolCall: handleToolCall,
          onSilenceTimeout: () => {},
          onNoSpeech: () => {},
          onDropped: () => setError(copy.unavailable),
          onError: () => setError(copy.startFailed),
        },
        // A conversation, not a form: the microphone stays open for the whole scene and the
        // character can be interrupted mid-sentence.
        { continuous: true, tools: MISSION_TOOLS },
      )

      sessionRef.current = session
      await session.start()
    } catch (caught) {
      // A session that failed half-way still holds the microphone it opened. Closing it hands
      // that back; without this the recording indicator stayed lit until the tab was closed.
      const started = sessionRef.current
      sessionRef.current = null
      await started?.close().catch(() => {})

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
  if (isError || !mission) return <QueryError onRetry={() => void refetch()} />
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

      {/*
        * The lesson's own phrases, parked against the right edge and pulled out when the learner
        * wants them. A drawer rather than a strip across the screen: this is something reached
        * for mid-sentence and then pushed away again, and anything permanently on screen next to
        * the sphere competes with the conversation. The scene's own script stays hidden — these
        * are the phrases the lesson taught, not the answers.
        */}
      {helpers.length > 0 && started && (
        <div className="pointer-events-none fixed inset-y-0 right-0 z-20 flex items-center">
          <aside
            id={phrasesPanelId}
            aria-label={copy.phrases}
            aria-hidden={!phrasesOpen}
            // Width, not height: the drawer opens sideways, so the sphere never moves.
            className={cx(
              'pointer-events-auto overflow-hidden transition-[width,opacity] duration-300 ease-out',
              phrasesOpen ? 'w-[min(20rem,78vw)] opacity-100' : 'w-0 opacity-0',
            )}
          >
            <div className="flex h-[min(70vh,34rem)] w-[min(20rem,78vw)] flex-col rounded-l-3xl border border-r-0 border-hairline bg-ground-raised/95 shadow-[0_18px_50px_-24px_rgb(17_24_39/0.55)] backdrop-blur-sm">
              <p className="px-4 pt-4 pb-2 text-[11px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">
                {copy.phrases}
              </p>
              <ul className="flex flex-col gap-1.5 overflow-y-auto px-3 pb-4">
                {helpers.map((helper) => (
                  <li key={helper.ru} className="rounded-2xl bg-ground-sunken px-3.5 py-2.5">
                    <p className="text-sm leading-snug font-bold text-ink">{helper.ru}</p>
                    {helper.hint && (
                      <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">{helper.hint}</p>
                    )}
                    <p className="mt-1 text-xs leading-snug text-ink-muted">{helper.uz}</p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <button
            type="button"
            onClick={() => setPhrasesOpen((open) => !open)}
            aria-expanded={phrasesOpen}
            aria-controls={phrasesPanelId}
            aria-label={copy.phrases}
            className="pointer-events-auto flex items-center gap-1.5 rounded-l-2xl border border-r-0 border-hairline bg-ground-raised/95 py-4 pr-1.5 pl-2 shadow-[0_10px_30px_-18px_rgb(17_24_39/0.6)] transition-colors hover:bg-ground-raised"
          >
            <ChevronGlyph open={phrasesOpen} />
            <span className="text-[11px] font-extrabold text-ink-muted [writing-mode:vertical-rl]">
              {helpers.length}
            </span>
          </button>
        </div>
      )}

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
            {/*
              * Finishing is not instant — the conversation is handed over and graded — so the
              * button says so rather than sitting there looking ignored.
              */}
            <Button onClick={() => void finish()} disabled={phase === 'finishing'}>
              {phase === 'finishing' ? (
                <span className="inline-flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {copy.finishing}
                </span>
              ) : (
                copy.finish
              )}
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

/** Points at the drawer: left when it is closed and there is more to pull out, right when open. */
function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <ChevronLeft
      aria-hidden="true"
      strokeWidth={2.5}
      className={cx('size-4 text-ink-muted transition-transform duration-300', open && 'rotate-180')}
    />
  )
}

/** Practice-library missions carry their lesson in the slug: "practice-day-03-…". */
function dayFromSlug(slug: string | undefined) {
  const match = slug?.match(/day-(\d+)/)

  return match ? Number(match[1]) : null
}

function formatClock(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  const rest = Math.max(0, seconds) % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function BackGlyph() {
  return (
    <ChevronLeft aria-hidden="true" strokeWidth={2} className="size-4" />
  )
}

function ClockGlyph() {
  return (
    <Clock aria-hidden="true" strokeWidth={2} className="size-3.5" />
  )
}
