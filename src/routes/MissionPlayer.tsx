import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, RequestError, track } from '../lib/api'
import { cx } from '../lib/cx'
import { pickContent } from '../lib/content'
import { fill, useLocale, useT, type Dictionary } from '../lib/i18n'
import {
  LiveVoiceSession,
  VoiceError,
  isPromptAudioPlaying,
  playPromptAudio,
  releaseMicrophone,
  requestMicrophone,
  stopPromptAudio,
} from '../lib/liveVoice'
import type {
  MissionDetail,
  StartAttemptResponse,
  TurnFeedback,
  VoiceSessionOutcome,
} from '../lib/types'
import { VoiceBadge, VoiceSignal, type VoiceState } from '../components/VoiceSignal'
import {
  Badge,
  Button,
  ErrorNote,
  PauseGlyph,
  PlayGlyph,
  ProgressBar,
  Spinner,
  UzHint,
} from '../components/ui'

/**
 * Answers on one step before the learner is offered a way past it. Three is enough to get
 * it right after a correction and few enough that nobody grinds; the way past is always
 * offered, never taken automatically.
 */
const MAX_STEP_ATTEMPTS = 3

/**
 * Reconnects allowed on one step before the lesson stops trying. Live connections drop —
 * a tunnel, a switch from wifi to mobile — and losing the lesson to one of those was worse
 * than the drop itself. Bounded, because a connection that keeps dropping is not coming back.
 */
const MAX_RECONNECTS = 2

/**
 * The focused mission player (PRD §6). One objective, one Russian prompt with Uzbek
 * support, one high-emphasis action to answer by voice, and step progress at the bottom.
 * Built from hairlines and whitespace rather than stacked cards. Detailed scoring is
 * deliberately withheld until the mission ends.
 */
