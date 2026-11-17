import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Lightbulb, Play } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, ErrorNote, Spinner } from '../components/ui'
import { RussianText } from '../components/RussianText'
import { api, RequestError } from '../lib/api'
import { readAudioPreferences } from '../lib/audio-preferences'
import { characterName, characterPalette } from '../lib/character'
import { pickContent } from '../lib/content'
import { cx } from '../lib/cx'
import type { Mascot } from '../lib/foundation-lessons'
import { fill, useLocale, useT } from '../lib/i18n'
import { playPromptAudio, stopPromptAudio } from '../lib/liveVoice'
import { mascotAlt, mascotImage } from '../lib/mascot-images'
import { useAiAccess } from '../lib/plan'
import { playUiSound } from '../lib/ui-sounds'
import type { DialogueBeatView, MissionDetail, StartAttemptResponse, TurnFeedback } from '../lib/types'

/*
  A conversation mission for a learner on the plan without AI. The other plan talks to the
  character live; this one plays the same scene as a story: the character says a line, the
  learner picks the reply that fits, and the right reply moves the story on.

  Nothing new is written for it. A mission already lists its beats — what the character says
  and an answer that needs no correction — so the right reply is the author's own, and the
  wrong ones are the right replies to other beats of the same scene. The server grades each
  pick against the accepted answers (no model), exactly as it records a live turn, so progress,
  the pass mark and the result screen are the ones every mission uses.

  The older step-by-step missions are played the same way: each step's prompt is the line, and
  its first accepted answer the reply. Their own player is built around the live voice session.
*/

const MASCOT_BY_CHARACTER: Record<string, Mascot> = {
  Penguin: 'penguin',
  Panda: 'panda',
  Pero: 'pero',
}

interface StoryTurn {
  /** The beat's place in the mission, which is also its step index on the server. */
  step: number
  line: string
  hintUz?: string | null
  /** Empty for a closing line nobody has to answer. */
  options: string[]
  correct: number
}

/** The scene as lines and replies, from a conversation's beats or an older mission's steps. */
function sceneOf(mission: MissionDetail): DialogueBeatView[] {
  if (mission.dialogue) return mission.dialogue.beats
  return mission.steps.map((step, index) => ({
    order: index + 1,
    characterLine: step.promptRu,
    expectedAnswer: step.acceptedAnswers[0] ?? null,
    hintUz: step.promptUz,
  }))
}

function buildStory(beats: DialogueBeatView[], spare: string[]): StoryTurn[] {
  const answers = beats.map((beat) => beat.expectedAnswer?.trim()).filter((answer): answer is string => Boolean(answer))
  return beats.map((beat, step) => {
    const answer = beat.expectedAnswer?.trim()
    if (!answer) return { step, line: beat.characterLine, hintUz: beat.hintUz, options: [], correct: -1 }

    // The nearest other beats' answers first: they belong to the same scene, so they read as
    // things one could say here, and only one of them answers this line.
    const others = [...new Set([...answers.slice(step + 1), ...answers.slice(0, step).reverse(), ...spare])]
      .filter((text) => text !== answer)
      .slice(0, 2)
    const options = [answer, ...others]
    // Turned by the beat's position so the right reply is not always first — and is in the
    // same place when the learner comes back to the story.
    const shift = step % options.length
    const turned = [...options.slice(shift), ...options.slice(0, shift)]
    return { step, line: beat.characterLine, hintUz: beat.hintUz, options: turned, correct: turned.indexOf(answer) }
  })
}

