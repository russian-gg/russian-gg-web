import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, RequestError, track } from '../lib/api'
import { categoryLabelUz, formalityLabelUz, stepLabelUz, workplaceLabelUz } from '../lib/format'
import { LiveVoiceSession, isPromptAudioPlaying, playPromptAudio, stopPromptAudio } from '../lib/liveVoice'
import type {
  CoursePhase,
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
  Rule,
  Spinner,
  UzHint,
} from '../components/ui'

/**
 * The focused mission player (PRD §6). One objective, one Russian prompt with Uzbek
 * support, one high-emphasis action to answer by voice, and step progress at the bottom.
 * Built from hairlines and whitespace rather than stacked cards. Detailed scoring is
 * deliberately withheld until the mission ends.
 */
export function MissionPlayer() {
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
  const [voiceComposerOpen, setVoiceComposerOpen] = useState(false)
  const [hasLiveSession, setHasLiveSession] = useState(false)
  const liveSessionRef = useRef<LiveVoiceSession | null>(null)
  const liveSessionIdRef = useRef<string | null>(null)
  const currentStepRef = useRef(0)

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
        setError(caught instanceof RequestError ? caught.message : "Mashqni ochib bo'lmadi.")
      }
    })()
  }, [mission, missionId])

  useEffect(() => {
    currentStepRef.current = stepIndex
  }, [stepIndex])

  useEffect(() => {
    return () => {
      stopPromptAudio()
      setPromptAudioState('idle')
      const liveSession = liveSessionRef.current
      if (!liveSession) return
      liveSessionRef.current = null
      liveSessionIdRef.current = null
      void liveSession.close()
    }
  }, [])

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

  if (!mission) return <ErrorNote>Mashq topilmadi.</ErrorNote>
  if (
    !mission.summary ||
    !Array.isArray(mission.steps) ||
    !Array.isArray(mission.targetPhrases) ||
    mission.steps.length === 0
  ) {
    return (
      <ErrorNote>
        Bu mashq ma&apos;lumotlari to&apos;liq kelmadi. Sahifani yangilab ko&apos;ring yoki boshqa
        kunni oching.
      </ErrorNote>
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
  const promptAudioText =
    safeStep?.kind === 'PhraseIntro'
      ? safePhrases.map((phrase) => phrase.russian).join('. ')
      : safeStep?.promptRu ?? summary.titleRu

  function handleListen(text: string) {
    setError(null)
    if (isPromptAudioPlaying(text)) {
      stopPromptAudio()
      setPromptAudioState('idle')
      return
    }

    void playPromptAudio(text, {
      onStateChange: setPromptAudioState,
    }).catch((caught) => {
      setPromptAudioState('idle')
      setError(
        caught instanceof RequestError
          ? caught.message
          : "Gemini ovozini eshittirib bo'lmadi.",
      )
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
    setVoiceState('thinking')

    try {
      const outcome = await api.post<VoiceSessionOutcome>('/missions/voice/sessions', {
        attemptId: attempt.attemptId,
        stepIndex,
      })

      if (!outcome.isAvailable) {
        // An honest degraded state, not a silent failure (PRD §11).
        setDegraded(outcome.unavailable?.messageUz ?? 'Ovozli aloqa hozir mavjud emas.')
        setVoiceComposerOpen(true)
        setVoiceState('unavailable')
        return
      }

      if (!outcome.ticket) {
        throw new Error("Voice ticket qaytmadi.")
      }

      const liveSession = new LiveVoiceSession(
        outcome.ticket,
        buildMissionVoiceInstruction(currentMission, safeStep),
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
            setVoiceComposerOpen(true)
          },
          onOutputTranscript: (text) => {
            setAssistantReply(text)
          },
          onError: (message) => {
            setError(message)
          },
          onTurnComplete: () => {
            setVoiceComposerOpen(true)
          },
          onSilenceTimeout: () => {
            void stopVoice()
          },
        },
      )

      liveSessionRef.current = liveSession
      liveSessionIdRef.current = outcome.ticket.sessionId
      setHasLiveSession(true)

      await liveSession.start()

      setVoiceComposerOpen(true)
      track('voice_started', { mission: currentMission.summary.slug })
    } catch (caught) {
      const message =
        caught instanceof RequestError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Ovozli seansni boshlab bo'lmadi."
      setError(message)
      await teardownVoice(false, 'start_failed')
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

    try {
      await liveSession.stopAndAwaitTurn()
      await teardownVoice(true, null)
      setVoiceState('idle')
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Ovozli seansni tugatib bo'lmadi."
      setError(message)
      await teardownVoice(false, 'stop_failed')
      setVoiceState('idle')
    } finally {
      setBusy(false)
    }
  }

  async function submitTurn(isRetry: boolean) {
    if (!attempt || !transcript.trim()) return

    setBusy(true)
    setVoiceState('thinking')
    setError(null)

    try {
      const result = await api.post<TurnFeedback>('/missions/attempts/turns', {
        attemptId: attempt.attemptId,
        stepIndex,
        learnerTranscript: transcript,
        tutorTranscript: assistantReply,
        isRetry,
      })

      setFeedback(result)
      setVoiceState('feedback')
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : "Javobni yuborib bo'lmadi.")
      setVoiceState('idle')
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
    setFeedback(null)
    setTranscript('')
    setAssistantReply(null)
    setVoiceState('idle')
    setDegraded(null)
    setVoiceComposerOpen(false)
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
      setError(caught instanceof RequestError ? caught.message : "Mashqni yakunlab bo'lmadi.")
      setBusy(false)
    }
  }

  const week = summary.courseDay ? Math.ceil(summary.courseDay / 7) : null

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      {/* Context line: where this sits in the journey, and which day it is. */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
            <p className="truncate text-sm text-ink-muted">
            {categoryLabelUz[summary.category] ?? 'Muloqot'}
            {week !== null && ` / ${week}-hafta`}
          </p>
        </div>

        {summary.courseDay !== null && summary.courseDay !== undefined && (
          <Badge outline>{summary.courseDay}-kun</Badge>
        )}
      </header>

      <div className="mt-14 flex-1">
        {/* One clear lesson objective, with the supporting detail directly under it. */}
        <h1 className="text-3xl leading-[1.15] font-semibold tracking-tight text-ink sm:text-4xl">
          {summary.titleUz}
        </h1>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-muted">
          {summary.objectiveUz} Sizga {currentMission.maxVoiceMinutes} daqiqa yetadi.
        </p>

        {needsRegisterLabel && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="caution">{formalityLabelUz[summary.formality] ?? 'Neytral'}</Badge>
            <Badge tone="caution">{workplaceLabelUz[summary.workplaceUse] ?? 'Ishda ishlatsa bo\'ladi'}</Badge>
          </div>
        )}

        {currentMission.usageNoteUz && needsRegisterLabel && (
          <p className="text-support mt-4 rounded-xl bg-caution-soft px-4 py-3">
            {currentMission.usageNoteUz}
          </p>
        )}

        <Rule className="mt-10" />

        {error && (
          <div className="mt-6">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {/* The line the learner is working on, with its Uzbek support underneath. */}
        {safeStep?.kind === 'PhraseIntro' ? (
          <PhraseList
            phrases={safePhrases}
            promptAudioState={promptAudioState}
            onListenPhrase={handleListen}
          />
        ) : (
          <div className="flex items-start gap-5 py-7">
            <VoiceBadge state={voiceState} />
            <div className="min-w-0 flex-1">
              <p className="text-xl leading-snug font-medium text-ink sm:text-2xl">
                "{safeStep?.promptRu}"
              </p>
              {safeStep?.promptUz && <UzHint>"{safeStep.promptUz}"</UzHint>}
            </div>
            <InlineListenButton
              active={promptAudioState === 'playing' && isPromptAudioPlaying(promptAudioText)}
              loading={promptAudioState === 'loading'}
              onClick={() => handleListen(promptAudioText)}
            />
          </div>
        )}

        <Rule />

        {/* Action row. One high-emphasis action; everything else stays quiet. */}
        <div className="py-7">
          <VoiceControls
            state={voiceState}
            degraded={degraded}
            assistantReply={assistantReply}
            transcript={transcript}
            onTranscript={setTranscript}
            onStart={() => void startVoice()}
            onStop={() => void stopVoice()}
            onSubmit={() => void submitTurn(false)}
            busy={busy}
            voiceComposerOpen={voiceComposerOpen}
            hasLiveSession={hasLiveSession}
            promptRu={promptAudioText}
            feedback={feedback}
            isLastStep={isLastStep}
            onRetry={() => {
              setVoiceState('idle')
              setFeedback(null)
              setAssistantReply(null)
            }}
            onAdvance={isLastStep ? () => void complete() : () => void advance()}
          />
        </div>
      </div>

      {/* Step progress at the bottom, not competing metrics (PRD §6). */}
      <footer className="mt-10">
        <ProgressBar value={stepIndex + 1} max={totalSteps} label="Mashq progressi" />
        <div className="mt-3 flex items-center justify-between gap-4 text-sm text-ink-muted">
          <span>
            {stepIndex + 1} / {totalSteps} qadam
          </span>
          <span className="truncate">
            {nextStep ? `Keyingi: ${stepLabelUz[nextStep.kind]}` : 'Oxirgi qadam'}
          </span>
        </div>
      </footer>
    </div>
  )
}

function buildMissionVoiceInstruction(
  mission: MissionDetail,
  step: MissionDetail['steps'][number] | undefined,
) {
  const targetPhrases = mission.targetPhrases.map((phrase) => phrase.russian).join(', ')
  const promptUz = step?.promptUz ? `Uzbek help: ${step.promptUz}` : ''
  const acceptedAnswers =
    step?.acceptedAnswers?.length
      ? `Answers that fully satisfy this step: ${step.acceptedAnswers.join(' | ')}`
      : ''
  const scoringRubric = step?.rubric ? `Scoring rubric: ${step.rubric}` : ''
  const tutorInstruction = step?.tutorInstruction ? `Tutor instruction: ${step.tutorInstruction}` : ''
  const languageGuidance = languageGuidanceForPhase(mission.summary.phase, mission.summary.targetLevel)
  const stepGuidance = stepSpecificGuidance(step, mission.steps.length)

  return [
    'You are a Russian speaking coach for an Uzbek-speaking adult learner.',
    `Mission objective in Russian: ${mission.objectiveRu}`,
    `Mission objective in Uzbek: ${mission.summary.objectiveUz}`,
    `Current learner task in Russian: ${step?.promptRu ?? mission.summary.titleRu}`,
    `Current step number: ${step?.order ?? 1} of ${mission.steps.length}.`,
    promptUz,
    targetPhrases ? `Steer gently toward these target phrases: ${targetPhrases}` : '',
    acceptedAnswers,
    scoringRubric,
    tutorInstruction,
    `Learner phase: ${mission.summary.phase}.`,
    `Learner level: ${mission.summary.targetLevel}.`,
    ...languageGuidance,
    ...stepGuidance,
    'First check whether the learner answered the current question itself.',
    'If the learner answered the wrong question or missed a required detail, do not praise it as correct.',
    'In that case, explain briefly in Uzbek what was expected, give one short Russian model answer, and ask them to try again.',
    'After the learner speaks, reply very briefly and stop.',
    'Do not ask the next question, do not mention later steps, and do not combine multiple prompts.',
    'Stay only inside the current step and never advance the lesson on your own.',
    'Do not switch to unrelated topics.',
  ]
    .filter(Boolean)
    .join('\n')
}

function stepSpecificGuidance(
  step: MissionDetail['steps'][number] | undefined,
  totalSteps: number,
) {
  if (!step) {
    return [
      'Focus only on the current learner prompt.',
      'Do not introduce any other part of the lesson.',
    ]
  }

  if (step.kind === 'PhraseIntro') {
    return [
      `This is a phrase-practice step, not step 2-${totalSteps}.`,
      'Let the learner repeat one phrase or say one short example using the phrase.',
      'After one learner answer, acknowledge it briefly, give at most one tiny correction, and stop.',
      'Do not ask the remaining lesson questions.',
    ]
  }

  if (step.kind === 'ListenAndUnderstand') {
    return [
      'This is a listening-check step.',
      'Ask only about this one listening line and accept one short understanding answer.',
      'After one learner answer, confirm briefly and stop.',
      'Do not move into speaking turn, role play, recap, or any later question.',
    ]
  }

  if (step.kind === 'SpeakingTurn') {
    return [
      'This is one speaking answer only.',
      'Ask or support only the current speaking prompt.',
      'If the learner gives an off-topic answer, say it does not answer this question yet and ask for a retry.',
      'After one learner answer, respond briefly and stop.',
    ]
  }

  if (step.kind === 'RolePlay') {
    return [
      'Keep the role play to one short exchange only.',
      'Do not treat an off-topic answer as correct just to keep the conversation moving.',
      'Do not continue into additional questions after the learner answers once.',
      'After one brief in-character reply, stop.',
    ]
  }

  return [
    'This is a recap step.',
    'Accept one short learner answer or repetition, then stop.',
    'Do not open a new question after that.',
  ]
}

function languageGuidanceForPhase(phase: CoursePhase, targetLevel: MissionDetail['summary']['targetLevel']) {
  if (phase === 'Foundation') {
    return [
      'Use Uzbek as the main language for instructions, help, and corrections.',
      'Keep your Russian very short and simple, around beginner level.',
      'When you ask a question in Russian, immediately support it with one short Uzbek explanation.',
      'If the learner is confused, explain what they should say in Uzbek first, then model the Russian answer.',
      `The learner is a beginner (${targetLevel}), so do not stay in Russian only.`,
    ]
  }

  if (phase === 'Bridge') {
    return [
      'Use simple Russian first, but add one short Uzbek explanation when giving help or correction.',
      'Keep sentences short, clear, and slower than normal native speed.',
      'If the learner hesitates or misunderstands, switch briefly to Uzbek to unblock them, then return to Russian.',
    ]
  }

  return [
    'Use Russian first for the main interaction.',
    'Use Uzbek only when the learner is clearly confused, stuck, or explicitly asks for help.',
    'Keep the interaction natural, but still stay at the learner level.',
  ]
}

function InlineListenButton({
  active,
  loading,
  onClick,
}: {
  active: boolean
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "Eshitishni to'xtatish" : 'Eshitish'}
      className="flex size-12 shrink-0 items-center justify-center rounded-full border border-hairline bg-ground-raised text-ink transition hover:border-signal hover:text-signal-ink"
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
  onListenPhrase,
}: {
  phrases: MissionDetail['targetPhrases']
  promptAudioState: 'idle' | 'loading' | 'playing'
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
          <InlineListenButton
            active={promptAudioState === 'playing' && isPromptAudioPlaying(phrase.russian)}
            loading={promptAudioState === 'loading'}
            onClick={() => onListenPhrase(phrase.russian)}
          />
        </li>
      ))}
    </ul>
  )
}