export function MissionPlayer() {
  const t = useT()
  const { locale } = useLocale()
  const { missionId = '' } = useParams()
  const navigate = useNavigate()

  const [attempt, setAttempt] = useState<StartAttemptResponse | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState<TurnFeedback | null>(null)
  const [degraded, setDegraded] = useState<string | null>(null)
  const [assistantReply, setAssistantReply] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [promptAudioState, setPromptAudioState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const [promptAudioTextKey, setPromptAudioTextKey] = useState<string | null>(null)
  const [voiceComposerOpen, setVoiceComposerOpen] = useState(false)
  const [hasLiveSession, setHasLiveSession] = useState(false)
  // Turns already closed. The live transcript and reply stay in their own state and are
  // folded in here when the step ends, so the thread grows instead of resetting each step.
  const [history, setHistory] = useState<ChatMessage[]>([])
  // Latched once the provider answers 503: the lesson keeps working without audio.
  const [ttsUnavailable, setTtsUnavailable] = useState(false)
  const liveSessionRef = useRef<LiveVoiceSession | null>(null)
  const liveSessionIdRef = useRef<string | null>(null)
  const currentStepRef = useRef(0)
  const transcriptRef = useRef('')
  const assistantReplyRef = useRef<string | null>(null)
  const submittingTurnRef = useRef(false)
  const latestTurnPassedRef = useRef(false)
  const latestTurnScoreRef = useRef<number | null>(null)
  const manualStopRequestedRef = useRef(false)
  const totalStepsRef = useRef(1)
  // Answers given on the step in front of the learner, whether or not they passed.
  const stepAttemptsRef = useRef(0)
  const reconnectsRef = useRef(0)
  // Reached the attempt cap on this step: the choice is now retry or move on, not the mic.
  const [stepExhausted, setStepExhausted] = useState(false)
  // Said under the microphone when nothing is being heard. Not an error state.
  const [micHint, setMicHint] = useState<string | null>(null)
  // What the server actually granted this session, counted down. Null when nothing is live.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  // Mirrors latestTurnPassedRef as state: a ref cannot re-render, so the status line
  // never told the learner their answer had been accepted.
  const [turnAccepted, setTurnAccepted] = useState(false)

  const {
    data: mission,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['mission', missionId],
    queryFn: () => api.get<MissionDetail>(`/missions/${missionId}`),
    retry: false,
  })

  useEffect(() => {
    if (!mission) return

    void (async () => {
      try {
        const started = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts`)
        setAttempt(started)
        // Resuming lands the learner on the step they left, not back at the beginning.
        setStepIndex(Math.max(0, started.currentStepIndex))
      } catch (caught) {
        setError(caught instanceof RequestError ? caught.message : t.player.openFailed)
      }
    })()
  }, [mission, missionId, t])

  useEffect(() => {
    currentStepRef.current = stepIndex
  }, [stepIndex])

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  useEffect(() => {
    assistantReplyRef.current = assistantReply
  }, [assistantReply])

  /**
   * Leaving the lesson has to close the session on the server, not just locally. An open
   * session holds its whole cap against the daily allowance, so a learner who pressed back
   * twice used to lose the rest of their day of speaking. This covers the two ways out:
   * navigating away (unmount) and the tab going away (pagehide).
   */
  useEffect(() => {
    function releaseSession(reason: string) {
      // Unconditional: the press opens the microphone before the session exists, so leaving
      // mid-connect would otherwise leave it open with nothing holding it.
      releaseMicrophone()

      const liveSession = liveSessionRef.current
      const sessionId = liveSessionIdRef.current
      if (!liveSession || !sessionId) return

      liveSessionRef.current = null
      liveSessionIdRef.current = null
      // The page can come back from the back/forward cache after pagehide; it must not
      // return showing a live session that was closed while it was away.
      setHasLiveSession(false)
      setSecondsLeft(null)
      setVoiceState('idle')

      api.postOnExit('/missions/voice/sessions/end', {
        sessionId,
        elapsedSeconds: liveSession.elapsedSeconds,
        lastStepIndex: currentStepRef.current,
        completed: false,
        failureReason: reason,
      })

      void liveSession.close()
    }

    const onPageHide = () => releaseSession('page_hidden')
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.removeEventListener('pagehide', onPageHide)
      stopPromptAudio()
      setPromptAudioState('idle')
      setPromptAudioTextKey(null)
      releaseSession('left_lesson')
    }
  }, [])

  /**
   * The session's own clock. The server caps every session and clamps what it is billed, but
   * nothing here ever stopped talking — so a session could run past its allowance against the
   * provider, and the learner had no idea how much was left until it ended underneath them.
   */
  useEffect(() => {
    if (!hasLiveSession || secondsLeft === null) return

    if (secondsLeft <= 0) {
      void stopVoice()
      return
    }

    const timer = window.setTimeout(() => setSecondsLeft((left) => (left ?? 1) - 1), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLiveSession, secondsLeft])

  useEffect(() => {
    if (!mission || !feedback || !Array.isArray(mission.steps) || mission.steps.length === 0) {
      return
    }

    const onLastStep = stepIndex >= mission.steps.length - 1
    if (!onLastStep || feedback.score < 70) {
      return
    }

    setAssistantReply(
      "Zo'r aytdingiz. Bo'ldi, bugungi joyini chiroyli yopdik, endi keyingisida yana ko'rishamiz.",
    )
    const timer = window.setTimeout(() => {
      void complete()
    }, 1800)

    return () => window.clearTimeout(timer)
  }, [feedback, mission, stepIndex])

  if (isLoading) return <Spinner />

  if (loadError instanceof RequestError && loadError.isPaywall) {
    navigate('/paywall', { replace: true })
    return <Spinner />
  }

  if (!mission) return <ErrorNote>{t.player.notFound}</ErrorNote>
  if (
    !mission.summary ||
    !Array.isArray(mission.steps) ||
    !Array.isArray(mission.targetPhrases) ||
    mission.steps.length === 0
  ) {
    return (
      <ErrorNote>{t.player.incomplete}</ErrorNote>
    )
  }
  const currentMission = mission
  const summary = {
    ...currentMission.summary,
    category: currentMission.summary.category ?? 'Social',
    phase: currentMission.summary.phase ?? 'Foundation',
    targetLevel: currentMission.summary.targetLevel ?? 'A0',
    formality: currentMission.summary.formality ?? 'Neutral',
    workplaceUse: currentMission.summary.workplaceUse ?? 'Safe',
    titleUz: currentMission.summary.titleUz ?? 'Mashq',
    titleRu: currentMission.summary.titleRu ?? 'Упражнение',
    objectiveUz: currentMission.summary.objectiveUz ?? '',
  }
  const safePhrases = currentMission.targetPhrases.filter(
    (phrase): phrase is NonNullable<(typeof currentMission.targetPhrases)[number]> =>
      Boolean(phrase && phrase.russian),
  )
  const safeSteps = currentMission.steps.filter(
    (item): item is NonNullable<(typeof currentMission.steps)[number]> => Boolean(item),
  )
  const step = safeSteps[stepIndex]
  const nextStep = safeSteps[stepIndex + 1]
  const totalSteps = safeSteps.length
  const isLastStep = stepIndex >= totalSteps - 1
  const safeStep = step ?? safeSteps[Math.max(0, Math.min(stepIndex, totalSteps - 1))]
  totalStepsRef.current = totalSteps
  /*
   * The single definition of progress on this screen. The footer used to count the step the
   * learner was *standing on* while the checklist counted the ones they had *finished*, so a
   * half-done last step read as "5 / 5 qadam" next to "4 / 5".
   */
  const completedSteps = Math.min(stepIndex + (turnAccepted ? 1 : 0), totalSteps)
  const promptAudioText =
    safeStep?.kind === 'PhraseIntro'
      ? safePhrases.map((phrase) => phrase.russian).join('. ')
      : safeStep?.promptRu ?? summary.titleRu

  function handleListen(text: string) {
    const normalized = text.trim()
    setError(null)
    if (isPromptAudioPlaying(normalized)) {
      stopPromptAudio()
      setPromptAudioState('idle')
      setPromptAudioTextKey(null)
      return
    }

    setPromptAudioTextKey(normalized)
    void playPromptAudio(normalized, {
      onStateChange: (state) => {
        setPromptAudioState(state)
        if (state === 'idle') {
          setPromptAudioTextKey(null)
        }
      },
    }).catch((caught) => {
      setPromptAudioState('idle')
      setPromptAudioTextKey(null)

      /*
       * A trace id is not an answer. The provider being unavailable is a state the lesson
       * carries on through — reading and speaking still work — so it is said once, in Uzbek,
       * and the play controls stop offering something that cannot happen.
       */
      if (caught instanceof RequestError && (caught.status === 503 || caught.status >= 500)) {
        setTtsUnavailable(true)
        return
      }

      setError(t.player.ttsFailed)
    })
  }

  const needsRegisterLabel =
    summary.category === 'StreetRussian' ||
    summary.formality === 'Informal' ||
    summary.formality === 'Slang' ||
    summary.workplaceUse !== 'Safe'

  async function startVoice() {
    if (!attempt) return

    setBusy(true)
    setError(null)
    setDegraded(null)
    setAssistantReply(null)
    setTranscript('')
    setFeedback(null)
    latestTurnPassedRef.current = false
    latestTurnScoreRef.current = null
    setTurnAccepted(false)
    manualStopRequestedRef.current = false
    setVoiceState('thinking')

    // Measured from the press, not from the socket: the learner is waiting for all of it.
    const pressedAt = Date.now()

    /*
     * Started here, on the press itself, so the permission prompt runs alongside the round
     * trip that mints the session rather than after it. It is deliberately not awaited — the
     * session picks up the same request, and a rejection surfaces there.
     */
    void requestMicrophone().catch(() => {})

    try {
      const outcome = await api.post<VoiceSessionOutcome>('/missions/voice/sessions', {
        attemptId: attempt.attemptId,
        stepIndex,
      })

      if (!outcome.isAvailable) {
        // An honest degraded state, not a silent failure (PRD §11).
        setDegraded(outcome.unavailable?.messageUz ?? t.voiceErrors.connect_failed)
        setVoiceComposerOpen(true)
        setVoiceState('unavailable')
        return
      }

      if (!outcome.ticket) {
        throw new VoiceError('connect_failed')
      }

      // The scenario contract is the server's: versioned, tested, and aware of the step
      // boundary. Composing a second prompt here is what let the tutor run the whole
      // mission inside step one, so the ticket is passed through whole.
      const liveSession = new LiveVoiceSession(
        outcome.ticket,
        {
          onStatus: (status) => {
            setVoiceState(
              status === 'connecting'
                ? 'thinking'
                : status === 'listening'
                  ? 'listening'
                  : status === 'thinking'
                    ? 'thinking'
                    : 'idle',
            )
          },
          onInputTranscript: (text) => {
            setTranscript(text)
            // Something is coming through after all.
            setMicHint(null)
            setVoiceComposerOpen(true)
          },
          onOutputTranscript: (text) => {
            setAssistantReply(text)
          },
          onError: (code) => {
            setError(t.voiceErrors[code])
          },
          onDropped: () => {
            void reconnectVoice()
          },
          onTurnComplete: () => {
            setVoiceComposerOpen(true)
            if (!manualStopRequestedRef.current) {
              void submitTurnFromLive()
            }
          },
          onSilenceTimeout: () => {
            void finishLiveTurn()
          },
          onNoSpeech: () => {
            // A hint, not an error: the session is fine and still listening. Nothing has
            // been said yet, so there is nothing to submit and nothing to recover from.
            setMicHint(t.player.noSpeechHint)
          },
        },
      )

      liveSessionRef.current = liveSession
      liveSessionIdRef.current = outcome.ticket.sessionId
      // The real grant: the smaller of the mission's length, the per-session cap and what is
      // left of the day. The screen used to quote the mission's length regardless.
      setSecondsLeft(outcome.ticket.maxDurationSeconds)
      setHasLiveSession(true)

      await liveSession.start()

      setVoiceComposerOpen(true)
      // Recorded server-side so a slow connection is a number somebody can look at, rather
      // than a report that "Gemini feels slow".
      void api
        .post('/missions/voice/sessions/connected', {
          sessionId: outcome.ticket.sessionId,
          connectMilliseconds: Date.now() - pressedAt,
        })
        .catch(() => {})
      track('voice_started', { mission: currentMission.summary.slug })
    } catch (caught) {
      setError(describeVoiceFailure(caught, t, t.player.startFailed))
      await teardownVoice(false, 'start_failed')
      // Starting failed after the press already opened the microphone; without this the
      // recording indicator stays lit with no session behind it.
      releaseMicrophone()
      setVoiceState('idle')
    } finally {
      setBusy(false)
    }
  }

  async function stopVoice() {
    const liveSession = liveSessionRef.current
    if (!liveSession) return

    setBusy(true)
    setError(null)
    manualStopRequestedRef.current = true

    try {
      await teardownVoice(true, null)
      setVoiceState('idle')

      const transcriptValue = transcriptRef.current.trim()
      // A live turn may already be in flight; submitting the same words twice would record
      // two attempts for one answer.
      if (transcriptValue && !latestTurnPassedRef.current && !submittingTurnRef.current) {
        await submitTurn(false, transcriptValue, assistantReplyRef.current, false, true)
      }

      if (latestTurnPassedRef.current) {
        if (isLastStep) {
          await complete()
        } else {
          await advance()
        }
        return
      }

      /*
       * Below the passing score, and that is not a locked door.
       *
       * This used to answer "the answer has not been fully accepted yet, try once more" and
       * stop there — with no other way out of the step, and on the last step no way to finish
       * the mission at all. Since finishing the mission is what advances the course day, a
       * learner whose final turn kept scoring short could repeat the same exercise six times
       * and never move: the tutor said "Ajoyib! Hammasi to'g'ri" while the app refused.
       *
       * The server was never this strict — it returns CanAdvance on a weak turn precisely so
       * nobody is trapped by one score. The panel now offers the same choice the live loop
       * does: try again, or move on.
       */
      if (transcriptValue) {
        setStepExhausted(true)
        setVoiceState('feedback')
      }
    } catch (caught) {
      setError(describeVoiceFailure(caught, t, t.player.stopFailed))
      await teardownVoice(false, 'stop_failed')
      setVoiceState('idle')
    } finally {
      setBusy(false)
    }
  }

  async function finishLiveTurn() {
    const liveSession = liveSessionRef.current
    if (!liveSession || manualStopRequestedRef.current) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      await liveSession.finishCurrentTurn()
    } catch (caught) {
      setError(describeVoiceFailure(caught, t, t.voiceErrors.turn_timeout))
      // The turn was written off, not the session. Listening resumes so a provider that went
      // quiet for one turn costs the learner a retry rather than the lesson.
      await liveSessionRef.current?.beginNextTurn()
    } finally {
      setBusy(false)
    }
  }

  /**
   * Continues after a dropped connection. The server's session row is deliberately left open:
   * StartAsync continues it rather than opening a parallel one, so reconnecting does not cost
   * the learner a second slice of their daily allowance.
   */
  async function reconnectVoice() {
    if (manualStopRequestedRef.current) return

    const dropped = liveSessionRef.current
    liveSessionRef.current = null
    liveSessionIdRef.current = null
    await dropped?.close().catch(() => {})

    if (reconnectsRef.current >= MAX_RECONNECTS) {
      // Out of attempts. Ended honestly, with the microphone back to the learner's control.
      setHasLiveSession(false)
      setSecondsLeft(null)
      setError(t.voiceErrors.connect_failed)
      setVoiceState('idle')
      return
    }

    reconnectsRef.current += 1
    setMicHint(t.player.reconnecting)
    await startVoice()
    setMicHint(null)
  }

  async function submitTurnFromLive() {
    const transcriptValue = transcriptRef.current.trim()
    if (!transcriptValue || submittingTurnRef.current) {
      if (!manualStopRequestedRef.current) {
        void liveSessionRef.current?.beginNextTurn()
      }
      return
    }

    submittingTurnRef.current = true
    try {
      // Scored with the thinking state on: the answer is away and being judged, which is a
      // second or three of a conversation that otherwise looks like it stalled.
      const passed = await submitTurn(false, transcriptValue, assistantReplyRef.current, true, false)
      if (manualStopRequestedRef.current) return

      if (!passed) {
        /*
         * Retrying is never shamed, but it has to be possible to stop — so after a few turns
         * that did not reach the passing score, the way out is offered.
         *
         * Offered, not taken. This used to end the session and show the feedback panel, which
         * was wrong about what it was counting: a step is a conversation, and most turns in it
         * are not attempts at the answer. "Да, чек нужен." is a fine reply that simply does
         * not contain the target phrase, so three ordinary exchanges tripped the cap and the
         * app closed the session on a learner who was in the middle of talking — right after
         * the tutor had said "now, the last step".
         */
        if (stepAttemptsRef.current >= MAX_STEP_ATTEMPTS) {
          setStepExhausted(true)
        }

        // Straight back to listening. The delay that used to sit here was a window in which
        // the status said the conversation was live while the microphone was not yet on.
        await liveSessionRef.current?.beginNextTurn()
        return
      }

      /*
       * The recap is the end of the mission — there is nothing left to ask. Without this the
       * session simply idled after a passing final turn and the only way out was the stop
       * button, so a learner who had already answered correctly was asked again and again.
       */
      if (currentStepRef.current >= totalStepsRef.current - 1) {
        await complete()
      }
    } finally {
      submittingTurnRef.current = false
    }
  }

  async function submitTurn(
    isRetry: boolean,
    transcriptValue = transcript,
    tutorReply = assistantReply,
    showThinking = true,
    showFeedbackPanel = true,
  ) {
    if (!attempt || !transcriptValue.trim()) return

    setBusy(true)
    if (showThinking) {
      setVoiceState('thinking')
    }
    setError(null)

    try {
      const result = await api.post<TurnFeedback>('/missions/attempts/turns', {
        attemptId: attempt.attemptId,
        stepIndex,
        learnerTranscript: transcriptValue,
        tutorTranscript: tutorReply,
        isRetry,
      })

      const passed = result.score >= 70
      latestTurnScoreRef.current = result.score
      latestTurnPassedRef.current = passed
      stepAttemptsRef.current = passed ? 0 : stepAttemptsRef.current + 1
      setTurnAccepted(passed)
      if (showFeedbackPanel) {
        setFeedback(result)
        setVoiceState('feedback')
      } else {
        setFeedback(null)
        setVoiceState('idle')
      }
      return result.score >= 70
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.player.submitFailed)
      setVoiceState('idle')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function teardownVoice(completed: boolean, failureReason: string | null) {
    const liveSession = liveSessionRef.current
    const sessionId = liveSessionIdRef.current
    if (!liveSession || !sessionId) return

    const elapsedSeconds = liveSession.elapsedSeconds

    liveSessionRef.current = null
    liveSessionIdRef.current = null
    setHasLiveSession(false)
    setSecondsLeft(null)

    await liveSession.close().catch(() => {})

    try {
      await api.post('/missions/voice/sessions/end', {
        sessionId,
        elapsedSeconds,
        lastStepIndex: currentStepRef.current,
        completed,
        failureReason,
      })
    } catch {
      // Closing the learning session should not block the UI.
    }
  }

  async function advance() {
    await teardownVoice(true, null)

    // Fold the turn that just closed into the thread before the live state is cleared.
    setHistory((current) => [
      ...current,
      ...(safeStep?.promptRu
        ? [{ key: `p${stepIndex}`, role: 'tutor' as const, ru: safeStep.promptRu, uz: safeStep.promptUz }]
        : []),
      ...(transcript.trim() ? [{ key: `l${stepIndex}`, role: 'learner' as const, text: transcript.trim() }] : []),
      ...(assistantReply ? [{ key: `r${stepIndex}`, role: 'tutor' as const, ru: assistantReply, uz: null }] : []),
      ...(feedback
        ? [
            {
              key: `f${stepIndex}`,
              role: 'feedback' as const,
              strength: feedback.strengthNote,
              correction: feedback.headlineCorrection,
              passed: feedback.score >= 70,
            },
          ]
        : []),
    ])

    setFeedback(null)
    setTranscript('')
    setAssistantReply(null)
    setVoiceState('idle')
    setDegraded(null)
    setVoiceComposerOpen(false)
    latestTurnPassedRef.current = false
    latestTurnScoreRef.current = null
    stepAttemptsRef.current = 0
    reconnectsRef.current = 0
    setStepExhausted(false)
    setTurnAccepted(false)
    manualStopRequestedRef.current = false
    setStepIndex((current) => Math.min(current + 1, totalSteps - 1))
  }

  async function complete() {
    if (!attempt) return
    setBusy(true)
    try {
      await teardownVoice(true, null)
      await api.post(`/missions/attempts/${attempt.attemptId}/complete`)
      navigate(`/missions/attempts/${attempt.attemptId}/result`, { replace: true })
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.player.completeFailed)
      setBusy(false)
    }
  }

  const week = summary.courseDay ? Math.ceil(summary.courseDay / 7) : null

  // The thread: everything already closed, then the turn currently in flight.
  const liveMessages: ChatMessage[] = [
    ...(safeStep?.promptRu && safeStep.kind !== 'PhraseIntro'
      ? [{ key: 'now-prompt', role: 'tutor' as const, ru: safeStep.promptRu, uz: safeStep.promptUz }]
      : []),
    ...(transcript.trim()
      ? [{ key: 'now-learner', role: 'learner' as const, text: transcript.trim() }]
      : []),
    ...(assistantReply
      ? [{ key: 'now-reply', role: 'tutor' as const, ru: assistantReply, uz: null }]
      : []),
    ...(feedback
      ? [
          {
            key: 'now-feedback',
            role: 'feedback' as const,
            strength: feedback.strengthNote,
            correction: feedback.headlineCorrection,
            passed: feedback.score >= 70,
          },
        ]
      : []),
  ]

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
      <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
        <header className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex min-w-0 items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <BackGlyph />
            <span className="truncate">
              {t.labels.category[summary.category]}
              {week !== null && ` / ${week}`}
            </span>
          </button>

          {summary.courseDay !== null && summary.courseDay !== undefined && (
            <Badge outline>{summary.courseDay}-kun</Badge>
          )}
        </header>

        <div className="mt-8 flex-1">
          <h1 className="text-3xl leading-[1.15] font-extrabold tracking-tight text-ink">
            {pickContent(locale, { uz: summary.titleUz, ru: summary.titleRu, en: summary.titleEn })}
          </h1>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-ink-muted">
            {summary.objectiveUz}{' '}
            {fill(t.player.missionLength, { count: currentMission.maxVoiceMinutes })}
          </p>

          <TutorIntro />

          {needsRegisterLabel && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="caution">{t.labels.formality[summary.formality]}</Badge>
              <Badge tone="caution">
                {t.labels.workplace[summary.workplaceUse]}
              </Badge>
            </div>
          )}

          {error && (
            <div className="mt-6">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          {/* Phrase introduction stays a list: it is material to study, not a conversation. */}
          {safeStep?.kind === 'PhraseIntro' ? (
            <div className="mt-6">
              <PhraseList
                phrases={safePhrases}
                promptAudioState={promptAudioState}
                promptAudioTextKey={promptAudioTextKey}
                audioAvailable={!ttsUnavailable}
                onListenPhrase={handleListen}
              />
            </div>
          ) : (
            <ConversationThread
              messages={[...history, ...liveMessages]}
              voiceState={voiceState}
              promptAudioState={promptAudioState}
              promptAudioTextKey={promptAudioTextKey}
              audioAvailable={!ttsUnavailable}
              onListen={handleListen}
            />
          )}

          {ttsUnavailable && (
            <p className="text-support mt-6 rounded-xl bg-ground-sunken px-4 py-3">
              {t.player.ttsUnavailable}
            </p>
          )}

          {degraded && (
            <p className="text-support mt-6 rounded-xl bg-caution-soft px-4 py-3">{degraded}</p>
          )}
        </div>

        <MicControl
          state={voiceState}
          busy={busy}
          hasLiveSession={hasLiveSession}
          latestTurnAccepted={turnAccepted}
          hint={micHint}
          secondsLeft={secondsLeft}
          onStart={() => void startVoice()}
          onStop={() => void stopVoice()}
          onInterrupt={
            hasLiveSession && voiceState === 'thinking' && !busy
              ? () => void liveSessionRef.current?.interruptTutor()
              : null
          }
          onMoveOn={
            // Only while the conversation is live: in the feedback panel the same choice is
            // already one of the two buttons.
            stepExhausted && hasLiveSession && !busy
              ? () => void (isLastStep ? complete() : advance())
              : null
          }
          feedback={feedback}
          isLastStep={isLastStep}
          stepExhausted={stepExhausted}
          onRetry={() => {
            setVoiceState('idle')
            setFeedback(null)
            setAssistantReply(null)
            // A fresh go at the step: the cap applies again from here, so the learner is
            // offered the way out after each further attempt rather than trapped by it.
            setStepExhausted(false)
          }}
          onAdvance={isLastStep ? () => void complete() : () => void advance()}
        />

        {/* Text fallback, only when live voice is genuinely unavailable (PRD §11). */}
        {(degraded !== null || (voiceComposerOpen && !hasLiveSession && voiceState === 'unavailable')) && (
          <div className="mt-6 max-w-xl">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{t.player.writeAnswer}</span>
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                rows={3}
                className="w-full rounded-xl border-2 border-hairline bg-ground-raised px-4 py-3 text-base text-ink placeholder:text-ink-faint"
                placeholder={promptAudioText}
              />
            </label>
            <Button
              size="lg"
              className="mt-3 w-full sm:w-auto"
              disabled={busy || !transcript.trim()}
              onClick={() => void submitTurn(false)}
            >
              {t.player.submitAnswer}
            </Button>
          </div>
        )}

        <footer className="mt-8">
          <ProgressBar value={completedSteps} max={totalSteps} label={t.player.stepProgress} />
          <div className="mt-3 flex items-center justify-between gap-4 text-sm text-ink-muted">
            <span>
              {fill(t.player.stepsDone, { done: completedSteps, total: totalSteps })}
            </span>
            <span className="truncate">
              {nextStep ? fill(t.player.nextStep, { step: t.labels.step[nextStep.kind] }) : t.player.lastStep}
            </span>
          </div>
        </footer>
      </div>

      <aside className="mt-10 space-y-4 lg:mt-0 lg:sticky lg:top-8">
        <GoalCard steps={safeSteps} stepIndex={stepIndex} completed={completedSteps} t={t} />

        {/*
          No "Maslahat" card here: on a phrase step it repeated the phrase list verbatim, and
          on the others the step's Uzbek support already sits under the tutor's own message,
          where the learner is actually reading.
        */}
        {safePhrases.length > 0 && (
          <RailCard
            title={t.player.phrases}
            icon={<PhraseGlyph />}
            trailing={fill(t.player.phraseCount, { count: safePhrases.length })}
          >
            <ul className="space-y-2">
              {safePhrases.map((phrase) => (
                <li
                  key={phrase.order}
                  className="flex items-center gap-3 rounded-xl bg-ground-sunken px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-ink">{phrase.russian}</span>
                    <span className="block truncate text-sm text-ink-muted">
                      {phrase.uzbekMeaning}
                    </span>
                  </span>
                  {!ttsUnavailable && (
                    <InlineListenButton
                      small
                      active={promptAudioState === 'playing' && promptAudioTextKey === phrase.russian}
                      loading={promptAudioState === 'loading' && promptAudioTextKey === phrase.russian}
                      onClick={() => handleListen(phrase.russian)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </RailCard>
        )}

        {/*
          The mockup carried a pronunciation tip here. There is no such field in the content
          model, so rather than invent one this slot shows the correction the tutor actually
          gave — real, specific to this learner, and empty when there is nothing to say.
        */}
        {feedback && (
          <RailCard title={t.player.aiNote} icon={<CoachGlyph />}>
            <p className="text-base leading-relaxed text-ink">{feedback.headlineCorrection}</p>
            <p className="text-support mt-2">{t.player.aiDisclaimer}</p>
          </RailCard>
        )}

        {currentMission.usageNoteUz && (
          <RailCard title={t.player.usageNote} icon={<HintGlyph />}>
            <p className="text-base leading-relaxed text-ink">{currentMission.usageNoteUz}</p>
          </RailCard>
        )}
      </aside>
    </div>
  )
}




/* ----------------------------------------------------------------- conversation thread */

type ChatMessage =
  | { key: string; role: 'tutor'; ru: string; uz?: string | null }
  | { key: string; role: 'learner'; text: string }
  | { key: string; role: 'feedback'; strength: string; correction: string; passed: boolean }

/**
 * The lesson reads as one continuous exchange rather than a prompt that is replaced each
 * step: the learner can see what they already said, which is what makes it feel like a
 * conversation with someone instead of a form.
 */
function ConversationThread({
  messages,
  voiceState,
  promptAudioState,
  promptAudioTextKey,
  audioAvailable,
  onListen,
}: {
  messages: ChatMessage[]
  voiceState: VoiceState
  promptAudioState: 'idle' | 'loading' | 'playing'
  promptAudioTextKey: string | null
  audioAvailable: boolean
  onListen: (text: string) => void
}) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  return (
    <div className="mt-6 space-y-4">
      {messages.map((message) => {
        if (message.role === 'learner') {
          return (
            <div key={message.key} className="flex justify-end gap-3">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-signal-soft px-4 py-3 text-base leading-relaxed text-ink">
                {message.text}
              </p>
              <VoiceBadge state={voiceState === 'listening' ? 'listening' : 'idle'} />
            </div>
          )
        }

        if (message.role === 'feedback') {
          return (
            <div key={message.key} className="flex gap-3">
              <TutorMark />
              <div
                className={`max-w-[80%] rounded-2xl rounded-tl-md px-4 py-3 ${
                  message.passed ? 'bg-milestone-soft' : 'bg-caution-soft'
                }`}
              >
                <p className="text-sm font-semibold text-ink-muted">
                  {message.passed ? 'Yaxshi tomoni' : 'Yana bir urinamiz'}
                </p>
                <p className="mt-1 text-base leading-relaxed text-ink">{message.strength}</p>
                <p className="mt-2 border-t border-hairline pt-2 text-base leading-relaxed text-ink">
                  {message.correction}
                </p>
              </div>
            </div>
          )
        }

        return (
          <div key={message.key} className="flex gap-3">
            <TutorMark />
            <div className="max-w-[80%] rounded-2xl rounded-tl-md border-2 border-hairline bg-ground-raised px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base leading-relaxed text-ink">{message.ru}</p>
                  {message.uz && <UzHint>{message.uz}</UzHint>}
                </div>
                {audioAvailable && (
                  <InlineListenButton
                    small
                    active={promptAudioState === 'playing' && promptAudioTextKey === message.ru}
                    loading={promptAudioState === 'loading' && promptAudioTextKey === message.ru}
                    onClick={() => onListen(message.ru)}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}

/** Drop a square image at this path to give the tutor a face; see public/README.md. */
const TUTOR_AVATAR_SRC = '/tutor-avatar.jpg'

/**
 * The tutor's mark. Uses the avatar image when one is present and falls back to the abstract
 * signal if it is missing or fails to load, so the lesson never renders a broken image.
 *
 * The label always names it as the AI. A human face must not let a learner believe they are
 * talking to a person — the product's own positioning is that this never replaces a teacher.
 */
function TutorMark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const t = useT()
  const [failed, setFailed] = useState(false)
  const box = size === 'lg' ? 'size-11' : 'mt-1 size-9'

  if (failed) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-signal-soft ${box}`}
        role="img"
        aria-label={t.player.tutorName}
      >
        <span className="flex h-3.5 items-center gap-[2px]" aria-hidden="true">
          {[0.55, 1, 0.7].map((scale, index) => (
            <span
              key={index}
              className="w-[2.5px] rounded-full bg-signal"
              style={{ height: '100%', transform: `scaleY(${scale})` }}
            />
          ))}
        </span>
      </span>
    )
  }

  return (
    <img
      src={TUTOR_AVATAR_SRC}
      alt={t.player.tutorName}
      // Eager: it identifies who the learner is about to speak to, so it must not pop in late.
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-signal-soft object-cover ${box}`}
    />
  )
}

/**
 * The tutor introduced once, at the top. Without this the coach only appeared after the
 * conversation had already started — on the phrase-introduction step there are no bubbles
 * yet, so the learner met a wall of text with nobody attached to it.
 */
function TutorIntro() {
  const t = useT()

  return (
    <div className="mt-5 flex items-center gap-3">
      <TutorMark size="lg" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{t.player.tutorName}</p>
        <p className="text-support">{t.player.tutorTagline}</p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- mic control */

/**
 * One high-emphasis action, always in the same place. Replay and the step's own outcome sit
 * beside it as quiet controls so nothing competes with the microphone (PRD §6).
 */
function MicControl({
  state,
  busy,
  hasLiveSession,
  latestTurnAccepted,
  hint,
  secondsLeft,
  onStart,
  onStop,
  onInterrupt,
  onMoveOn,
  feedback,
  isLastStep,
  stepExhausted,
  onRetry,
  onAdvance,
}: {
  state: VoiceState
  busy: boolean
  hasLiveSession: boolean
  latestTurnAccepted: boolean
  /** Said under the microphone when nothing is coming through. Not an error. */
  hint: string | null
  /** Voice time granted to the live session, counting down. Null when nothing is live. */
  secondsLeft: number | null
  onStart: () => void
  onStop: () => void
  /** Offered only while the tutor is speaking; null the rest of the time. */
  onInterrupt: (() => void) | null
  /** Offered once the step has taken a few tries, without stopping the conversation. */
  onMoveOn: (() => void) | null
  feedback: TurnFeedback | null
  isLastStep: boolean
  /** Out of attempts on this step; moving on is offered without having passed. */
  stepExhausted: boolean
  onRetry: () => void
  onAdvance: () => void
}) {
  const t = useT()

  // Once the turn is judged, the decision replaces the microphone: retry, or move on.
  if (state === 'feedback' && feedback) {
    const passed = feedback.score >= 70

    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        {stepExhausted && !passed && (
          // Named plainly and without blame: the step is parked, not failed.
          <p className="text-support max-w-sm text-center">{t.player.parkedStep}</p>
        )}
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <Button variant="secondary" size="lg" onClick={onRetry} disabled={busy}>
            {t.player.tryAgain}
          </Button>
          {(passed || stepExhausted) && (
            <Button size="lg" onClick={onAdvance} disabled={busy}>
              {isLastStep ? t.player.finish : t.player.advance}
            </Button>
          )}
        </div>
      </div>
    )
  }

  const status = busy
    ? // "Waiting" during a live session reads as a stall. What is actually happening is that
      // the answer has gone off to be scored, which is worth saying.
      hasLiveSession
      ? t.player.evaluating
      : t.player.waiting
    : state === 'listening'
      ? t.player.listening
      : hasLiveSession
        ? latestTurnAccepted
          ? t.player.turnAccepted
          : t.player.inConversation
        : t.player.micPrompt

  return (
    /*
     * A fixed height for the whole control. The occasional messages below it — the step
     * offer, the "we cannot hear you" hint — are rarer than a turn, but this block sits
     * under a flex-1 content area, so anything that makes it taller lifts the microphone off
     * the spot the learner last reached for. The reserved space costs nothing: it is empty
     * screen either way.
     */
    <div className="mt-8 min-h-64">
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={hasLiveSession ? onStop : onStart}
          /*
           * Stopping is never blocked. `busy` is true while a turn is being scored, which is
           * exactly the moment a learner reaches for the stop button — and a disabled control
           * there means a live session they cannot end, on the clock, spending voice budget.
           * Only starting waits.
           */
          disabled={busy && !hasLiveSession}
          aria-label={hasLiveSession ? t.player.finish : t.player.answer}
          /*
           * The screen's one action, and the only control on it that is not a Button — so
           * the press has to be built here. Same language: it rests on a solid edge, lifts
           * toward the cursor, and sinks onto that edge when pushed.
           */
          className={cx(
            'flex size-20 shrink-0 items-center justify-center rounded-full',
            'shadow-[0_5px_0_0_var(--color-signal-depth)]',
            'transition-[background-color,box-shadow,transform] duration-150',
            'hover:-translate-y-0.5 hover:shadow-[0_7px_0_0_var(--color-signal-depth)]',
            'active:translate-y-[5px] active:shadow-none',
            'disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none',
            hasLiveSession ? 'bg-signal-strong' : 'bg-signal hover:bg-signal-hover',
          )}
        >
          {hasLiveSession ? <StopGlyph /> : <MicGlyph />}
        </button>
      </div>

      {/*
        Everything under the microphone lives in slots of a fixed height.
        The status line, the equaliser and the interrupt each used to appear and disappear on
        their own, and every one of them changed the height of this block — so the microphone
        moved on every turn of the conversation, which is the one control on the screen that
        has to stay exactly where the learner last found it.
      */}
      <p
        className="mt-4 flex min-h-10 items-center justify-center text-center text-sm text-ink-muted"
        role="status"
        aria-live="polite"
      >
        {status}
      </p>

      {/*
        One slot for the turn's own affordance. Listening and thinking are opposite halves of
        an exchange and never happen together, so they share the space instead of taking one
        each.
      */}
      <div className="flex h-9 items-center justify-center">
        {state === 'listening' ? (
          <VoiceSignal state="listening" size="sm" />
        ) : onInterrupt ? (
          <Button variant="ghost" size="sm" onClick={onInterrupt}>
            {t.player.interrupt}
          </Button>
        ) : null}
      </div>

      {/* Reserved from the moment the session opens, so the clock's arrival moves nothing. */}
      <p
        className={`flex h-5 items-center justify-center text-sm tabular-nums ${
          secondsLeft !== null && secondsLeft <= 60 ? 'text-caution' : 'text-ink-faint'
        }`}
      >
        {secondsLeft !== null && fill(t.player.voiceTimeLeft, { time: formatClock(secondsLeft) })}
      </p>

      {onMoveOn && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-support max-w-sm text-center">{t.player.stepOffer}</p>
          <Button variant="ghost" size="sm" onClick={onMoveOn}>
            {isLastStep ? t.player.finish : t.player.advance}
          </Button>
        </div>
      )}

      {hint && <p className="text-support mx-auto mt-3 max-w-sm text-center">{hint}</p>}
    </div>
  )
}

/**
 * Turns whatever was thrown into something in the learner's language. A VoiceError carries a
 * code the dictionary knows; a RequestError already carries a server message in the right
 * language; anything else is ours and gets the caller's fallback rather than a stack message.
 */
function describeVoiceFailure(caught: unknown, t: Dictionary, fallback: string) {
  if (caught instanceof VoiceError) return t.voiceErrors[caught.code]
  if (caught instanceof RequestError) return caught.message

  return fallback
}

/** m:ss. Minutes alone are useless at the end, which is the only time this matters. */
function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/* --------------------------------------------------------------------------- the rail */

function RailCard({
  title,
  icon,
  trailing,
  children,
}: {
  title: string
  icon: ReactNode
  trailing?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-signal-ink" aria-hidden="true">
          {icon}
        </span>
        <h2 className="flex-1 text-sm font-extrabold text-ink">{title}</h2>
        {trailing && <span className="text-sm text-ink-faint">{trailing}</span>}
      </div>
      {children}
    </section>
  )
}

/** The mission's own steps as a checklist — the learner sees what "done" will mean. */
function GoalCard({
  steps,
  stepIndex,
  completed,
  t,
}: {
  steps: MissionDetail['steps']
  stepIndex: number
  completed: number
  t: Dictionary
}) {
  const done = completed

  return (
    <RailCard title={t.player.goal} icon={<TargetGlyph />} trailing={`${done} / ${steps.length}`}>
      <ul className="space-y-2.5">
        {steps.map((step, index) => {
          const isDone = index < completed
          const isCurrent = index === stepIndex && !isDone

          return (
            <li key={step.order} className="flex items-start gap-2.5">
              <CheckMark done={isDone} current={isCurrent} />
              <span
                className={`text-sm leading-snug ${
                  isDone ? 'text-ink-muted line-through' : isCurrent ? 'text-ink' : 'text-ink-faint'
                }`}
              >
                {shortStepLabel(step, t)}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-3">
        <ProgressBar value={done} max={steps.length} label={t.player.goalProgress} />
      </div>
    </RailCard>
  )
}

/**
 * A checklist line has to be scannable. A step's Uzbek support is used when it reads as one,
 * but a phrase-introduction step carries the whole joined phrase list, which would wrap to
 * four lines and tell the learner nothing they cannot already see in the phrase card.
 */
function shortStepLabel(step: MissionDetail['steps'][number], t: Dictionary) {
  const prompt = step.promptUz?.trim()
  if (!prompt || prompt.length > 52 || prompt.includes('·')) {
    return t.labels.stepTitle[step.kind]
  }

  return prompt
}

function CheckMark({ done, current }: { done: boolean; current: boolean }) {
  if (done) {
    return (
      <span
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-milestone"
        aria-label="Bajarildi"
        role="img"
      >
        <svg viewBox="0 0 12 12" aria-hidden="true" className="size-2.5 fill-none stroke-white stroke-[2.2]">
          <path d="m2 6.3 2.6 2.6L10 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  return (
    <span
      className={`mt-0.5 size-4 shrink-0 rounded-full border-2 ${
        current ? 'border-signal' : 'border-hairline'
      }`}
      aria-label={current ? 'Hozirgi qadam' : 'Hali bajarilmagan'}
      role="img"
    />
  )
}

/* -------------------------------------------------------------------------- glyphs */

const railGlyph = 'size-4 fill-none stroke-current stroke-[1.7]'

function TargetGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={railGlyph}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  )
}

function HintGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={railGlyph}>
      <path d="M12 3.5v2M4.7 8.2l1.7 1M19.3 8.2l-1.7 1M9.5 19h5" strokeLinecap="round" />
      <path d="M8.6 14.8a4.6 4.6 0 1 1 6.8 0c-.6.7-.9 1.3-.9 2.2h-5c0-.9-.3-1.5-.9-2.2Z" strokeLinejoin="round" />
    </svg>
  )
}

function PhraseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={railGlyph}>
      <path d="M4 5.5h6a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H4Z" strokeLinejoin="round" />
      <path d="M20 5.5h-6a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h6Z" strokeLinejoin="round" />
    </svg>
  )
}

function CoachGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={railGlyph}>
      <path d="M5 17V9.5M9.7 17V6M14.3 17v-7M19 17v-4" strokeLinecap="round" />
    </svg>
  )
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0 fill-none stroke-current stroke-[1.8]">
      <path d="M14 5.5 7.5 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-8 fill-none stroke-on-signal stroke-[1.7]">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" strokeLinecap="round" />
    </svg>
  )
}

function StopGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7 fill-on-signal">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  )
}

function InlineListenButton({
  active,
  loading,
  onClick,
  small = false,
}: {
  active: boolean
  loading: boolean
  onClick: () => void
  small?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "Eshitishni to'xtatish" : 'Eshitish'}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-hairline bg-ground-raised text-ink transition hover:border-signal hover:text-signal-ink ${
        small ? 'size-9' : 'size-12'
      }`}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-hairline border-t-current" />
      ) : active ? (
        <PauseGlyph />
      ) : (
        <PlayGlyph />
      )}
    </button>
  )
}

