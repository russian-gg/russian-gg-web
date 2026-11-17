import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Lightbulb, Volume2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, ErrorNote, Spinner } from '../components/ui'
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
  /** What the learner is writing, and why the last try was not taken. */
  const [draft, setDraft] = useState('')
  const [miss, setMiss] = useState<'wrong' | 'missing' | null>(null)
  /** The sentences the learner wrote, by turn: what the conversation shows as their side of it. */
  const [said, setSaid] = useState<Record<number, string>>({})
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

  /** Puts a helper phrase into the answer, where the learner goes on writing round it. */
  function addPhrase(phrase: string) {
    unlocked.current = true
    setMiss(null)
    setDraft((current) => (current.trim() ? `${current.trimEnd()} ${phrase}` : phrase))
  }

  /*
   * The answer is the learner's own sentence. It is right when it carries the phrase this turn
   * asks for — "Я из Ташкента" for «Я из» — which is the same rule the server scores it by.
   */
  async function submit() {
    if (!turn || !attempt || solved || saving) return
    unlocked.current = true
    const answer = draft.trim()
    if (!answer) return

    if (!carries(answer, turn.options[turn.correct])) {
      playUiSound('wrong')
      // A reply that belongs to another turn, or one with none of the phrases in it.
      setMiss(turn.options.some((option, index) => index !== turn.correct && carries(answer, option)) ? 'wrong' : 'missing')
      return
    }

    setSaving(true)
    setFailure('')
    setMiss(null)
    try {
      await api.post<TurnFeedback>('/missions/attempts/turns', {
        attemptId: attempt.attemptId,
        stepIndex: turn.step,
        learnerTranscript: answer,
        tutorTranscript: turn.line,
        isRetry: false,
      })
      playUiSound('correct')
      setSaid((current) => ({ ...current, [turn.step]: answer }))
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
      setDraft('')
      setMiss(null)
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
  const goal = mission.dialogue
    ? pickContent(locale, { uz: mission.dialogue.goalUz ?? mission.summary.objectiveUz, ru: mission.dialogue.goalRu ?? mission.summary.objectiveRu, en: mission.summary.objectiveEn })
    : pickContent(locale, { uz: mission.summary.objectiveUz, ru: mission.summary.objectiveRu, en: mission.summary.objectiveEn })

  return (
    /*
      The whole window is the scene, lit in the character's own colour the way the live
      conversation is: a small card at the top of a blank page read as a form, not as somebody
      talking to you.
    */
    <div
      className="flex min-h-dvh flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      style={{ background: `radial-gradient(115% 70% at 50% 12%, ${palette.light}26 0%, var(--color-ground-sunken) 60%)` }}
    >
      <header className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(leaveTo, { replace: true })}
          className="-ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> {t.leave}
        </button>
        {/* One segment per turn: how far through the scene, at a glance. */}
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={story.length}
          aria-valuenow={position + 1}
          aria-label={fill(t.progress, { n: position + 1, total: story.length })}
        >
          {story.map((step, index) => (
            <span
              key={step.step}
              className="h-2 flex-1 rounded-full transition-colors duration-300"
              style={{ background: index < position || (index === position && solved) ? palette.deep : index === position ? `${palette.light}80` : 'var(--color-hairline)' }}
            />
          ))}
        </div>
        <span className="shrink-0 text-sm font-black tabular-nums text-ink-muted">
          {fill(t.progress, { n: position + 1, total: story.length })}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 py-5">
        <div className="text-center">
          {mission.dialogue && (
            <p className="text-xs font-extrabold tracking-[0.14em] uppercase" style={{ color: palette.deep }}>
              {fill(dictionary.missionBrief.storyEyebrow, { character: name })}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">
            {pickContent(locale, { uz: mission.summary.titleUz, ru: mission.summary.titleRu, en: mission.summary.titleEn })}
          </h1>
          {goal && <p className="mx-auto mt-1 max-w-xl text-sm leading-relaxed text-ink-muted">{goal}</p>}
        </div>

        {/*
          What has been said so far. Smaller than the line being answered, but at full strength:
          faded, the finished turns looked blurred, and they are what the learner reads back.
        */}
        {position > 0 && (
          <ol className="grid gap-2">
            {story.slice(Math.max(0, position - 2), position).map((past) => (
              <li key={past.step} className="grid gap-1.5">
                <PastLine text={past.line} />
                {past.options.length > 0 && <PastLine text={said[past.step] ?? asReply(past.options[past.correct])} mine />}
              </li>
            ))}
          </ol>
        )}

        {/* The character, large, saying the line: the one thing on the screen to answer. */}
        <section className="flex items-end gap-3 sm:gap-4">
          {mascot ? (
            <span
              className="grid size-20 shrink-0 place-items-center rounded-full sm:size-28"
              style={{ background: `${palette.light}26`, boxShadow: `inset 0 0 0 2px ${palette.light}55` }}
            >
              <img src={mascotImage(mascot)} alt={mascotAlt(mascot)} className="size-16 object-contain sm:size-24" />
            </span>
          ) : null}
          <div className="relative min-w-0 flex-1 rounded-3xl rounded-bl-lg border-2 bg-ground-raised px-5 py-4 shadow-[0_12px_32px_-18px_rgb(17_24_39/0.35)]" style={{ borderColor: `${palette.light}66` }}>
            <p className={cx(turn.hintUz ? "pr-24" : "pr-12", "text-xl leading-snug font-bold text-ink sm:text-2xl")}>
              <RussianText text={turn.line} />
            </p>
            {showHint && turn.hintUz && <p className="mt-2 border-t border-hairline pt-2 text-sm leading-relaxed text-ink-muted">{turn.hintUz}</p>}
            <div className="absolute top-3 right-3 flex gap-1.5">
              <button
                type="button"
                onClick={() => { unlocked.current = true; say(turn.line) }}
                aria-label={t.listen}
                title={t.listen}
                className="raised raised-sm flex size-9 items-center justify-center rounded-full text-white"
                style={{ background: palette.deep }}
              >
                <Volume2 aria-hidden="true" strokeWidth={2.2} className="size-4" />
              </button>
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
          </div>
        </section>

        {/*
          The learner's side of the turn is a sentence they write. The phrases under the box are
          the lesson's own: one of them belongs in this answer, and tapping it puts it in — so a
          learner with no Russian keyboard can still answer, and one with a keyboard writes the
          whole sentence round it.
        */}
        {answerable && !solved && (
          <section className="rounded-3xl border-2 border-hairline bg-ground-raised p-4 shadow-[0_12px_32px_-22px_rgb(17_24_39/0.35)] sm:p-5">
            <label htmlFor="story-answer" className="block text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">
              {t.write}
            </label>
            <input
              id="story-answer"
              lang="ru"
              value={draft}
              onChange={(event) => { setDraft(event.target.value); setMiss(null) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit()
              }}
              placeholder={t.placeholder}
              autoComplete="off"
              autoCapitalize="sentences"
              className={cx(
                'mt-2 h-14 w-full rounded-2xl border-2 bg-ground px-4 text-lg font-bold text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none sm:text-xl',
                miss ? 'border-danger' : 'border-hairline focus:border-signal',
              )}
            />
            {miss && (
              <p role="status" className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
                {miss === 'wrong' ? fill(t.wrong, { character: name }) : t.missing}
              </p>
            )}

            <p className="mt-4 text-xs font-bold text-ink-muted">{t.helpers}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {turn.options.map((option, index) => (
                <button
                  key={`${turn.step}-${index}`}
                  type="button"
                  disabled={saving}
                  onClick={() => addPhrase(option)}
                  className="raised raised-sm rounded-xl border-2 border-hairline bg-ground-raised px-3.5 py-2 text-base font-bold text-ink hover:border-signal disabled:opacity-60"
                >
                  <RussianText text={option} />
                </button>
              ))}
            </div>
          </section>
        )}

        {solved && (
          <section className="flex justify-end">
            <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-milestone-soft px-5 py-4 text-right">
              <p className="text-xl leading-snug font-bold text-ink sm:text-2xl"><RussianText text={said[turn.step] ?? asReply(turn.options[turn.correct])} /></p>
              <p role="status" className="mt-2 flex items-center justify-end gap-1.5 text-sm font-black text-milestone">
                <Check aria-hidden="true" strokeWidth={3} className="size-4" /> {t.sayIt}
              </p>
            </div>
          </section>
        )}

        {failure && <ErrorNote>{failure}</ErrorNote>}
        <div ref={listEnd} />
      </main>

      {/* The way on sits at the bottom of the window, where the thumb is. */}
      <footer className="mx-auto w-full max-w-3xl">
        {done ? (
          <Button block size="lg" disabled={finishing} onClick={() => void advance()}>
            {finishing ? t.finishing : last ? t.finish : t.next}
          </Button>
        ) : (
          <Button block size="lg" disabled={!draft.trim() || saving} onClick={() => void submit()}>
            {t.send}
          </Button>
        )}
      </footer>
    </div>
  )
}

/** Case, ё/е and punctuation are not what is being checked — the same reading the server gives. */
function normalise(text: string) {
  return text
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s-]+/gu, ' ')
    .trim()
}

/** Whether a written answer has the phrase in it, as whole words. */
function carries(answer: string, phrase: string) {
  const wanted = normalise(phrase)
  return wanted.length > 0 && ` ${normalise(answer)} `.includes(` ${wanted} `)
}

/**
 * Many accepted answers are the start of a sentence the learner finishes about themselves
 * ("Я из", "Меня зовут"). Shown bare they look cut off, so an unfinished one trails off.
 */
function asReply(text: string) {
  return /[.!?…]$/u.test(text.trim()) ? text : `${text.trim()}…`
}

/** A line already said: the character's on the left, the learner's on the right. */
function PastLine({ text, mine = false }: { text: string; mine?: boolean }) {
  return (
    <div className={cx('flex', mine && 'justify-end')}>
      <div className={cx('max-w-[80%] rounded-2xl border px-3.5 py-2 text-base leading-relaxed font-semibold text-ink', mine ? 'rounded-br-md border-milestone/25 bg-milestone-soft' : 'rounded-bl-md border-hairline bg-ground-raised')}>
        <RussianText text={text} />
      </div>
    </div>
  )
}
