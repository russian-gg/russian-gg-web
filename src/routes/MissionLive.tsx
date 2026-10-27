import { useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { ChevronLeft, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { characterColors, characterName, characterPalette } from '../lib/character'
import { cx } from '../lib/cx'
import { foundationLessons } from '../lib/foundation-lessons'
import { pickContent } from '../lib/content'
import { fill, useLocale, useT } from '../lib/i18n'
import { LiveVoiceSession, releaseMicrophone, requestMicrophone } from '../lib/liveVoice'
import type { LiveFunctionDeclaration, LiveVoiceStatus } from '../lib/liveVoice'
import type { EntitlementView, MissionDetail, StartAttemptResponse, VoiceSessionOutcome } from '../lib/types'
import { CharacterOrb, type OrbState } from '../components/CharacterOrb'
import { Button, ErrorNote, QueryError, Spinner } from '../components/ui'
import { DailyLimitDialog, MicrophonePermissionDialog } from '../components/VoiceDialogs'
import {
  describeVoiceFailure,
  isMicrophonePermissionCode,
  microphonePermissionFailureCode,
  type MicrophonePermissionCode,
} from '../lib/voice-failure'
import { useFocusTrap } from '../lib/focus-trap'
import { backdrop, sheet } from '../lib/motion'

/**
 * `reconnecting` and `dropped` are a call that has started and lost its connection: the clock
 * stops in both, and `dropped` is the one where reconnecting has stopped trying by itself.
 */
type Phase = 'ready' | 'connecting' | 'live' | 'reconnecting' | 'dropped' | 'finishing' | 'unavailable'

/**
 * Automatic reconnects before the learner is asked. The server continues the same voice
 * session, so a reconnect does not spend a second slice of the daily allowance.
 */
const MAX_RECONNECTS = 2

/*
 * What the help buttons say to the character. Sent as the learner's text, so it never reaches
 * the transcript that is graded — only the character's answer to it is heard.
 */
const ASK_REPEAT = 'Повтори, пожалуйста, последнюю фразу медленнее и проще.'
const ASK_HINT =
  'Я не знаю, что ответить. Коротко подскажи по-узбекски, что от меня нужно, и дай пример фразы по-русски.'

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
    description:
      'The learner has just completed a learning goal of the mission themselves: they communicated what it requires, in their own words.',
    parameters: {
      type: 'OBJECT',
      properties: { step: { type: 'INTEGER', description: 'The number of the learning goal, starting at 1.' } },
      required: ['step'],
    },
  },
  {
    name: 'finish_mission',
    description:
      'Every learning goal that asks something of the learner is complete and the closing line has been said. Ends the conversation.',
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
  const { locale } = useLocale()
  const navigate = useNavigate()
  const { missionId } = useParams<{ missionId: string }>()

  const { data: mission, isLoading, isError, refetch } = useQuery({
    queryKey: ['mission-detail', missionId],
    queryFn: () => api.get<MissionDetail>(`/missions/${missionId}`),
    enabled: Boolean(missionId),
  })

  const [phase, setPhase] = useState<Phase>('ready')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const leaveRef = useFocusTrap<HTMLDivElement>(confirmLeave)
  const [status, setStatus] = useState<LiveVoiceStatus>('idle')
  const [beatIndex, setBeatIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [goalReached, setGoalReached] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** A note that is not a failure: nothing heard yet, or a reconnect under way. */
  const [hint, setHint] = useState<string | null>(null)
  /** The character's audio is playing. The connection's own status says "listening" throughout. */
  const [speaking, setSpeaking] = useState(false)
  const [inputLevel, setInputLevel] = useState(0)
  /** The character's latest line, shown only when the learner asks for it. */
  const [lastLine, setLastLine] = useState('')
  const [showLine, setShowLine] = useState(false)
  const [dailyLimit, setDailyLimit] = useState(false)
  const [micPermission, setMicPermission] = useState<MicrophonePermissionCode | null>(null)
  const [phrasesOpen, setPhrasesOpen] = useState(false)
  const phrasesPanelId = useId()
  const reconnectsRef = useRef(0)
  const phaseRef = useRef<Phase>('ready')
  /*
    Arriving from the brief's "Suhbatni boshlash" (Start the conversation) starts the call: the
    learner has just pressed start, and a second identical "start" screen was the fourth tap
    before anyone spoke. Opened any other way, the ready screen and its button stay.
  */
  const location = useLocation()
  const autostart = Boolean((location.state as { autostart?: boolean } | null)?.autostart)
  const autostarted = useRef(false)
  phaseRef.current = phase

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  const sessionRef = useRef<LiveVoiceSession | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const attemptRef = useRef<StartAttemptResponse | null>(null)
  const learnerRef = useRef('')
  const tutorRef = useRef('')
  const beatRef = useRef(0)
  /** Goals the character has reported done, by index. A set, because they come in any order. */
  const completedRef = useRef(new Set<number>())
  /** The character's line the learner is answering — what their answer is graded against. */
  const questionRef = useRef('')
  const finishRequestedRef = useRef(false)
  /**
   * The learner asked for a repeat or a hint. The character's answer to that is help, not the
   * line being answered, so it must not become what the next answer is graded against.
   */
  const askedRef = useRef(false)
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
      if (reply && !askedRef.current) questionRef.current = reply
      askedRef.current = false
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
      const step = Math.round(Number(args.step))
      if (!Number.isFinite(step) || step < 1 || step > beats.length) return

      /*
       * The conversation takes the goals in whatever order it likes, and one answer can close
       * several. Progress is therefore how many are done, not which one was reported last: the
       * bar used to jump to the reported step, so a later goal met first showed the scene as
       * nearly over and the earlier ones could never be shown at all.
       */
      const completed = completedRef.current
      completed.add(step - 1)
      const last = Math.max(beats.length - 1, 0)
      setBeatIndex(Math.min(completed.size, last))

      // Where an answer is assumed to belong when nothing in it says: the first goal still open.
      let open = 0
      while (open < last && completed.has(open)) open += 1
      beatRef.current = open
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

  const startOnArrival = useEffectEvent(() => void connect())
  useEffect(() => {
    if (!autostart || autostarted.current || !mission?.dialogue || phase !== 'ready') return
    autostarted.current = true
    // Spent once: going back and forward must not start a second call by itself.
    navigate(location.pathname, { replace: true, state: null })
    startOnArrival()
  }, [autostart, mission, phase, navigate, location.pathname, startOnArrival])

  async function connect() {
    if (!missionId) return
    setError(null)
    setHint(null)
    setPhase('connecting')

    try {
      // Kept inside the learner's tap: Android grants the microphone to a gesture, and a
      // billed session should never be opened before the browser has said yes.
      await requestMicrophone()
    } catch (caught) {
      setPhase('ready')
      // A refused microphone gets the dialog that says how to allow it on this device; other
      // failures say what they are, rather than "couldn't start".
      const permission = microphonePermissionFailureCode(caught)
      if (permission) setMicPermission(permission)
      else setError(describeVoiceFailure(caught, t, copy.startFailed))
      return
    }

    try {
      let attempt = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts`)
      if (attempt.requiresExplicitRestart) {
        attempt = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts?restart=true`)
      }
      attemptRef.current = attempt
      reconnectsRef.current = 0

      await openSession(attempt)
    } catch (caught) {
      // A session that failed half-way still holds the microphone it opened. Closing it hands
      // that back; without this the recording indicator stayed lit until the tab was closed.
      const started = sessionRef.current
      sessionRef.current = null
      await started?.close().catch(() => {})

      releaseMicrophone()
      setPhase('ready')
      setError(describeVoiceFailure(caught, t, copy.startFailed))
    }
  }

  /**
   * Continues a call whose connection dropped. Twice on its own; after that the learner
   * chooses between trying again and finishing with what they have said so far, instead of
   * a clock and a sphere carrying on over a dead line.
   */
  async function reconnect() {
    if (finishingRef.current || !attemptRef.current) return

    const dropped = sessionRef.current
    sessionRef.current = null
    setSpeaking(false)
    await dropped?.close().catch(() => {})

    if (reconnectsRef.current >= MAX_RECONNECTS) {
      setHint(null)
      setPhase('dropped')
      return
    }

    reconnectsRef.current += 1
    setError(null)
    setHint(t.player.reconnecting)
    setPhase('reconnecting')

    try {
      await requestMicrophone()
      await openSession(attemptRef.current)
    } catch (caught) {
      // Assigned inside openSession, which the narrowing above cannot see.
      const started = sessionRef.current as LiveVoiceSession | null
      sessionRef.current = null
      await started?.close().catch(() => {})
      setHint(null)
      setError(describeVoiceFailure(caught, t, t.voiceErrors.connect_failed))
      setPhase('dropped')
    }
  }

  /** Asks the server for a voice ticket for the attempt and opens the conversation on it. */
  async function openSession(attempt: StartAttemptResponse) {
    const outcome = await api.post<VoiceSessionOutcome>('/missions/voice/sessions', {
      attemptId: attempt.attemptId,
      stepIndex: beatRef.current,
    })

    if (!outcome.isAvailable || !outcome.ticket) {
      releaseMicrophone()
      setHint(null)
      const isDailyLimit = outcome.unavailable?.reason === 'daily_limit'
      // Mid-call, what was said so far can still be graded; before it, there is nothing to.
      const midCall = turnsRef.current.length > 0 || phaseRef.current === 'reconnecting'
      if (isDailyLimit) {
        // The dialog says what the limit is and, for a free learner, how to lift it.
        setDailyLimit(true)
        setError(null)
      } else {
        setError(outcome.unavailable?.messageUz ?? copy.unavailable)
      }
      setPhase(midCall ? 'dropped' : 'unavailable')
      return
    }

    const ticket = outcome.ticket
    sessionIdRef.current = ticket.sessionId
    // A reconnect's ticket covers what is left of the call; the clock never runs backwards.
    setSecondsLeft((left) => (left === null ? ticket.maxDurationSeconds : Math.min(left, ticket.maxDurationSeconds)))

    const session = new LiveVoiceSession(
      ticket,
      {
        // The character's voice, not the connection's status, says whose turn it is: the
        // microphone stays open while the character talks, so the status read "listening"
        // over every one of its lines and the screen told the learner to speak.
        onPlayback: (playing) => setSpeaking(playing),
        onInputLevel: (rms, isSpeech) => {
          setInputLevel(isSpeech ? Math.round(Math.min(1, rms * 12) * 10) / 10 : 0)
          if (isSpeech) setHint((current) => (current === t.player.noSpeechHint ? null : current))
        },
        onStatus: (next) => {
          setStatus(next)
          // A new listening turn: whatever the character said since the last exchange — the
          // opening, above all — is the line the learner is about to answer.
          if (next === 'listening' && tutorRef.current.trim() && !askedRef.current) {
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
          if (text.trim()) setLastLine(text.trim())
        },
        onTurnComplete: () => recordTurn(),
        onToolCall: handleToolCall,
        // The session ends turns on its own in a continuous call; this is for turn-gated use.
        onSilenceTimeout: () => {},
        // A hint, not an error: the call is fine and still listening, but nothing has been
        // heard — most often a muted or wrong input device.
        onNoSpeech: () => setHint(t.player.noSpeechHint),
        onDropped: () => void reconnect(),
        onError: (code) => {
          if (isMicrophonePermissionCode(code)) setMicPermission(code)
          else setError(t.voiceErrors[code])
          // Before the call opened there is nothing to keep: back to the start button.
          if (phaseRef.current === 'connecting') {
            releaseMicrophone()
            setPhase('ready')
          }
        },
      },
      // A conversation, not a form: the microphone stays open for the whole scene and the
      // character can be interrupted mid-sentence.
      { continuous: true, tools: MISSION_TOOLS },
    )

    sessionRef.current = session
    await session.start()
  }

  /** Repeat or hint: asks the character, in the learner's place, for help with the scene. */
  function askCharacter(text: string) {
    const asked = sessionRef.current?.requestTutorResponse(text) ?? false
    if (asked) {
      askedRef.current = true
      setHint(null)
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
      ? speaking
        ? 'talking'
        : ORB_STATE[status]
      : phase === 'connecting' || phase === 'reconnecting'
        ? 'thinking'
        : 'idle'

  const caption = goalReached
    ? copy.goalReached
    : phase === 'connecting'
      ? copy.connecting
      : phase === 'reconnecting'
        ? t.player.reconnecting
        : phase === 'dropped'
          ? copy.dropped
          : phase === 'live'
            ? speaking
              ? copy.talking
              : muted
                ? t.player.microphonePaused
                : status === 'thinking'
                  ? copy.thinking
                  : status === 'listening'
                    ? copy.listening
                    : copy.talking
            : ''

  const started =
    phase === 'live' || phase === 'connecting' || phase === 'reconnecting' || phase === 'dropped' || phase === 'finishing'
  // Help is for a call that is running and waiting on the learner, not one mid-sentence.
  const canAsk = phase === 'live' && !speaking && !muted && !goalReached
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
        {/*
          Leaving a conversation that has started is not a back button: it ends the call, grades
          what was said and uses one of the attempts before a cooldown. So it asks first, with
          staying as the main choice. Before the call starts there is nothing to lose.
        */}
        <button
          type="button"
          onClick={() =>
            phase === 'live' || phase === 'connecting' || phase === 'reconnecting' || phase === 'dropped'
              ? setConfirmLeave(true)
              : phase === 'finishing'
                ? undefined
                : navigate(`/missions/${missionId}`, { replace: true })
          }
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
              {fill(copy.phrasesTab, { count: helpers.length })}
            </span>
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-7 py-6">
        <div className="relative grid place-items-center">
          <CharacterOrb
            colors={colors}
            agentState={orbState}
            // The learner's own voice moves the sphere, so they can see they are being heard.
            manualInput={orbState === 'listening' ? Math.max(0.15, inputLevel) : 0.1}
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
            <p className="max-w-sm text-sm leading-relaxed text-ink-muted">
              {pickContent(locale, {
                uz: mission.dialogue.goalUz,
                ru: mission.dialogue.goalRu,
                en: mission.summary.objectiveEn,
              })}
            </p>
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

        {/* The character's last line in text, for a learner who did not catch it. */}
        {showLine && lastLine && phase === 'live' && (
          <div className="w-full max-w-sm rounded-2xl border border-hairline bg-ground-raised/90 px-4 py-3 text-left">
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">{name}</p>
            <p lang="ru" className="mt-1 text-base leading-snug text-ink">
              {lastLine}
            </p>
          </div>
        )}

        {phase === 'live' && !goalReached && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" size="sm" disabled={!canAsk} onClick={() => askCharacter(ASK_REPEAT)}>
              {copy.repeat}
            </Button>
            <Button variant="secondary" size="sm" disabled={!canAsk} onClick={() => askCharacter(ASK_HINT)}>
              {copy.help}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!lastLine}
              aria-pressed={showLine}
              onClick={() => setShowLine((shown) => !shown)}
            >
              {showLine ? copy.hideLine : copy.showLine}
            </Button>
          </div>
        )}

        {hint && (
          <p role="status" className="max-w-sm text-center text-sm leading-relaxed font-semibold text-caution">
            {hint}
          </p>
        )}

        {phase === 'dropped' && (
          <div role="alert" className="w-full max-w-sm rounded-2xl border border-danger/30 bg-danger-soft px-4 py-4 text-center">
            <p className="text-base font-extrabold text-ink">{copy.dropped}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{copy.droppedBody}</p>
            <div className="mt-4 flex flex-col gap-2">
              {!dailyLimit && (
                <Button
                  block
                  onClick={() => {
                    reconnectsRef.current = 0
                    void reconnect()
                  }}
                >
                  {copy.reconnect}
                </Button>
              )}
              <Button variant="secondary" block onClick={() => void finish()}>
                {copy.finishAndSee}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="w-full max-w-sm">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-3">
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
        ) : phase === 'unavailable' ? (
          // Starting again would fail the same way. Back to the mission, where the learner
          // can choose something else.
          <Button size="lg" block variant="secondary" className="max-w-sm" onClick={() => navigate(`/missions/${missionId}`, { replace: true })}>
            {copy.backToMission}
          </Button>
        ) : (
          <Button size="lg" block className="max-w-sm" onClick={() => void connect()}>
            {t.missionBrief.start}
          </Button>
        )}
      </footer>

      {dailyLimit && (
        <DailyLimitDialog
          isPro={Boolean(entitlement?.hasProAccess)}
          onDismiss={() => setDailyLimit(false)}
          onBuy={() => {
            setDailyLimit(false)
            navigate('/paywall')
          }}
        />
      )}

      {micPermission && (
        <MicrophonePermissionDialog
          busy={false}
          onRetry={() => {
            setMicPermission(null)
            void connect()
          }}
          onDismiss={() => setMicPermission(null)}
        />
      )}

      <AnimatePresence>
        {confirmLeave && (
          <m.div
            key="leave"
            ref={leaveRef}
            tabIndex={-1}
            variants={backdrop}
            initial="hidden"
            animate="shown"
            exit="exit"
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mission-leave-title"
            onClick={() => setConfirmLeave(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setConfirmLeave(false)
            }}
          >
            <m.div
              variants={sheet}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm rounded-[var(--radius-card)] border border-hairline bg-ground-raised p-6 shadow-2xl"
            >
              <h2 id="mission-leave-title" className="text-lg font-extrabold text-ink">
                {copy.leaveTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{copy.leaveBody}</p>
              <Button block className="mt-5" onClick={() => setConfirmLeave(false)}>
                {copy.leaveStay}
              </Button>
              <Button
                variant="secondary"
                block
                className="mt-2"
                onClick={() => {
                  setConfirmLeave(false)
                  void finish()
                }}
              >
                {copy.leaveConfirm}
              </Button>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
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