function PhraseList({
  phrases,
  promptAudioState,
  promptAudioTextKey,
  audioAvailable,
  onListenPhrase,
}: {
  phrases: MissionDetail['targetPhrases']
  promptAudioState: 'idle' | 'loading' | 'playing'
  promptAudioTextKey: string | null
  audioAvailable: boolean
  onListenPhrase: (text: string) => void
}) {
  return (
    <ul className="divide-y divide-hairline">
      {phrases.map((phrase) => (
        <li key={phrase.order} className="flex items-start gap-5 py-6">
          <VoiceBadge />
          <div className="min-w-0 flex-1">
            <p className="text-xl leading-snug font-medium text-ink">"{phrase.russian}"</p>
            {phrase.transliteration && (
              <p className="mt-1 text-sm text-ink-faint">{phrase.transliteration}</p>
            )}
            {/* Uzbek meaning is secondary but always present. */}
            <UzHint>"{phrase.uzbekMeaning}"</UzHint>

            {phrase.usageNoteUz && (
              <p className="text-support mt-3 rounded-lg bg-ground-sunken px-3 py-2">
                {phrase.usageNoteUz}
              </p>
            )}

            {phrase.audioUrl && (
              <audio controls src={phrase.audioUrl} className="mt-3 w-full max-w-sm">
                <track kind="captions" />
              </audio>
            )}
          </div>
          {audioAvailable && (
            <InlineListenButton
              active={promptAudioState === 'playing' && promptAudioTextKey === phrase.russian}
              loading={promptAudioState === 'loading' && promptAudioTextKey === phrase.russian}
              onClick={() => onListenPhrase(phrase.russian)}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