export function MissionStory() {
  const { missionId } = useParams<{ missionId: string }>()
  const dictionary = useT()
  const t = dictionary.missionStory
  const { locale } = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { aiAccess, known } = useAiAccess()

  const { data: mission, isLoading } = useQuery({
    queryKey: ['mission-detail', missionId],
    queryFn: () => api.get<MissionDetail>(`/missions/${missionId}`),
    enabled: Boolean(missionId),
  })
  const { data: attempt, error: startError } = useQuery({
    queryKey: ['mission-story-attempt', missionId],
    queryFn: async () => {
      let started = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts`)
      if (started.requiresExplicitRestart) {
        started = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts?restart=true`)
      }
      return started
    },
    enabled: Boolean(missionId && mission && known && !aiAccess),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  })

  const story = useMemo(
    () => (mission ? buildStory(sceneOf(mission), mission.targetPhrases.map((phrase) => phrase.russian)) : []),
    [mission],
  )

  const [position, setPosition] = useState<number | null>(null)
  const [tried, setTried] = useState<number[]>([])
  const [solved, setSolved] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')
  const [finishing, setFinishing] = useState(false)
  /** Sound starts on its own only after the learner has tapped something in this visit. */
  const unlocked = useRef(false)
  const listEnd = useRef<HTMLDivElement>(null)

  // A story left half way opens where the server says the learner had got to.
  useEffect(() => {
    if (attempt && position === null) setPosition(Math.min(attempt.currentStepIndex, Math.max(story.length - 1, 0)))
  }, [attempt, position, story.length])

  const turn = position === null ? undefined : story[position]
  const character = mission?.dialogue?.character ?? 'None'
  const mascot = MASCOT_BY_CHARACTER[character]

  function say(text: string) {
    if (readAudioPreferences().muted) return
    // A line with no stored clip is read on the screen; nothing else speaks it.
    void playPromptAudio(text, { character: mascot }).catch(() => {})
  }

  useEffect(() => {
    if (turn && unlocked.current) say(turn.line)
    listEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    // The line is spoken when the story reaches it, not when anything else changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position])

  useEffect(() => stopPromptAudio, [])

  if (!missionId) return <Navigate to="/practice" replace />
  if (isLoading || !known) return <Spinner />
  // The story is this plan's version of the mission; everybody else has the live one.
  if (aiAccess) return <Navigate to={`/missions/${missionId}`} replace />
  if (!mission || story.length === 0) return <Navigate to="/practice" replace />
  // A conversation goes back to its brief; an older mission has no screen but this one.
  const leaveTo = mission.dialogue ? `/missions/${missionId}` : '/practice'
  if (startError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorNote>{startError instanceof RequestError ? startError.message : t.startFailed}</ErrorNote>
        <Button variant="secondary" onClick={() => navigate(leaveTo, { replace: true })}>{t.leave}</Button>
      </div>
    )
  }
  if (!attempt || position === null || !turn) return <Spinner />

  const palette = characterPalette(character)
  const name = characterName(character, dictionary)
  const last = position >= story.length - 1

  async function pick(option: number) {
    if (!turn || !attempt || solved || saving || tried.includes(option)) return
    unlocked.current = true
    if (option !== turn.correct) {
      playUiSound('wrong')
      setTried((current) => [...current, option])
      return
    }

    setSaving(true)
    setFailure('')
    try {
      await api.post<TurnFeedback>('/missions/attempts/turns', {
        attemptId: attempt.attemptId,
        stepIndex: turn.step,
        learnerTranscript: turn.options[option],
        tutorTranscript: turn.line,
        isRetry: false,
      })
      playUiSound('correct')
      setSolved(true)
    } catch (error) {
      setFailure(error instanceof RequestError ? error.message : t.failed)
    } finally {
      setSaving(false)
    }
  }

  async function advance() {
    if (!attempt) return
    unlocked.current = true
    if (!last) {
      setTried([])
      setSolved(false)
      setShowHint(false)
      setPosition((current) => (current ?? 0) + 1)
      return
    }

    setFinishing(true)
    setFailure('')
    try {
      await api.post(`/missions/attempts/${attempt.attemptId}/complete`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course-map'] }),
        queryClient.invalidateQueries({ queryKey: ['practice'] }),
        queryClient.invalidateQueries({ queryKey: ['mission-detail', missionId] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
      ])
      navigate(`/missions/attempts/${attempt.attemptId}/result`, { replace: true })
    } catch (error) {
      setFailure(error instanceof RequestError ? error.message : t.failed)
      setFinishing(false)
    }
  }

  const answerable = turn.options.length > 0
  const done = solved || !answerable

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <header className="flex items-center gap-3">
        {mascot && (
          <span className="grid size-12 shrink-0 place-items-center rounded-full" style={{ background: `${palette.light}26` }}>
            <img src={mascotImage(mascot)} alt={mascotAlt(mascot)} className="size-10" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {mission.dialogue && (
            <p className="text-xs font-extrabold tracking-[0.12em] uppercase" style={{ color: palette.deep }}>
              {fill(dictionary.missionBrief.storyEyebrow, { character: name })}
            </p>
          )}
          <h1 className="truncate text-lg font-extrabold text-ink">
            {pickContent(locale, { uz: mission.summary.titleUz, ru: mission.summary.titleRu, en: mission.summary.titleEn })}
          </h1>
        </div>
        <span className="shrink-0 rounded-[var(--radius-control)] bg-ground-sunken px-3 py-1 text-sm font-black tabular-nums text-ink-muted">
          {fill(t.progress, { n: position + 1, total: story.length })}
        </span>
      </header>

      <Card className="p-4 sm:p-5">
        {/* What has been said so far, so the learner reads the scene as one conversation. */}
        <ol className="grid gap-3">
          {story.slice(0, position).map((past) => (
            <li key={past.step} className="grid gap-2">
              <StoryLine mascot={mascot} text={past.line} />
              {past.options.length > 0 && <StoryReply text={past.options[past.correct]} />}
            </li>
          ))}
          <li className="grid gap-2">
            <StoryLine mascot={mascot} text={turn.line} onPlay={() => { unlocked.current = true; say(turn.line) }} playLabel={t.listen} lit />
            {solved && <StoryReply text={turn.options[turn.correct]} />}
          </li>
        </ol>
        <div ref={listEnd} />

        {answerable && !solved && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-extrabold tracking-[0.12em] text-ink-faint uppercase">{t.choose}</p>
              {turn.hintUz && (
                <button
                  type="button"
                  onClick={() => setShowHint((current) => !current)}
                  aria-pressed={showHint}
                  aria-label={t.hint}
                  title={t.hint}
                  className={cx('raised raised-sm flex size-9 items-center justify-center rounded-full border border-hairline', showHint ? 'bg-caution-soft text-caution' : 'bg-ground-raised text-ink-muted')}
                >
                  <Lightbulb aria-hidden="true" strokeWidth={2.2} className="size-4" />
                </button>
              )}
            </div>
            {showHint && turn.hintUz && <p className="mb-3 rounded-xl bg-ground-sunken p-3 text-sm text-ink-muted">{turn.hintUz}</p>}
            <div className="grid gap-2">
              {turn.options.map((option, index) => {
                const wrong = tried.includes(index)
                return (
                  <button
                    key={`${turn.step}-${index}`}
                    type="button"
                    disabled={wrong || saving}
                    onClick={() => void pick(index)}
                    className={cx(
                      'raised raised-sm rounded-2xl border-2 px-3.5 py-3 text-left text-sm leading-relaxed sm:text-base',
                      wrong
                        ? 'border-danger bg-danger-soft text-danger opacity-70'
                        : 'border-hairline bg-ground-raised text-ink hover:border-signal disabled:opacity-60',
                    )}
                  >
                    <RussianText text={option} />
                  </button>
                )
              })}
            </div>
            {tried.length > 0 && (
              <p role="status" className="mt-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">
                {fill(t.wrong, { character: name })}
              </p>
            )}
          </div>
        )}

        {failure && <div className="mt-3"><ErrorNote>{failure}</ErrorNote></div>}

        {done && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {solved
              ? (
                <p role="status" className="flex items-center gap-2 text-sm font-black text-milestone">
                  <Check aria-hidden="true" strokeWidth={3} className="size-4" /> {t.sayIt}
                </p>
              )
              : <span />}
            <Button disabled={finishing} onClick={() => void advance()}>
              {finishing ? t.finishing : last ? t.finish : t.next}
            </Button>
          </div>
        )}
      </Card>

      <div className="text-center">
        <Button variant="ghost" onClick={() => navigate(leaveTo, { replace: true })}>{t.leave}</Button>
      </div>
    </div>
  )
}

function StoryLine({ mascot, text, onPlay, playLabel, lit = false }: {
  mascot?: Mascot
  text: string
  onPlay?: () => void
  playLabel?: string
  lit?: boolean
}) {
  return (
    <div className="flex items-end gap-2">
      {mascot
        ? <img src={mascotImage(mascot)} alt="" className="size-10 shrink-0 object-contain sm:size-12" />
        : <span aria-hidden="true" className="size-10 shrink-0 sm:size-12" />}
      <div className={cx('min-w-0 max-w-[80%] rounded-2xl rounded-bl-md bg-ground-sunken px-3.5 py-2.5 text-sm leading-relaxed text-ink sm:text-base', lit && 'ring-2 ring-signal')}>
        <RussianText text={text} />
      </div>
      {onPlay && (
        <button
          type="button"
          onClick={onPlay}
          aria-label={playLabel}
          className="raised raised-sm flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-ground-raised text-ink-muted"
        >
          <Play aria-hidden="true" strokeWidth={2.4} className="size-4" />
        </button>
      )}
    </div>
  )
}

function StoryReply({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-signal-soft px-3.5 py-2.5 text-sm leading-relaxed text-ink sm:text-base">
        <RussianText text={text} />
      </div>
    </div>
  )
}