function VoiceControls({
  state,
  degraded,
  assistantReply,
  transcript,
  onTranscript,
  onStart,
  onStop,
  onSubmit,
  busy,
  voiceComposerOpen,
  hasLiveSession,
  promptRu,
  feedback,
  isLastStep,
  onRetry,
  onAdvance,
}: {
  state: VoiceState
  degraded: string | null
  assistantReply: string | null
  transcript: string
  onTranscript: (value: string) => void
  onStart: () => void
  onStop: () => void
  onSubmit: () => void
  busy: boolean
  voiceComposerOpen: boolean
  hasLiveSession: boolean
  promptRu: string
  feedback: TurnFeedback | null
  isLastStep: boolean
  onRetry: () => void
  onAdvance: () => void
}) {
  if (state === 'feedback' && feedback) {
    return (
      <TurnFeedbackPanel
        feedback={feedback}
        onRetry={onRetry}
        onAdvance={onAdvance}
        isLastStep={isLastStep}
        busy={busy}
      />
    )
  }

  const showComposer =
    voiceComposerOpen || degraded !== null || transcript.trim().length > 0 || assistantReply !== null

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={busy}
          onClick={hasLiveSession ? onStop : onStart}
        >
          {state === 'thinking'
            ? 'Kutilmoqda...'
            : hasLiveSession
              ? 'Hozir yakunlash'
              : 'Javob berish'}
        </Button>

        <span className="text-sm text-ink-faint">
          {hasLiveSession
            ? "Avval gapiring, keyin 'Hozir yakunlash' ni bosib tahlilga yuboring"
            : 'Uzbekcha yordam yoqilgan'}
        </span>
      </div>

      {state === 'thinking' && (
        <div className="mt-7">
          <VoiceSignal state="thinking" />
        </div>
      )}

      {degraded && (
        <p className="text-support mt-5 rounded-xl bg-caution-soft px-4 py-3">{degraded}</p>
      )}

      {showComposer && (
        <div className="mt-6 max-w-xl">
          {assistantReply && (
            <div className="mb-4 rounded-xl bg-ground-sunken px-4 py-3">
              <p className="text-sm font-semibold text-ink-faint uppercase">Gemini javobi</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-base leading-relaxed text-ink">
                {assistantReply}
              </p>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Aytganingizni yozing</span>
            <textarea
              value={transcript}
              onChange={(event) => onTranscript(event.target.value)}
              rows={3}
              disabled={hasLiveSession}
              className="w-full rounded-xl border border-hairline bg-ground-raised px-4 py-3 text-base text-ink placeholder:text-ink-faint disabled:opacity-70"
              placeholder={promptRu}
            />
          </label>
          <Button
            size="lg"
            className="mt-3 w-full sm:w-auto"
            disabled={busy || hasLiveSession || !transcript.trim()}
            onClick={onSubmit}
          >
            Javobni yuborish
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Short in-mission feedback only: what went well, then one correction, then a retry that
 * carries no shaming language (PRD §6).
 */
function TurnFeedbackPanel({
  feedback,
  onRetry,
  onAdvance,
  isLastStep,
  busy,
}: {
  feedback: TurnFeedback
  onRetry: () => void
  onAdvance: () => void
  isLastStep: boolean
  busy: boolean
}) {
  const passed = feedback.score >= 70

  return (
    <div className="max-w-xl">
      <div className="rounded-xl bg-milestone-soft px-4 py-3">
        <p className="text-sm font-semibold text-milestone">Yaxshi tomoni</p>
        <p className="mt-1 text-base text-ink">{feedback.strengthNote}</p>
      </div>

      <div className="mt-3 rounded-xl bg-signal-soft px-4 py-3">
        <p className="text-sm font-semibold text-signal-ink">Bitta tuzatish</p>
        <p className="mt-1 text-base text-ink">{feedback.headlineCorrection}</p>
      </div>

      {!passed && (
        <div className="mt-3 rounded-xl bg-caution-soft px-4 py-3 text-ink">
          <p className="text-sm font-semibold text-ink">Yana bir urinamiz</p>
          <p className="mt-1 text-base">
            Hali javob to'liq o'tmadi. Mayli, yana bir marta aytamiz — bu safar sal chaqqonroq va aniqroq bo'lsin.
          </p>
        </div>
      )}

      {passed && isLastStep && (
        <div className="mt-3 rounded-xl bg-ground-sunken px-4 py-3 text-ink">
          <p className="text-sm font-semibold text-ink">Zo'r</p>
          <p className="mt-1 text-base">
            To'g'ri tushdi. Endi Gemini sizni ushlab o'tirmaydi — darsni chiroyli yopsa bo'ladi.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={onRetry} disabled={busy}>
          Yana bir marta
        </Button>
        {passed && (
          <Button size="lg" className="w-full sm:w-auto" onClick={onAdvance} disabled={busy}>
            {isLastStep ? 'Yakunlash' : 'Davom etish'}
          </Button>
        )}
      </div>
    </div>
  )
}
