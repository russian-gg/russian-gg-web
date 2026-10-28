import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  Gamepad2,
  Image,
  Layers,
  MessagesSquare,
  Mic,
  PenLine,
  Repeat2,
  SpellCheck,
  Square,
  Sunrise,
  Trophy,
  Landmark,
  Package,
  PartyPopper,
  Play,
  ShoppingBag,
  Turtle,
  Users,
  Zap,
} from 'lucide-react'
import {
  bagFallbackIcon,
  bagItemIcons,
  cityFallbackIcon,
  cityPlaceIcons,
  pictureSceneIcons,
  roomObjectIcons,
  roomSlotIcons,
} from '../lib/lesson-icons'
import { fill, useLocale, useT, type Dictionary, type Locale } from '../lib/i18n'

const SPEECH_TAG: Record<Locale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' }
import { useFocusTrap } from '../lib/focus-trap'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, ErrorNote, LinkButton, PauseGlyph, PlayGlyph, ProgressBar, Spinner } from '../components/ui'
import { ColorScopeProvider, RussianText } from '../components/RussianText'
import { readAudioPreferences } from '../lib/audio-preferences'
import { useAuth } from '../lib/auth-context'
import { cx } from '../lib/cx'
import { foundationLessons, type LessonData, type Mascot, type Phrase, type Quiz, type Vocab } from '../lib/foundation-lessons'
import { mascotAlt, mascotImage } from '../lib/mascot-images'
import { foundationLessonStorageKey } from '../lib/demo-lesson-one'
import { syncLessonOneCompletion } from '../lib/lesson-one-sync'
import { api, RequestError } from '../lib/api'
import { pausePromptAudio, playPromptAudio, prefetchPromptAudio, resumePromptAudio, VoiceError } from '../lib/liveVoice'
import { playUiSound } from '../lib/ui-sounds'
import { celebrate } from '../lib/celebrate'
import { Celebration } from '../components/Celebration'
import { missionLock } from '../lib/mission-lock'
import type { EntitlementView, MissionSummary, StartAttemptResponse, VoiceNoteTurnFeedback } from '../lib/types'

/**
 * The nine steps, in order, each with the mark that stands for it. The names themselves are copy
 * and live at `t.lesson.sections[id]`, keyed by the same id; the icon is here because it is not
 * copy — it says the same thing in Uzbek, Russian and English, and it is what a learner picks the
 * step out by once they have been through a few lessons.
 */
const sections = [
  { id: 'tests', icon: Sunrise },
  { id: 'phonetics', icon: AudioLines },
  { id: 'grammar', icon: SpellCheck },
  { id: 'phrases', icon: Repeat2 },
  { id: 'game', icon: Gamepad2 },
  { id: 'missions', icon: MessagesSquare },
  { id: 'vocabulary', icon: Layers },
  { id: 'picture', icon: PenLine },
  { id: 'complete', icon: Trophy },
] as const

type SectionId = (typeof sections)[number]['id']

/**
 * Every section that sets a task has to be finished before the lesson moves on — clicking past
 * the work was how a learner could reach the closing card having done none of it.
 *
 * Two sections deliberately stay open. The phonetics and grammar blocks are reading, with no
 * answer to check. The dialogue block only asks that a mode be opened: its recording needs a
 * microphone and the voice backend, and a learner whose mic is refused must still be able to
 * finish the day rather than be sealed in mid-lesson.
 */
function sectionBlockReason(
  sectionId: SectionId,
  lesson: LessonData,
  state: StoredState,
  gate: Dictionary['lesson']['gate'],
): string | null {
  switch (sectionId) {
    case 'tests':
      return lesson.tests.every((quiz, index) => state.answers[index] === quiz.correct)
        ? null
        : gate.tests
    case 'phrases':
      return Object.keys(state.phraseRatings).length >= lesson.phrases.length ? null : gate.phrases
    case 'game':
      return isGameSolved(lesson, state.gameMatches) ? null : gate.game
    case 'missions':
      // Two steps, in order: read the dialogue through, then answer the AI questions aloud.
      // Opening the question screen used to be enough, so the speaking half could be skipped
      // without the learner noticing. Now it counts answers — or an explicit "without the
      // microphone", for a learner whose microphone is refused.
      if (!state.dialoguePractised) return gate.dialogue
      if (!state.aiChatStarted) return gate.aiChat
      return state.aiAnswered.length >= aiAnswerTarget(lesson.questions.length) || state.aiSkipped
        ? null
        : fill(gate.aiAnswers, { count: aiAnswerTarget(lesson.questions.length) })
    case 'vocabulary':
      return state.vocabularyReviewed >= vocabularyTarget(lesson.vocabulary.length)
        ? null
        : fill(gate.vocabulary, { count: vocabularyTarget(lesson.vocabulary.length) })
    case 'picture':
      return isExerciseAnswered(lesson.exercise.starter, state.exerciseAnswer) ? null : gate.picture
    default:
      return null
  }
}

/**
 * A run of 3+ underscores in an exercise starter marks a fill-in-the-blank slot, rendered as its
 * own inline <input> rather than left as literal underscores for the learner to type over. Each
 * blank's value is joined with this separator into the single string the rest of the app (state,
 * localStorage) already expects — a character no keyboard produces, so it can't collide with
 * anything a learner actually types.
 */
const BLANK_DELIMITER = '\0'

function splitBlankSegments(starter: string): string[] {
  return starter.split(/_{3,}/)
}

// A learner who typed into the pre-blanks version of this exercise (a single textarea seeded
// with the whole "_________"-laden template) could have that entire sentence saved as their
// answer. Splitting it on the delimiter dumps it into blank 0 — so any stored value that still
// contains an underscore run is stale, not a real answer, and every reader of blank values drops it.
function readBlankValues(answer: string): string[] {
  return answer.split(BLANK_DELIMITER).map((value) => (/_{3,}/.test(value) ? '' : value))
}

function fillTemplate(segments: string[], answer: string): string {
  if (segments.length === 1) return answer
  const values = readBlankValues(answer)
  return segments.map((segment, index) => segment + (index < segments.length - 1 ? (values[index] ?? '') : '')).join('')
}

/**
 * A written answer counts only once it has Russian in it: a single Latin letter used to unlock
 * the step, so the writing task could be skipped by typing anything at all.
 */
function hasRussian(text: string): boolean {
  return /[А-Яа-яЁё]/u.test(text)
}

function blankAnswers(starter: string, answer: string): string[] {
  const segments = splitBlankSegments(starter)
  if (segments.length === 1) return [answer]
  const values = readBlankValues(answer)
  return segments.slice(0, -1).map((_, index) => values[index] ?? '')
}

function isExerciseAnswered(starter: string, answer: string): boolean {
  return blankAnswers(starter, answer).every((value) => hasRussian(value))
}

/** How many of the game's items are solved, out of how many — the one counter every game shows. */
function gameProgress(lesson: LessonData, matches: Record<string, string>): { done: number; total: number } {
  if (lesson.game.kind === 'family-crossword') {
    const clues = lesson.game.clues ?? []
    return { done: clues.filter((clue) => matches[clue.answer] === clue.answer).length, total: clues.length }
  }
  // The picture game stores a free-text description rather than a fixed right-hand value.
  if (lesson.game.kind === 'picture-description') {
    return { done: lesson.game.pairs.filter((pair) => hasRussian(matches[pair.left] ?? '')).length, total: lesson.game.pairs.length }
  }
  return { done: lesson.game.pairs.filter((pair) => matches[pair.left] === pair.right).length, total: lesson.game.pairs.length }
}

function isGameSolved(lesson: LessonData, matches: Record<string, string>): boolean {
  const { done, total } = gameProgress(lesson, matches)
  return done >= total
}

/**
 * How far the learner is through what blocks Next, shown on the button itself: a faded button
 * with the reason in small print far below it read as a broken page. Null where the step has no
 * count to give.
 */
function gateProgress(sectionId: SectionId, lesson: LessonData, state: StoredState): { done: number; total: number } | null {
  switch (sectionId) {
    case 'tests':
      return { done: lesson.tests.filter((quiz, index) => state.answers[index] === quiz.correct).length, total: lesson.tests.length }
    case 'phrases':
      return { done: Object.keys(state.phraseRatings).length, total: lesson.phrases.length }
    case 'game':
      return gameProgress(lesson, state.gameMatches)
    case 'missions':
      return state.aiChatStarted
        ? { done: Math.min(state.aiAnswered.length, aiAnswerTarget(lesson.questions.length)), total: aiAnswerTarget(lesson.questions.length) }
        : null
    case 'vocabulary':
      return { done: Math.min(state.vocabularyReviewed, vocabularyTarget(lesson.vocabulary.length)), total: vocabularyTarget(lesson.vocabulary.length) }
    case 'picture': {
      const blanks = blankAnswers(lesson.exercise.starter, state.exerciseAnswer)
      return blanks.length > 1 ? { done: blanks.filter(hasRussian).length, total: blanks.length } : null
    }
    default:
      return null
  }
}

/**
 * A fixed shuffle, seeded by the lesson day: the order stays the same between visits, but it is
 * never the authored order — sorting the answers alphabetically lined them up with their words
 * whenever an author had listed the pairs alphabetically.
 */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let state = seed * 2654435761 >>> 0
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  // A shuffle that happens to land every item back in place teaches nothing; rotate it once.
  if (result.length > 1 && result.every((item, index) => item === items[index])) result.push(result.shift()!)
  return result
}

/**
 * Columns and rows for a cover grid with exactly one tile per item. The grids used to be fixed
 * at 3×2 and 2×5, so a lesson with another count left tiles that never opened.
 */
function coverGrid(count: number): { columns: number; rows: number } {
  const root = Math.ceil(Math.sqrt(count))
  for (let columns = root; columns >= 2; columns -= 1) {
    if (count % columns === 0) return { columns, rows: count / columns }
  }
  return { columns: root, rows: Math.ceil(count / root) }
}

/** Three choices for the item in hand: its answer and two others, taken from the whole game. */
function threeOptions(pairs: LessonData['game']['pairs'], current: LessonData['game']['pairs'][number]): string[] {
  const start = pairs.indexOf(current)
  const others = pairs
    .map((_, offset) => pairs[(start + 1 + offset) % pairs.length])
    .filter((pair) => pair !== current && pair.right !== current.right)
    .map((pair) => pair.right)
  const distractors = [...new Set(others)].slice(0, 2)
  return [current.right, ...distractors].sort((a, b) => a.localeCompare(b, 'ru'))
}
type StoredState = {
  sectionIndex: number
  completed: SectionId[]
  answers: Array<number | null>
  phraseRatings: Record<number, Rating>
  gameMatches: Record<string, string>
  exerciseAnswer: string
  /** Dialogue block, step 1: the learner has read the whole dialogue through. */
  dialoguePractised: boolean
  /** Dialogue block, step 2: the learner has moved on to the AI conversation. */
  aiChatStarted: boolean
  /** The AI questions answered aloud, by index. */
  aiAnswered: number[]
  /** The learner chose to go on without the microphone. */
  aiSkipped: boolean
  /** How far into the word deck the learner has got — also where reopening resumes. */
  vocabularyReviewed: number
}
type Rating = 'known' | 'unknown' | 'repeat'

const emptyState: StoredState = {
  sectionIndex: 0,
  completed: [],
  answers: [null, null],
  phraseRatings: {},
  gameMatches: {},
  exerciseAnswer: '',
  dialoguePractised: false,
  aiChatStarted: false,
  aiAnswered: [],
  aiSkipped: false,
  vocabularyReviewed: 0,
}

/** Enough spoken answers to have practised, without making a learner answer every question. */
const AI_ANSWER_TARGET = 3

function aiAnswerTarget(questionCount: number) {
  return Math.min(AI_ANSWER_TARGET, questionCount)
}

/** Enough cards to have actually studied, without forcing the whole deck in one sitting. */
const VOCABULARY_REVIEW_TARGET = 5

function vocabularyTarget(wordCount: number) {
  return Math.min(VOCABULARY_REVIEW_TARGET, wordCount)
}

export function FoundationLesson() {
  const t = useT().lesson
  const { day: dayParam, missionId } = useParams<{ day: string; missionId: string }>()
  const day = Number(dayParam)
  const lesson = foundationLessons[day]
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const storageKey = user && lesson
    ? foundationLessonStorageKey(user.id, day)
    : null
  const [state, setState] = useState<StoredState>(() => readState(storageKey))
  const skipSave = useRef(searchParams.get('start') === '1')

  const restartRequested = searchParams.get('start') === '1'
  useEffect(() => {
    const nextState = restartRequested ? { ...emptyState } : readState(storageKey)
    if (restartRequested) skipSave.current = true
    if (restartRequested && storageKey) localStorage.setItem(storageKey, JSON.stringify(nextState))
    setState(nextState)
    if (restartRequested) setSearchParams({}, { replace: true })
  }, [restartRequested, setSearchParams, storageKey])
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state, storageKey])

  const active = sections[state.sectionIndex] ?? sections[0]
  const progress = state.completed.length
  const blockReason = lesson ? sectionBlockReason(active.id, lesson, state, t.gate) : null
  const canContinue = blockReason === null
  const blockProgress = lesson && blockReason ? gateProgress(active.id, lesson, state) : null

  /*
   * A new step is announced from its heading. The page scrolled to the top but focus stayed on
   * the Next button at the bottom, so a keyboard or screen-reader learner never heard the step
   * change. The first render is left alone: focus belongs to whatever opened the lesson.
   */
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    headingRef.current?.focus({ preventScroll: true })
  }, [state.sectionIndex])
  const sectionRef = useRef<HTMLElement>(null)

  /*
   * The lessons ship with the app, so the route alone opened any of them — a free learner could
   * type /lessons/5/x, or follow the Home banner past a "Pro kerak" card, and only meet the
   * paywall as a server error at the speaking step. The day's missions say whether this one is
   * open; a locked one goes to the path, where the lock explains itself.
   */
  const { data: dayMissions, isLoading: checkingAccess } = useQuery({
    queryKey: ['day-missions', day],
    queryFn: () => api.get<MissionSummary[]>(`/course/days/${day}/missions`),
    enabled: Boolean(lesson),
    staleTime: 60_000,
  })
  const thisMission = dayMissions?.find((mission) => mission.id === missionId) ?? dayMissions?.[0]
  const lock = thisMission ? missionLock(thisMission) : null

  /*
   * The lesson is recorded when the closing card appears, not when its button is pressed: the
   * card says "done", and a learner who closed the tab on it was left at eight of nine.
   */
  const [recording, setRecording] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const onCompleteCard = active.id === 'complete'
  useEffect(() => {
    if (!onCompleteCard || recording !== 'idle') return
    void recordCompletion()
    // recordCompletion reads only the mission and the query client, both fixed for this lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCompleteCard, recording])

  if (!lesson) return <Navigate to="/path" replace />
  if (lock) return <Navigate to={`/path?locked=${day}&kind=${lock}`} replace />
  if (checkingAccess) return <Spinner />

  async function recordCompletion() {
    // Already on the server — a finished lesson opened again — so nothing new to record.
    if (!missionId || thisMission?.isCompleted) {
      setRecording('saved')
      return
    }
    setRecording('saving')
    try {
      await syncLessonOneCompletion(missionId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course-map'] }),
        queryClient.invalidateQueries({ queryKey: ['progress'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['entitlement'] }),
      ])
      setRecording('saved')
    } catch {
      // Local progress is kept; the card says it was not saved and offers to try again.
      setRecording('failed')
    }
  }

  async function finishCurrent() {
    // Reaching the closing card finishes it too: the card is the lesson's result, not a task.
    const reached = active.id === 'picture' ? [active.id, 'complete' as const] : [active.id]
    const completed = [...state.completed, ...reached.filter((id) => !state.completed.includes(id))]
    const nextIndex = Math.min(state.sectionIndex + 1, sections.length - 1)
    setState((current) => ({ ...current, completed, sectionIndex: nextIndex }))
    window.scrollTo({ top: 0, behavior: 'smooth' })

    if (active.id === 'complete') navigate('/path', { replace: true })
  }

  function goBack() {
    jumpTo(Math.max(0, state.sectionIndex - 1))
  }

  function jumpTo(index: number) {
    setState((current) => ({ ...current, sectionIndex: index }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /*
   * The step's own instruction, where it has one worth a line. Every step used to carry a
   * general note here ("15 ta ibora — gif, tarjima…", "Mavzu bo‘yicha yangi o‘yin") that only
   * described what was already on the screen below it.
   */
  const stepInstruction = active.id === 'missions'
    ? (state.aiChatStarted ? t.missions.aiIntro : t.missions.intro)
    : null

  return (
    <ColorScopeProvider day={day}>
    <div className="foundation-lesson mx-auto max-w-4xl space-y-4 pb-5 sm:space-y-6">
      <LessonHero
        lesson={lesson}
        progress={progress}
        compact={state.sectionIndex > 0}
        state={state}
        onJump={jumpTo}
      />

      <section ref={sectionRef} aria-labelledby={`section-${active.id}`} className="scroll-mt-4">
        <div className={cx('mb-3 flex gap-3 sm:mb-4', stepInstruction ? 'items-start' : 'items-center')}>
          {/*
            Filled rather than tinted: this header sits on the page background, not on a card, and
            `signal-soft` on `ground` is two pale greys apart — the tile disappeared and took the
            mark with it.
          */}
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-signal text-on-signal shadow-[0_6px_16px_rgb(31_111_224/0.25)] sm:size-14">
            <active.icon aria-hidden="true" strokeWidth={1.9} className="size-6 sm:size-7" />
          </span>
          <div className="min-w-0">
            <h2
              ref={headingRef}
              tabIndex={-1}
              id={`section-${active.id}`}
              className="text-xl font-black tracking-tight text-ink outline-none sm:text-2xl"
            >
              {t.sections[active.id]}
            </h2>
            {stepInstruction && <p className="mt-0.5 text-sm leading-snug text-ink-muted">{stepInstruction}</p>}
          </div>
        </div>

        {active.id === 'tests' && (
          <TestsSection lesson={lesson} answers={state.answers} onAnswer={(index, answer) => {
            setState((current) => {
              const answers = [...current.answers]
              answers[index] = answer
              return { ...current, answers }
            })
          }} />
        )}
        {active.id === 'phonetics' && <RuleSection rule={lesson.phonetics} />}
        {active.id === 'grammar' && <RuleSection rule={lesson.grammar} genderStory={day === 1} />}
        {active.id === 'phrases' && (
          <PhrasesSection phrases={lesson.phrases} ratings={state.phraseRatings} onRate={(index, rating) => {
            setState((current) => ({ ...current, phraseRatings: { ...current.phraseRatings, [index]: rating } }))
          }} />
        )}
        {active.id === 'game' && (
          <GameStage lesson={lesson} matches={state.gameMatches}>
          {lesson.game.kind === 'picture-description'
            ? <PictureDescriptionGame lesson={lesson} matches={state.gameMatches} onChange={(gameMatches) => {
                setState((current) => ({ ...current, gameMatches }))
              }} />
          : lesson.game.kind === 'city-map'
            ? <CityMapGame lesson={lesson} matches={state.gameMatches} onChange={(gameMatches) => {
                setState((current) => ({ ...current, gameMatches }))
              }} />
            : lesson.game.kind === 'missing-bag'
            ? <MissingBagGame lesson={lesson} matches={state.gameMatches} onChange={(gameMatches) => {
                setState((current) => ({ ...current, gameMatches }))
              }} />
            : lesson.game.kind === 'plural-puzzle'
            ? <PluralPuzzle lesson={lesson} matches={state.gameMatches} onChange={(gameMatches) => {
                setState((current) => ({ ...current, gameMatches }))
              }} />
            : lesson.game.kind === 'room-builder'
              ? <RoomBuilder lesson={lesson} matches={state.gameMatches} onChange={(gameMatches) => {
                  setState((current) => ({ ...current, gameMatches }))
                }} />
            : lesson.game.kind === 'family-crossword'
            ? <FamilyCrossword lesson={lesson} matches={state.gameMatches} onChange={(gameMatches) => {
                setState((current) => ({ ...current, gameMatches }))
              }} />
            : lesson.game.kind === 'gender-houses'
              ? <GenderHouseGame lesson={lesson} matches={state.gameMatches} onChange={(gameMatches) => {
                  setState((current) => ({ ...current, gameMatches }))
                }} />
            : <MatchingGame lesson={lesson} matches={state.gameMatches} onChange={(gameMatches) => {
                setState((current) => ({ ...current, gameMatches }))
              }} />}
          </GameStage>
        )}
        {active.id === 'missions' && (
          <MissionModes
            lesson={lesson}
            missionId={missionId}
            dialoguePractised={state.dialoguePractised}
            aiChatStarted={state.aiChatStarted}
            aiAnswered={state.aiAnswered}
            aiSkipped={state.aiSkipped}
            onDialoguePractised={() => setState((current) => ({ ...current, dialoguePractised: true }))}
            onAiChatStarted={() => setState((current) => ({ ...current, aiChatStarted: true }))}
            onAiAnswered={(index) => setState((current) => ({
              ...current,
              aiAnswered: current.aiAnswered.includes(index) ? current.aiAnswered : [...current.aiAnswered, index],
            }))}
            onAiSkipped={() => setState((current) => ({ ...current, aiSkipped: true }))}
          />
        )}
        {active.id === 'vocabulary' && (
          <VocabularySection
            words={lesson.vocabulary}
            reviewed={state.vocabularyReviewed}
            onReviewed={(count) => setState((current) => ({
              ...current,
              // A second pass through the deck must never walk the count backwards.
              vocabularyReviewed: Math.max(current.vocabularyReviewed, count),
            }))}
          />
        )}
        {active.id === 'picture' && (
          <ExerciseSection
            lesson={lesson}
            answer={state.exerciseAnswer}
            onAnswerChange={(exerciseAnswer) => setState((current) => ({ ...current, exerciseAnswer }))}
          />
        )}
        {active.id === 'complete' && (
          <CompleteSection lesson={lesson} recording={recording} />
        )}
      </section>

      <div className="space-y-3 border-t border-hairline pt-4">
        {/*
          A disabled button with no reason next to it reads as a broken page — and the reason in
          small grey print under it was easy to miss. It sits above the buttons now, in the
          caution tone, with a way back up to the task.
        */}
        {blockReason && (
          <p role="status" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl bg-caution-soft px-3 py-2 text-sm font-bold text-caution">
            <span>{blockReason}</span>
            <button
              type="button"
              onClick={() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="font-black underline"
            >
              {t.showTask}
            </button>
          </p>
        )}
        {/* Wraps rather than overflowing: on a 320px phone the last step's two labels fill the row. */}
        <div className="flex flex-wrap items-center gap-2">
          {active.id === 'complete' && recording === 'failed' ? (
            <>
              {/* A failed save leads with saving again; leaving is still possible, just not first. */}
              <Button variant="ghost" onClick={() => void finishCurrent()}>{t.finishAnyway}</Button>
              <Button className="ml-auto" onClick={() => void recordCompletion()}>{t.complete.saveRetry}</Button>
            </>
          ) : (
            <>
              {state.sectionIndex > 0 && <Button variant="ghost" onClick={goBack}>{t.back}</Button>}
              <Button
                className="ml-auto"
                disabled={!canContinue || (active.id === 'complete' && recording === 'saving')}
                onClick={() => void finishCurrent()}
              >
                {active.id === 'complete'
                  ? recording === 'saving' ? t.saving : t.finishLesson
                  : t.next}
                {blockProgress && (
                  <span className="ml-1.5 rounded-full bg-on-signal/20 px-2 text-xs tabular-nums">
                    {blockProgress.done}/{blockProgress.total}
                  </span>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
    </ColorScopeProvider>
  )
}

function LessonHero({ lesson, progress, compact, state, onJump }: {
  lesson: LessonData
  progress: number
  compact: boolean
  state: StoredState
  onJump: (index: number) => void
}) {
  const t = useT().lesson
  return (
    <Card className={cx('lesson-hero p-4 sm:p-6', compact && 'py-3 sm:py-4')}>
      {compact ? (
        // Past the first step the hero shrinks, but the day and its title stay: the bar alone
        // left the learner with no idea which lesson they were in.
        <p className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="shrink-0 text-xs font-black tracking-[.12em] text-signal-ink uppercase">{fill(t.eyebrow, { day: lesson.day })}</span>
          <span className="truncate font-black text-ink"><RussianText text={lesson.titleRu} /></span>
        </p>
      ) : <>
        <p className="text-xs font-black tracking-[.16em] text-signal-ink uppercase">{fill(t.eyebrow, { day: lesson.day })}</p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-ink sm:text-4xl"><RussianText text={lesson.titleRu} /></h1>
        <p className="mt-1 text-sm text-ink-muted sm:text-base">{lesson.titleUz}</p>
      </>}
      {/* The bar is plainly progress, so it carries no label of its own — only its count. */}
      <div className={cx('flex items-center gap-3', compact ? 'mt-2' : 'mt-4')}>
        <div className="min-w-0 flex-1"><ProgressBar value={progress} max={sections.length} label={t.progress} /></div>
        <span className="shrink-0 text-xs font-black text-ink-faint tabular-nums sm:text-sm">{progress} / {sections.length}</span>
      </div>
      <StepMap state={state} onJump={onJump} />
    </Card>
  )
}

/**
 * The nine steps as a row of marks: done, current, and still shut. Back and Next were the only
 * way around the lesson, so revisiting the phrases from the word deck took four presses, and
 * nothing showed what was still ahead. A finished step can be reopened; a later one opens only
 * once the steps before it are done, the same rule Next follows.
 */
function StepMap({ state, onJump }: { state: StoredState; onJump: (index: number) => void }) {
  const t = useT().lesson
  const reached = Math.max(
    state.sectionIndex,
    ...state.completed.map((id) => sections.findIndex((section) => section.id === id) + 1),
  )
  return (
    <nav aria-label={t.stepMap} className="mt-3">
      <ol className="grid grid-cols-9 gap-1 sm:gap-2">
        {sections.map((section, index) => {
          const current = index === state.sectionIndex
          const done = state.completed.includes(section.id)
          const open = index <= reached
          return (
            <li key={section.id} className="flex justify-center">
              <button
                type="button"
                disabled={!open || current}
                onClick={() => onJump(index)}
                aria-current={current ? 'step' : undefined}
                aria-label={`${index + 1}. ${t.sections[section.id]}`}
                title={t.sections[section.id]}
                className={cx(
                  'flex size-7 items-center justify-center rounded-lg transition sm:size-9 sm:rounded-xl',
                  current
                    ? 'bg-signal text-on-signal ring-3 ring-signal-soft'
                    : done
                      ? 'bg-milestone-soft text-milestone hover:ring-2 hover:ring-milestone/40'
                      : open
                        ? 'bg-ground-sunken text-ink-muted hover:text-ink'
                        : 'bg-ground-sunken text-ink-faint opacity-50',
                )}
              >
                {done && !current
                  ? <Check aria-hidden="true" strokeWidth={3} className="size-3.5 sm:size-4" />
                  : <section.icon aria-hidden="true" strokeWidth={2} className="size-3.5 sm:size-4" />}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function TestsSection({ lesson, answers, onAnswer }: { lesson: LessonData; answers: Array<number | null>; onAnswer: (index: number, answer: number) => void }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {lesson.tests.map((quiz, index) => (
        <QuizCard key={quiz.question} quiz={quiz} number={index + 1} answer={answers[index] ?? null} onAnswer={(answer) => onAnswer(index, answer)} />
      ))}
    </div>
  )
}

function QuizCard({ quiz, number, answer, onAnswer }: { quiz: Quiz; number: number; answer: number | null; onAnswer: (answer: number) => void }) {
  const t = useT().lesson
  const correct = answer === quiz.correct
  /*
    "Try again" alone taught nothing: a learner could click through every option without
    learning why one was right. After a second miss the right option is marked and the
    explanation the quiz carries for a correct answer is shown, so the miss still teaches.
  */
  const [misses, setMisses] = useState(0)
  const revealed = !correct && misses >= 2
  return (
    <Card className={cx('relative overflow-hidden p-4 sm:p-5', correct && 'border-milestone')}>
      {quiz.context && <p className="mb-3 text-sm leading-relaxed text-ink-muted"><RussianText text={quiz.context} /></p>}
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ground-sunken text-sm font-black text-ink-muted">{number}</span>
        <h3 className="min-w-0 font-black leading-snug wrap-break-word text-ink"><RussianText text={quiz.question} /></h3>
      </div>
      <div className="mt-4 grid gap-2">
        {quiz.options.map((option, index) => (
          <button
            key={option}
            type="button"
            // Once right, the card stays right: a stray tap on another option while scrolling
            // used to turn it red and shut the step again.
            disabled={correct}
            onClick={() => {
              onAnswer(index)
              if (index === quiz.correct) celebrate()
              else {
                playUiSound('wrong')
                setMisses((count) => count + 1)
              }
            }}
            className={cx(
              'raised rounded-xl border-2 px-3 py-2.5 text-left text-sm font-bold',
              answer === index
                ? index === quiz.correct ? 'border-milestone bg-milestone-soft raised-milestone-soft' : 'border-danger bg-danger-soft raised-danger-soft'
                : correct
                  ? 'border-hairline bg-ground-raised opacity-45 shadow-none'
                  : revealed && index === quiz.correct
                    ? 'border-milestone border-dashed bg-ground-raised'
                    : 'border-hairline bg-ground-raised hover:border-signal',
            )}
          >
            <RussianText text={option} />
          </button>
        ))}
      </div>
      {answer !== null && (
        <div className={cx('mt-3 flex items-start gap-2 rounded-xl p-3 text-sm', correct ? 'bg-milestone-soft text-milestone' : 'bg-danger-soft text-danger')}>
          <MascotImage mascot={number === 1 ? 'pero' : 'penguin'} className="size-9 shrink-0" />
          <p>
            {correct ? quiz.feedback : revealed ? (
              <>
                <b>{t.rightAnswerIs}</b> <RussianText text={quiz.options[quiz.correct]} />. {quiz.feedback}
              </>
            ) : t.tryAgainLook}
          </p>
        </div>
      )}
    </Card>
  )
}

function RuleSection({ rule, genderStory = false }: { rule: LessonData['phonetics']; genderStory?: boolean }) {
  const t = useT().lesson.rule
  /*
   * One segment per speaker turn, not one flat string. A mascot's line carries its `character`
   * so playback switches to that mascot's own Gemini voice; unattributed narration (title,
   * lead, plain paragraphs, tables) has none and falls back to the learner's base voice. The
   * old version prefixed every mascot line with its name read aloud ("Пингвин: …") because one
   * voice narrated everyone — now that the voice itself carries the character, that prefix
   * would be redundant.
   */
  const speechSegments: { text: string; character?: Mascot }[] = [
    { text: `${rule.title}. ${rule.lead}` },
    ...rule.body.map((paragraph): { text: string; character?: Mascot } => typeof paragraph === 'string'
      ? { text: paragraph }
      : 'speaker' in paragraph
        ? { text: paragraph.text, character: paragraph.speaker }
        : { text: paragraph.table.rows.map((row) => row.join(', ')).join('. ') }),
  ]
  const hasSpeakerLines = rule.body.some((paragraph) => typeof paragraph !== 'string' && 'speaker' in paragraph)
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-5">
        {!hasSpeakerLines && <MascotImage mascot={rule.mascot} className="size-16 shrink-0 sm:size-24" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black leading-tight text-ink sm:text-2xl"><RussianText text={rule.title} /></h3>
          <p className="mt-2 font-semibold leading-relaxed text-ink-muted"><RussianText text={rule.lead} /></p>
          <RuleSpeechButton segments={speechSegments} className="raised raised-sm raised-signal-soft mt-3 inline-flex items-center gap-2 rounded-full bg-signal-soft px-3 py-2 text-sm font-black text-signal-ink">{t.listen}</RuleSpeechButton>
        </div>
      </div>
      {genderStory && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([
            ['penguin', t.penguinKingdom, 'Мужской род', 'Синий', '#0000FF'],
            ['panda', t.pandaKingdom, 'Женский род', 'Красный', '#FF2400'],
            ['pero', t.featherKingdom, 'Средний род', 'Жёлтый', '#FFFF00'],
          ] as const).map(([mascot, kingdom, title, colorName, color]) => (
            <div key={title} className="rounded-2xl bg-ground-sunken p-2 text-center sm:p-3">
              <MascotImage mascot={mascot} className="mx-auto size-14 min-[390px]:size-20 sm:size-24 lg:size-28" />
              <p className="mt-1 text-[10px] font-bold text-ink sm:text-xs">{kingdom}</p>
              <p
                className="mt-0.5 text-xs font-black sm:text-sm"
                style={{ color, WebkitTextStroke: color === '#FFFF00' ? '0.35px #8a7600' : undefined }}
              >
                {title}
              </p>
              {/* The yellow itself is unreadable as small text on a light tile, so the name is
                  written in the yellow house's ink beside a swatch of the real colour. */}
              <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold sm:text-xs" style={{ color: color === '#FFFF00' ? '#8a6d00' : color }}>
                <span aria-hidden="true" className="inline-block size-2 rounded-sm outline outline-black/20" style={{ background: color }} />
                {colorName}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 grid gap-2 text-sm leading-relaxed text-ink-muted sm:text-base">
        {rule.body.map((paragraph, index) => typeof paragraph === 'string'
          ? <p key={index}><RussianText text={paragraph} phoneticVowels /></p>
          : 'speaker' in paragraph
            ? <SpeakerLine key={index} speaker={paragraph.speaker} text={paragraph.text} />
            : <RuleTable key={index} table={paragraph.table} />)}
      </div>
      {rule.examples.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {rule.examples.map((example) => (
            <SpeechButton key={example} text={example} lang="ru-RU" className={cx('raised raised-sm rounded-full border border-hairline bg-ground-raised px-3 py-2 font-black text-ink', /^[АОУ]$/u.test(example) && 'text-3xl text-[#FF2400]')}>
              <RussianText text={example} />
            </SpeechButton>
          ))}
        </div>
      )}
      {rule.tongueTwister && <TongueTwister twister={rule.tongueTwister} />}
    </Card>
  )
}

const tongueTwisterSpeeds = [
  { icon: Turtle, key: 'slow', rate: 0.7 },
  { icon: Play, key: 'normal', rate: 1 },
  { icon: Zap, key: 'fast', rate: 1.35 },
] as const

function TongueTwister({ twister }: { twister: NonNullable<LessonData['phonetics']['tongueTwister']> }) {
  const t = useT().lesson.rule
  return (
    <div className="mt-4 rounded-2xl border border-caution bg-caution-soft/40 p-4">
      <p className="text-xs font-black tracking-[.12em] text-caution uppercase">{t.tongueTwister}</p>
      <p className="mt-2 text-xl font-black text-ink sm:text-2xl"><RussianText text={twister.ru} /></p>
      <p className="mt-1 text-sm font-semibold text-ink-muted">{twister.uz}</p>

      {/*
        The three speeds say the order by themselves, so the hint that spelled it out is gone, and
        so is the word-by-word breakdown: the rule above already teaches these sounds, and the
        cards made the block twice its height.
      */}
      <div className="mt-3 flex flex-wrap gap-2">
        {tongueTwisterSpeeds.map(({ icon: Icon, key, rate }) => (
          <SpeechButton
            key={key}
            text={twister.ru}
            lang="ru-RU"
            rate={rate}
            icon={<Icon aria-hidden="true" strokeWidth={2} className="size-4" />}
            className="raised raised-sm inline-flex items-center gap-1.5 rounded-full border border-hairline bg-ground-raised px-3 py-2 text-sm font-black text-ink"
          >
            {t.speed[key]}
          </SpeechButton>
        ))}
      </div>
    </div>
  )
}

function SpeakerLine({ speaker, text }: { speaker: Mascot; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ground-sunken p-3">
      <MascotImage mascot={speaker} className="size-12 shrink-0 min-[390px]:size-16 sm:size-20" />
      <p className="min-w-0 flex-1 text-ink">
        <RussianText text={text} phoneticVowels />
      </p>
    </div>
  )
}

function RuleTable({ table }: { table: { headers: string[]; rows: string[][] } }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline bg-ground-raised">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="bg-ground-sunken">
            {table.headers.map((header) => (
              <th key={header} className="px-3 py-2 font-black text-ink">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-hairline">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top text-ink-muted"><RussianText text={cell} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PhrasesSection({ phrases, ratings, onRate }: { phrases: Phrase[]; ratings: Record<number, Rating>; onRate: (index: number, rating: Rating) => void }) {
  const t = useT().lesson.phrases
  const [open, setOpen] = useState<number | null>(null)
  /*
   * "Don't know" and "review" bring a phrase back once, after the unrated ones — they used to
   * behave exactly like "know it". Kept per visit: the gate only asks that each phrase is rated.
   */
  const revisited = useRef(new Set<number>())
  return (
    <>
      <p className="mb-3 text-sm leading-relaxed text-ink-muted">{t.intro}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {phrases.map((phrase, index) => (
          <button key={`${phrase.ru}-${index}`} type="button" onClick={() => setOpen(index)} className="raised flex items-center gap-3 rounded-2xl border border-hairline bg-ground-raised p-3 text-left hover:border-signal">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-xl">{phrase.icon}</span>
            <span className="min-w-0 flex-1 font-black text-ink"><RussianText text={phrase.ru} /></span>
            {/* The whole card is the button; a chevron says so without a line of text under every phrase. */}
            {ratings[index]
              ? <Check aria-hidden="true" strokeWidth={3} className="size-4 shrink-0 text-milestone" />
              : <ChevronRight aria-hidden="true" strokeWidth={2.4} className="size-4 shrink-0 text-ink-faint" />}
          </button>
        ))}
      </div>
      {open !== null && <StudyCard phrase={phrases[open]} onClose={() => setOpen(null)} onRate={(rating) => {
        onRate(open, rating)
        const rated = { ...ratings, [open]: rating }
        const unrated = phrases.findIndex((_, index) => !rated[index])
        const again = phrases.findIndex((_, index) => index !== open && rated[index] !== 'known' && !revisited.current.has(index))
        const next = unrated >= 0 ? unrated : again
        if (next >= 0 && unrated < 0) revisited.current.add(next)
        setOpen(next >= 0 ? next : null)
      }} />}
    </>
  )
}

function StudyCard({ phrase, onClose, onRate }: { phrase: Phrase; onClose: () => void; onRate: (rating: Rating) => void }) {
  const rating = useT().lesson.vocabulary
  const t = useT().lesson.phrases
  const dialogRef = useFocusTrap<HTMLDivElement>()
  return createPortal(
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/45 p-3" role="dialog" aria-modal="true">
      <Card className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto p-0">
        <div className="relative flex h-36 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,var(--color-ground-raised),var(--color-signal-soft))]">
          <span className="lesson-scene-icon text-6xl">{phrase.icon}</span>
          <button type="button" onClick={onClose} aria-label={t.close} className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-ground-raised/90 text-xl font-black text-ink">×</button>
        </div>
        <div className="p-5">
          <h3 className="text-2xl font-black text-ink"><RussianText text={phrase.ru} /></h3>
          {phrase.pronunciation && <p className="mt-1 text-sm font-semibold text-ink-faint"><RussianText text={phrase.pronunciation} /></p>}
          <p className="mt-2 text-lg font-bold text-ink-muted">{phrase.uz}</p>
          {/* Most phrases stand on their own, and `example` then just repeats `ru` — only worth
              its own box when the lesson actually supplied a different sentence. */}
          {phrase.example !== phrase.ru && (
            <div className="mt-3 rounded-xl bg-ground-sunken p-3">
              <p className="text-xs font-black tracking-[.12em] text-ink-faint uppercase">{t.example}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink"><RussianText text={phrase.example} /></p>
            </div>
          )}
          <SpeechButton text={phrase.ru} lang="ru-RU" className="raised raised-signal mt-3 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-black text-on-signal">{t.repeat}</SpeechButton>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => { playUiSound('coin'); onRate('known') }} className="raised raised-signal rounded-xl bg-signal px-2 py-2 text-xs font-black text-on-signal">{rating.known}</button>
            {/* "Don't know" is an honest answer, not a wrong one: it gets the neutral sound. */}
            <button type="button" onClick={() => { playUiSound('select'); onRate('unknown') }} className="raised raised-danger-soft rounded-xl border border-danger px-2 py-2 text-xs font-black text-danger">{rating.unknown}</button>
            <button type="button" onClick={() => { playUiSound('select'); onRate('repeat') }} className="raised rounded-xl border border-hairline px-2 py-2 text-xs font-black text-ink">{rating.again}</button>
          </div>
        </div>
      </Card>
    </div>, document.body,
  )
}

/**
 * Confetti for every game, at every screen size.
 *
 * Only the quiz and the day-complete card used to fire any, so a correct answer inside a game
 * passed with nothing but a vibration — and on a phone, where the vibration is easy to miss,
 * the reward read as missing entirely. Each game records a solved item by adding one key to the
 * shared `gameMatches` map, so watching that map covers all of them from one place. The burst
 * is a full-viewport portal sized in vw/vh, so it is never clipped by a narrow layout.
 */
function GameStage({ lesson, matches, children }: { lesson: LessonData; matches: Record<string, string>; children: ReactNode }) {
  const solvedCount = Object.keys(matches).length
  const total = lesson.game.pairs.length
  const [burst, setBurst] = useState<{ id: number } | null>(null)
  const solvedRef = useRef(solvedCount)
  const burstTimerRef = useRef<number | null>(null)

  useEffect(() => {
    // Each match already answers with its sound and a check mark. A burst on every one of them
    // turned into background noise by the tenth lesson, so the confetti is kept for the finish.
    if (solvedCount > solvedRef.current && total > 0 && solvedCount >= total) {
      setBurst({ id: Date.now() })
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current)
      burstTimerRef.current = window.setTimeout(() => setBurst(null), 4_200)
    }
    solvedRef.current = solvedCount
  }, [solvedCount, total])

  useEffect(() => () => {
    if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current)
  }, [])

  return (
    <>
      {burst && <Celebration key={burst.id} pieces={150} balloons={28} />}
      {children}
    </>
  )
}

type GenderHouseName = 'Мужской род' | 'Женский род' | 'Средний род'
type WordDrag = { word: string; x: number; y: number }

/*
 * The house's name and its resident's name are copy (`lesson.game.houses`, `.speakers`). The
 * ink and the tint are theme tokens, so the houses do not glare on the dark theme; the border
 * keeps the gender colour itself, which is the thing being taught.
 */
const genderHouses: Array<{
  name: GenderHouseName
  key: 'masculine' | 'feminine' | 'neuter'
  /** Who lives here — this house's own character answers when a word lands on it. */
  mascot: Mascot
  color: string
  /** The yellow house's accent is too pale to read as text, so text carries its own ink. */
  ink: string
  background: string
}> = [
  { name: 'Мужской род', key: 'masculine', mascot: 'penguin', color: '#0000FF', ink: 'var(--color-house-blue-ink)', background: 'var(--color-house-blue-soft)' },
  { name: 'Женский род', key: 'feminine', mascot: 'panda', color: '#FF2400', ink: 'var(--color-house-red-ink)', background: 'var(--color-house-red-soft)' },
  { name: 'Средний род', key: 'neuter', mascot: 'pero', color: '#d4b500', ink: 'var(--color-house-yellow-ink)', background: 'var(--color-house-yellow-soft)' },
]

type GenderHouse = (typeof genderHouses)[number]

/** The rule that puts a word in each house, said when a word lands in the wrong one. */
const GENDER_RULE_KEY: Record<string, 'ruleMasculine' | 'ruleFeminine' | 'ruleNeuter'> = {
  'Мужской род': 'ruleMasculine',
  'Женский род': 'ruleFeminine',
  'Средний род': 'ruleNeuter',
}

function houseByName(name: string): GenderHouse | undefined {
  return genderHouses.find((house) => house.name === name)
}

/**
 * Feedback in this game is spoken by the house the word was dropped on, not by one fixed
 * character — the penguin owns Мужской, the panda Женский, Pat Средний.
 */
function HouseSpeech({ house, tone, children }: { house: GenderHouse | undefined; tone: 'success' | 'error'; children: ReactNode }) {
  const t = useT().lesson.game
  return (
    <p
      role="status"
      className={cx(
        'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black',
        tone === 'success' ? 'bg-milestone-soft text-milestone' : 'bg-danger-soft text-danger',
      )}
    >
      {house && <MascotImage mascot={house.mascot} className="size-8 shrink-0" />}
      <span>{house ? `${t.speakers[house.mascot]}: ` : ''}«{children}»</span>
    </p>
  )
}

function GenderHouseGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const t = useT().lesson.game
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<WordDrag | null>(null)
  const [error, setError] = useState<{ word: string; house: string; expected?: string } | null>(null)
  const missesRef = useRef<Record<string, number>>({})
  const [hintHouse, setHintHouse] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const pointerRef = useRef<{ pointerId: number; word: string; x: number; y: number } | null>(null)
  const draggingRef = useRef<WordDrag | null>(null)
  const didDragRef = useRef<string | null>(null)
  const errorTimerRef = useRef<number | null>(null)
  const successTimerRef = useRef<number | null>(null)
  const remaining = lesson.game.pairs.filter((pair) => matches[pair.left] !== pair.right)
  const matchedCount = lesson.game.pairs.length - remaining.length

  useEffect(() => () => {
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current)
    if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current)
  }, [])

  function showError(word: string, house: string, expected?: string) {
    setError({ word, house, expected })
    const misses = (missesRef.current[word] ?? 0) + 1
    missesRef.current[word] = misses
    // Two misses on one word: the right house shows itself.
    if (misses >= 2 && expected) setHintHouse(expected)
    playUiSound('wrong')
    navigator.vibrate?.([35, 35, 35])
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current)
    errorTimerRef.current = window.setTimeout(() => setError(null), 1_800)
  }

  function showSuccess(house: string) {
    setSuccess(house)
    if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current)
    successTimerRef.current = window.setTimeout(() => setSuccess(null), 1_800)
  }

  function placeWord(word: string, house: string | undefined) {
    setSelected(null)
    if (!house) return
    const expected = lesson.game.pairs.find((pair) => pair.left === word)?.right
    if (expected === house) {
      setError(null)
      setHintHouse(null)
      onChange({ ...matches, [word]: house })
      celebrate([25, 35, 60], 'coin')
      if (lesson.game.feedback) showSuccess(house)
      return
    }
    showError(word, house, expected)
  }

  function startPointer(event: React.PointerEvent<HTMLButtonElement>, word: string) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    didDragRef.current = null
    pointerRef.current = { pointerId: event.pointerId, word, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePointer(event: React.PointerEvent<HTMLButtonElement>) {
    const pointer = pointerRef.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    if (!draggingRef.current && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
      draggingRef.current = { word: pointer.word, x: event.clientX, y: event.clientY }
      setDragging(draggingRef.current)
    }
    if (draggingRef.current) {
      event.preventDefault()
      draggingRef.current = { ...draggingRef.current, x: event.clientX, y: event.clientY }
      setDragging(draggingRef.current)
    }
  }

  function finishPointer(event: React.PointerEvent<HTMLButtonElement>) {
    const pointer = pointerRef.current
    const activeDrag = draggingRef.current
    pointerRef.current = null
    draggingRef.current = null
    setDragging(null)
    if (!pointer || pointer.pointerId !== event.pointerId || !activeDrag) return
    didDragRef.current = activeDrag.word
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-gender-house]')
    placeWord(activeDrag.word, target?.dataset.genderHouse)
  }

  function cancelPointer() {
    pointerRef.current = null
    draggingRef.current = null
    setDragging(null)
  }

  return (
    <div className="space-y-3">
      <GameHeader lesson={lesson} count={`${matchedCount}/${lesson.game.pairs.length}`} />

      <Card className="overflow-hidden p-3 sm:p-4">
        {/* No "words · swipe sideways" label: a chip row cut off at the edge already says it scrolls. */}
        <div className="-mx-3 overflow-x-auto px-3 pt-1 pb-2 [scrollbar-width:thin] sm:-mx-4 sm:px-4">
          <div className="flex w-max min-w-full gap-2">
            {remaining.length > 0 ? remaining.map((pair) => (
              <div key={pair.left} className={cx('flex shrink-0 items-center rounded-xl border-2 bg-ground-raised shadow-sm transition', selected === pair.left && 'border-signal bg-signal-soft', error?.word === pair.left ? 'animate-pulse border-danger bg-danger-soft' : 'border-hairline')}>
                <button
                  type="button"
                  onClick={() => {
                    if (didDragRef.current === pair.left) {
                      didDragRef.current = null
                      return
                    }
                    setSelected((current) => current === pair.left ? null : pair.left)
                    playUiSound('select')
                  }}
                  onPointerDown={(event) => startPointer(event, pair.left)}
                  onPointerMove={movePointer}
                  onPointerUp={finishPointer}
                  onPointerCancel={cancelPointer}
                  className="touch-pan-x px-3 py-2.5 text-base font-black text-ink select-none"
                  aria-pressed={selected === pair.left}
                >
                  <RussianText text={pair.left} />
                </button>
                <SpeechButton text={pair.left} lang="ru-RU" stopPropagation className="mr-1.5 flex size-8 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
                  <span className="sr-only">{fill(t.hearWord, { word: pair.left })}</span>
                </SpeechButton>
              </div>
            )) : <p className="w-full py-2 text-center text-sm font-black text-milestone">{t.allPlaced}</p>}
          </div>
        </div>
      </Card>

      {remaining.length === 0 && lesson.game.feedback && (
        <p role="status" className="rounded-xl bg-milestone-soft px-3 py-2 text-center text-sm font-black text-milestone">
          {lesson.game.feedback.allDone}
        </p>
      )}

      {error && (
        <HouseSpeech house={houseByName(error.house)} tone="error">
          {lesson.game.feedback
            ? lesson.game.feedback.incorrect
            : (
              <>
                <RussianText text={error.word} />{t.wrongHouse}
                {error.expected && GENDER_RULE_KEY[error.expected] && (
                  <span className="mt-1 block font-semibold">{t[GENDER_RULE_KEY[error.expected]]}</span>
                )}
              </>
            )}
        </HouseSpeech>
      )}

      {success && lesson.game.feedback && (
        <HouseSpeech house={houseByName(success)} tone="success">
          {lesson.game.feedback.correct}
        </HouseSpeech>
      )}

      <div className="grid grid-cols-3 gap-2">
        {genderHouses.map((house) => {
          const placed = lesson.game.pairs.filter((pair) => matches[pair.left] === house.name)
          const isWrongTarget = error?.house === house.name
          const isHint = hintHouse === house.name && !isWrongTarget
          return (
            <button
              key={house.name}
              type="button"
              data-gender-house={house.name}
              onClick={() => { if (selected) placeWord(selected, house.name) }}
              className={cx('flex min-h-44 flex-col overflow-hidden rounded-2xl border-2 border-dashed p-2 text-left transition sm:min-h-52 sm:p-4', selected && 'ring-2 ring-signal/30', isWrongTarget && 'animate-pulse border-danger', isHint && 'animate-pulse border-solid ring-4 ring-milestone/40')}
              style={{ borderColor: isWrongTarget ? '#dc2626' : house.color, background: house.background }}
              aria-label={`${t.houses[house.key]}: ${house.name}`}
            >
              <MascotImage mascot={house.mascot} className="h-12 w-12 shrink-0 object-contain object-left sm:h-16 sm:w-16" />
              <span className="mt-2 block text-[10px] font-black tracking-[.12em] uppercase sm:text-xs" style={{ color: house.ink }}>{t.houses[house.key]}</span>
              <span className="mt-1 block text-xs font-black leading-tight sm:text-base" style={{ color: house.ink }}><RussianText text={house.name} /></span>
              <span className="mt-2 flex flex-1 flex-wrap content-start gap-1">
                {placed.map((pair) => <span key={pair.left} className="h-fit rounded-full bg-ground-raised px-1.5 py-0.5 text-[10px] font-black shadow-sm sm:px-2 sm:py-1 sm:text-xs" style={{ color: house.ink }}><RussianText text={pair.left} /> <Check aria-hidden="true" strokeWidth={3} className="inline size-3" /></span>)}
              </span>
            </button>
          )
        })}
      </div>

      {dragging && createPortal(
        <span className="pointer-events-none fixed z-[120] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-signal bg-ground-raised px-4 py-2 text-base font-black text-ink shadow-xl" style={{ left: dragging.x, top: dragging.y }}>
          <RussianText text={dragging.word} />
        </span>,
        document.body,
      )}
    </div>
  )
}

/**
 * Every game opens with the same card: its title, its instruction, and the one counter of how
 * far the learner has got. The games used to repeat that count — a header pill plus a second
 * tally on the board, or a score in points beside a count of items.
 */
function GameHeader({ lesson, count }: { lesson: LessonData; count: string }) {
  return (
    <Card className="border-signal/40 bg-signal-soft/45 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-signal-ink">{lesson.game.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.game.instruction}</p>
        </div>
        <span className="shrink-0 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-signal-ink tabular-nums">{count}</span>
      </div>
    </Card>
  )
}

function MatchingGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const lessonT = useT().lesson
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState<'correct' | 'incorrect' | null>(null)
  /** The answer just tapped wrongly, flashed red so a miss is visible on a phone with no vibration. */
  const [wrongKey, setWrongKey] = useState<string | null>(null)
  const noteTimerRef = useRef<number | null>(null)
  const shuffledRight = useMemo(() => seededShuffle(lesson.game.pairs, lesson.day), [lesson])
  const matchedCount = Object.keys(matches).length
  const solved = matchedCount === lesson.game.pairs.length
  const matchedPerRight = new Map<string, number>()
  for (const value of Object.values(matches)) {
    matchedPerRight.set(value, (matchedPerRight.get(value) ?? 0) + 1)
  }
  const rightOccurrences = new Map<string, number>()

  useEffect(() => () => {
    if (noteTimerRef.current !== null) window.clearTimeout(noteTimerRef.current)
  }, [])

  function showNote(kind: 'correct' | 'incorrect', key?: string) {
    // A lesson without its own feedback lines still says "try again": a miss used to show nothing.
    if (!lesson.game.feedback && kind === 'correct') return
    setNote(kind)
    setWrongKey(kind === 'incorrect' ? key ?? null : null)
    if (noteTimerRef.current !== null) window.clearTimeout(noteTimerRef.current)
    noteTimerRef.current = window.setTimeout(() => {
      setNote(null)
      setWrongKey(null)
    }, 1_800)
  }

  return (
    <div className="space-y-3">
      <GameHeader lesson={lesson} count={`${matchedCount}/${lesson.game.pairs.length}`} />
      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid content-start gap-2">
            {lesson.game.pairs.map((pair) => {
              const done = matches[pair.left] === pair.right
              return <button key={pair.left} type="button" disabled={done} onClick={() => setSelected(pair.left)} className={cx('raised min-h-11 rounded-xl border-2 px-2 py-2 text-sm font-black', done ? 'border-milestone bg-milestone-soft text-milestone raised-milestone-soft' : selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink raised-signal-soft' : 'border-hairline bg-ground-raised text-ink')}><RussianText text={pair.left} /></button>
            })}
          </div>
          <div className="grid content-start gap-2">
            {shuffledRight.map((pair) => {
              // A right-hand answer legitimately repeats (several nouns take the same ending),
              // so a button is spent per occurrence, not per value. Disabling by value alone
              // greyed out every duplicate at once and left the game unsolvable.
              const occurrence = rightOccurrences.get(pair.right) ?? 0
              rightOccurrences.set(pair.right, occurrence + 1)
              const used = occurrence < (matchedPerRight.get(pair.right) ?? 0)
              const key = `${pair.left}→${pair.right}`
              return <button key={key} type="button" disabled={used} onClick={() => {
                if (!selected) return
                const expected = lesson.game.pairs.find((candidate) => candidate.left === selected)?.right
                if (expected === pair.right) {
                  onChange({ ...matches, [selected]: pair.right })
                  setSelected(null)
                  celebrate()
                  showNote('correct')
                } else {
                  navigator.vibrate?.([30, 30, 30])
                  playUiSound('wrong')
                  showNote('incorrect', key)
                }
              }} className={cx(
                'raised min-h-11 rounded-xl border-2 px-2 py-2 text-sm font-black',
                used
                  ? 'border-milestone bg-milestone-soft text-milestone raised-milestone-soft'
                  : wrongKey === key
                    ? 'animate-pulse border-danger bg-danger-soft text-danger raised-danger-soft'
                    : 'border-hairline bg-ground-raised text-ink hover:border-signal',
              )}><RussianText text={pair.right} /></button>
            })}
          </div>
        </div>
      </Card>

      {lesson.game.feedback && solved && (
        <p role="status" className="rounded-xl bg-milestone-soft px-3 py-2 text-center text-sm font-black text-milestone">
          {lesson.game.feedback.allDone}
        </p>
      )}

      {note && !solved && (
        <p
          role="status"
          className={cx(
            'rounded-xl px-3 py-2 text-center text-sm font-black',
            note === 'correct' ? 'bg-milestone-soft text-milestone' : 'bg-danger-soft text-danger',
          )}
        >
          {note === 'correct' ? lesson.game.feedback?.correct : lesson.game.feedback?.incorrect ?? lessonT.tryAgain}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------- lesson pictograms */

/**
 * The pictogram for a word in one of the games.
 *
 * Wrapped in a component per table rather than looked up inline, because every call site
 * wants the same two things — resolve the word, fall back if the lesson names something the
 * map has not been taught — and inlining that four times is four places for the fallback to
 * be forgotten. Decorative in every position: the Russian word is always rendered beside it.
 */
function SceneIcon({ word, className }: { word: string; className?: string }) {
  const Icon = pictureSceneIcons[word] ?? Package
  return <Icon aria-hidden="true" strokeWidth={1.8} className={className} />
}

function BagIcon({ word, className }: { word: string; className?: string }) {
  const Icon = bagItemIcons[word] ?? bagFallbackIcon
  return <Icon aria-hidden="true" strokeWidth={1.8} className={className} />
}

function CityIcon({ word, className }: { word: string; className?: string }) {
  const Icon = cityPlaceIcons[word] ?? cityFallbackIcon
  return <Icon aria-hidden="true" strokeWidth={1.8} className={className} />
}

function RoomObjectIcon({ word, className }: { word: string; className?: string }) {
  const Icon = roomObjectIcons[word] ?? Package
  return <Icon aria-hidden="true" strokeWidth={1.8} className={className} />
}

/**
 * A cell in the room grid: the object once something has been placed there, otherwise the
 * slot's own hint of what belongs.
 */
function RoomCellIcon({ word, slot, className }: { word?: string; slot: string; className?: string }) {
  const Icon = (word ? roomObjectIcons[word] : roomSlotIcons[slot]) ?? Package
  return <Icon aria-hidden="true" strokeWidth={1.8} className={className} />
}

function MissingBagGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const t = useT().lesson.game
  const [wrong, setWrong] = useState<string | null>(null)
  const solved = lesson.game.pairs.filter((pair) => matches[pair.left] === pair.right)
  const current = lesson.game.pairs[solved.length]
  // Drawn from the whole game, not just the unsolved items: those ran out, and the last item
  // was left with its own answer as the only choice.
  const options = useMemo(() => (current ? threeOptions(lesson.game.pairs, current) : []), [current, lesson.game.pairs])

  function choose(option: string) {
    if (!current) return
    if (option === current.right) {
      onChange({ ...matches, [current.left]: current.right })
      setWrong(null)
      celebrate([25, 30, 50], solved.length + 1 === lesson.game.pairs.length ? 'win' : 'coin')
      return
    }
    setWrong(option)
    playUiSound('wrong')
    navigator.vibrate?.([30, 30, 30])
  }

  return (
    <div className="space-y-3">
      <GameHeader lesson={lesson} count={`${solved.length}/${lesson.game.pairs.length}`} />

      <Card className="overflow-hidden p-3 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:items-center">
          <div className="relative mx-auto flex aspect-square w-full max-w-56 items-center justify-center rounded-[2rem] bg-[linear-gradient(145deg,var(--color-signal-soft),var(--color-coin-faint))]">
            <ShoppingBag aria-hidden="true" strokeWidth={1.2} className="size-24 text-signal-ink/80" />
          </div>
          <div>
            {current ? <>
              <p className="text-xs font-black tracking-[.12em] text-ink-muted uppercase">{t.missingFromBag}</p>
              <div className="my-3 flex items-center gap-3 rounded-2xl bg-ground-sunken p-3">
                <BagIcon word={current.left} className="size-10 shrink-0 text-signal-ink" />
                <span className="text-xl font-black text-ink"><RussianText text={current.left} /></span>
              </div>
              <div className="grid gap-2">
                {options.map((option) => <button key={option} type="button" onClick={() => choose(option)} className={cx('raised min-h-12 rounded-xl border-2 px-3 py-2 text-left text-sm font-black', wrong === option ? 'animate-pulse border-danger bg-danger-soft text-danger raised-danger-soft' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><RussianText text={option} /></button>)}
              </div>
            </> : <div className="rounded-2xl bg-milestone-soft p-5 text-center"><PartyPopper aria-hidden="true" strokeWidth={1.5} className="mx-auto size-12 text-milestone" /><h4 className="mt-2 text-xl font-black text-milestone">{t.bagReady}</h4><p className="mt-1 text-sm text-ink-muted">{t.bagBonus}</p></div>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {solved.map((pair) => <span key={pair.left} className="rounded-full bg-milestone-soft px-2.5 py-1 text-xs font-black text-milestone"><BagIcon word={pair.left} className="size-3.5" /> <RussianText text={pair.left} /> <Check aria-hidden="true" strokeWidth={3} className="inline size-3" /></span>)}
        </div>
      </Card>
    </div>
  )
}

function PictureDescriptionGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const t = useT().lesson.game
  const lessonT = useT().lesson
  const draftId = useId()
  const [selected, setSelected] = useState(lesson.game.pairs[0]?.left ?? '')
  const [draft, setDraft] = useState(matches[selected] ?? '')
  const completed = gameProgress(lesson, matches).done
  const latinOnly = draft.trim().length > 0 && !hasRussian(draft)

  function selectPicture(place: string) {
    setSelected(place)
    setDraft(matches[place] ?? '')
    playUiSound('select')
  }

  function saveDescription() {
    const description = draft.trim()
    if (!selected || !hasRussian(description)) return
    const next = { ...matches, [selected]: description }
    onChange(next)
    celebrate([25, 30, 45], completed + 1 === lesson.game.pairs.length ? 'win' : 'coin')
    // On to the next picture still waiting for a description, so "Ready" moves the game along.
    const following = lesson.game.pairs.find((pair) => !hasRussian(next[pair.left] ?? ''))
    if (following) {
      setSelected(following.left)
      setDraft(next[following.left] ?? '')
    }
  }

  return (
    <div className="space-y-3">
      <GameHeader lesson={lesson} count={`${completed}/${lesson.game.pairs.length}`} />

      <Card className="p-3 sm:p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {lesson.game.pairs.map((pair) => {
            const done = hasRussian(matches[pair.left] ?? '')
            return <button key={pair.left} type="button" onClick={() => selectPicture(pair.left)} className={cx('raised flex min-h-28 flex-col items-center justify-center rounded-2xl border-2 p-3', done ? 'border-milestone bg-milestone-soft text-milestone raised-milestone-soft' : selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink raised-signal-soft' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><SceneIcon word={pair.left} className="size-9 text-signal-ink" /><span className="mt-2 text-sm font-black">{pair.left}</span>{done && <Check aria-hidden="true" strokeWidth={3} className="mt-1 size-3.5" />}</button>
          })}
        </div>
      </Card>

      {lesson.game.example && <Card className="border-hairline bg-ground-raised p-4 text-sm leading-relaxed text-ink"><RussianText text={lesson.game.example} /></Card>}

      <Card className="p-3 sm:p-4">
        {/* Named after the picture it is for: an unlabelled box under the grid said neither which
            picture nor what to write. */}
        <label htmlFor={draftId} className="mb-2 block text-xs font-black tracking-[.08em] text-ink-muted uppercase">
          {fill(t.describePlace, { place: selected })}
        </label>
        <textarea
          id={draftId}
          value={draft}
          lang="ru"
          placeholder={t.describePlaceholder}
          onChange={(event) => setDraft(event.target.value)}
          rows={5}
          className={cx('w-full resize-y rounded-2xl border bg-ground-raised px-4 py-3 text-sm text-ink outline-none transition focus:border-signal', latinOnly ? 'border-danger' : 'border-hairline')}
        />
        {latinOnly && <p className="mt-1 text-xs font-bold text-danger">{lessonT.needRussian}</p>}
        <Button className="mt-3" disabled={!hasRussian(draft)} onClick={saveDescription}>{t.ready}</Button>
      </Card>
    </div>
  )
}

function CityMapGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const t = useT().lesson.game
  const [selected, setSelected] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const solved = lesson.game.pairs.filter((pair) => matches[pair.left] === pair.right)
  const current = lesson.game.pairs.find((pair) => pair.left === selected)
  const options = useMemo(() => (current ? threeOptions(lesson.game.pairs, current) : []), [current, lesson.game.pairs])

  function choose(option: string) {
    if (!current) return
    if (option === current.right) {
      onChange({ ...matches, [current.left]: current.right })
      setSelected(null)
      setWrong(null)
      celebrate([25, 30, 45], solved.length + 1 === lesson.game.pairs.length ? 'win' : 'coin')
      return
    }
    setWrong(option)
    playUiSound('wrong')
    navigator.vibrate?.([30, 30, 30])
  }

  return (
    <div className="space-y-3">
      <GameHeader lesson={lesson} count={`${solved.length}/${lesson.game.pairs.length}`} />

      <Card className="overflow-hidden p-3 sm:p-5">
        <div className="rounded-2xl bg-[linear-gradient(145deg,var(--color-signal-soft),var(--color-milestone-soft)_55%,var(--color-coin-faint))] p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {lesson.game.pairs.map((pair) => {
              const done = matches[pair.left] === pair.right
              return <button key={pair.left} type="button" disabled={done} onClick={() => { setSelected(pair.left); setWrong(null); playUiSound('select') }} className={cx('raised flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 p-2 text-center', done ? 'border-milestone bg-milestone-soft text-milestone raised-milestone-soft' : selected === pair.left ? 'border-signal bg-ground-raised text-signal-ink raised-signal-soft' : 'border-ground-raised bg-ground-raised/75 text-ink hover:border-signal')}><CityIcon word={pair.left} className="size-8" /><span className="mt-1 text-xs font-black"><RussianText text={pair.left} /></span>{done && <Check aria-hidden="true" strokeWidth={3} className="mt-1 size-3" />}</button>
            })}
          </div>
        </div>
      </Card>

      {current && <Card className="p-3 sm:p-4"><p className="mb-3 text-sm font-black text-ink"><CityIcon word={current.left} className="mr-2 inline size-6" /><RussianText text={current.left} /> {t.pickTrueSentenceSuffix}</p><div className="grid gap-2">{options.map((option) => <button key={option} type="button" onClick={() => choose(option)} className={cx('raised min-h-12 rounded-xl border-2 px-3 py-2 text-left text-sm font-black', wrong === option ? 'animate-pulse border-danger bg-danger-soft text-danger raised-danger-soft' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><RussianText text={option} /></button>)}</div></Card>}
      {solved.length === lesson.game.pairs.length && <Card className="border-milestone bg-milestone-soft/50 p-5 text-center"><Landmark aria-hidden="true" strokeWidth={1.5} className="mx-auto size-12 text-milestone" /><h4 className="mt-2 text-xl font-black text-milestone">{t.cityDone}</h4><p className="mt-1 text-sm text-ink-muted">{t.cityDoneBody}</p></Card>}
    </div>
  )
}

function PluralPuzzle({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const t = useT().lesson.game
  const [selected, setSelected] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const solved = lesson.game.pairs.filter((pair) => matches[pair.left] === pair.right).length
  const options = useMemo(
    () => lesson.game.pairs.map((pair) => pair.right).sort((a, b) => a.localeCompare(b, 'ru')),
    [lesson.game.pairs],
  )

  function choosePlural(plural: string) {
    if (!selected) return
    const expected = lesson.game.pairs.find((pair) => pair.left === selected)?.right
    if (expected === plural) {
      onChange({ ...matches, [selected]: plural })
      setSelected(null)
      setWrong(null)
      celebrate([30, 35, 55], 'coin')
      return
    }
    setWrong(plural)
    playUiSound('wrong')
    navigator.vibrate?.([30, 30, 30])
  }

  return (
    <div className="space-y-3">
      <GameHeader lesson={lesson} count={`${solved}/${lesson.game.pairs.length}`} />

      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="relative mx-auto aspect-[4/3] max-w-xl overflow-hidden rounded-2xl bg-[linear-gradient(160deg,var(--color-coin-faint),var(--color-signal-soft))]">
          {lesson.sceneImage
            ? <img src={lesson.sceneImage} alt={t.guestsAndFamily} className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center"><Users aria-hidden="true" strokeWidth={1.2} className="size-20 text-signal-ink/70" /></div>}
          <div className="absolute inset-0 grid" style={coverGridStyle(lesson.game.pairs.length)} aria-hidden="true">
            {lesson.game.pairs.map((pair) => (
              <span key={pair.left} className={cx('flex items-center justify-center border border-white/30 bg-ink/85 text-2xl font-black text-white transition-all duration-500', matches[pair.left] === pair.right && 'scale-0 opacity-0')}>
                ?
              </span>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {lesson.game.pairs.map((pair) => {
          const done = matches[pair.left] === pair.right
          return (
            <button key={pair.left} type="button" disabled={done} onClick={() => { setSelected(pair.left); setWrong(null); playUiSound('select') }} className={cx('raised rounded-xl border-2 px-3 py-2.5 text-left text-sm font-black', done ? 'border-milestone bg-milestone-soft text-milestone raised-milestone-soft' : selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink raised-signal-soft' : 'border-hairline bg-ground-raised text-ink')}>
              <RussianText text={pair.left} /> {done
                ? <Check aria-hidden="true" strokeWidth={3} className="inline size-3.5" />
                : <ArrowRight aria-hidden="true" strokeWidth={2.4} className="inline size-3.5 opacity-60" />}
            </button>
          )
        })}
      </div>

      {selected && (
        <Card className="p-3 sm:p-4">
          <p className="mb-2 text-xs font-black text-ink-muted"><RussianText text={selected} /> {t.pickPluralSuffix}</p>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button key={option} type="button" onClick={() => choosePlural(option)} className={cx('raised rounded-full border-2 px-3 py-2 text-sm font-black', wrong === option ? 'animate-pulse border-danger bg-danger-soft text-danger raised-danger-soft' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}>
                <RussianText text={option} />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/** Where each slot sits in the room. Its caption is copy, at `lesson.game.slots[label]`. */
const roomSlots = [
  { id: 'picture-wall', label: 'wall', gridColumn: '1', gridRow: '1' },
  { id: 'tv-wall', label: 'wall', gridColumn: '2 / span 2', gridRow: '1' },
  { id: 'near-window', label: 'nearWindow', gridColumn: '4', gridRow: '1' },
  { id: 'corner', label: 'corner', gridColumn: '1', gridRow: '2' },
  { id: 'room-centre', label: 'centre', gridColumn: '2 / span 2', gridRow: '2' },
  { id: 'beside-wall', label: 'besideWall', gridColumn: '4', gridRow: '2' },
  { id: 'beside-table', label: 'besideTable', gridColumn: '1', gridRow: '3' },
  { id: 'on-desk', label: 'onTable', gridColumn: '2', gridRow: '3' },
  { id: 'computer-desk', label: 'onTable', gridColumn: '3', gridRow: '3' },
  { id: 'on-floor', label: 'onFloor', gridColumn: '4', gridRow: '3' },
] as const

function coverGridStyle(count: number) {
  const { columns, rows } = coverGrid(count)
  return { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }
}

function RoomBuilder({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const t = useT().lesson.game
  const [selected, setSelected] = useState<string | null>(null)
  const [wrongSlot, setWrongSlot] = useState<string | null>(null)
  const remaining = lesson.game.pairs.filter((pair) => matches[pair.left] !== pair.right)
  const placed = lesson.game.pairs.length - remaining.length

  function place(slot: string) {
    if (!selected) return
    const expected = lesson.game.pairs.find((pair) => pair.left === selected)?.right
    if (expected === slot) {
      onChange({ ...matches, [selected]: slot })
      setSelected(null)
      setWrongSlot(null)
      celebrate([25, 30, 45], 'coin')
      return
    }
    setWrongSlot(slot)
    playUiSound('wrong')
    navigator.vibrate?.([30, 30, 30])
  }

  return (
    <div className="space-y-3">
      <GameHeader lesson={lesson} count={`${placed}/${lesson.game.pairs.length}`} />

      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="-mx-3 overflow-x-auto px-3 pt-1 pb-2 [scrollbar-width:thin] sm:-mx-4 sm:px-4">
          <div className="flex w-max min-w-full gap-2">
            {remaining.length > 0 ? remaining.map((pair) => (
              <button key={pair.left} type="button" onClick={() => { setSelected(pair.left); setWrongSlot(null); playUiSound('select') }} className={cx('raised shrink-0 rounded-xl border-2 px-3 py-2.5 text-sm font-black', selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink raised-signal-soft' : 'border-hairline bg-ground-raised text-ink')}>
                <RoomObjectIcon word={pair.left} className="mr-1.5 inline size-4" /><RussianText text={pair.left} />
              </button>
            )) : <p className="w-full py-2 text-center text-sm font-black text-milestone">{t.roomReady}</p>}
          </div>
        </div>
      </Card>

      <RoomScene matches={matches} selected={selected} wrongSlot={wrongSlot} onSlot={place} />
      {wrongSlot && <p role="status" className="rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-black text-danger">{t.wrongPlace}</p>}
      {selected && <p className="text-center text-xs font-bold text-signal-ink"><RussianText text={selected} /> {t.pickSpotSuffix}</p>}
    </div>
  )
}

function RoomScene({ matches = {}, selected = null, wrongSlot = null, onSlot }: { matches?: Record<string, string>; selected?: string | null; wrongSlot?: string | null; onSlot?: (slot: string) => void }) {
  const t = useT().lesson.game
  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className="relative mx-auto aspect-[4/3] max-w-2xl overflow-hidden rounded-2xl border border-signal/25 bg-[linear-gradient(to_bottom,var(--color-signal-soft)_0_63%,#d8bd98_63%_100%)] p-2 sm:p-4">
        <div className="absolute top-2 right-3 h-16 w-20 rounded-lg border-4 border-white bg-[#bfe6ff] shadow-inner sm:h-24 sm:w-32"><span className="absolute inset-x-0 top-1/2 border-t-2 border-white" /><span className="absolute inset-y-0 left-1/2 border-l-2 border-white" /></div>
        <div className="relative z-10 grid h-full grid-cols-4 grid-rows-3 gap-1.5 sm:gap-3">
          {roomSlots.map((slot) => {
            const word = Object.entries(matches).find(([, value]) => value === slot.id)?.[0]
            return (
              <button key={slot.id} type="button" disabled={!onSlot} onClick={() => onSlot?.(slot.id)} style={{ gridColumn: slot.gridColumn, gridRow: slot.gridRow }} className={cx('flex min-h-0 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-ground-raised/70 p-1 text-center shadow-sm transition sm:p-2', selected && 'hover:border-signal hover:bg-ground-raised', wrongSlot === slot.id ? 'animate-pulse border-danger bg-danger-soft' : word ? 'border-milestone bg-milestone-soft/90' : 'border-ground-raised/90')}>
                <RoomCellIcon word={word} slot={slot.id} className="size-5 sm:size-6" />
                <span className={cx('mt-0.5 max-w-full wrap-break-word text-[9px] font-black leading-tight sm:text-xs', word ? 'text-milestone' : 'text-ink-muted')}>{word ? <RussianText text={word} /> : t.slots[slot.label]}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function FamilyCrossword({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const t = useT().lesson.game
  const clues = lesson.game.clues ?? []
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [wrong, setWrong] = useState<string | null>(null)
  const solved = gameProgress(lesson, matches).done

  function check(answer: string) {
    const value = (answers[answer] ?? '').trim().toLocaleLowerCase('ru-RU')
    if (value.replaceAll('ё', 'е') === answer.replaceAll('ё', 'е')) {
      onChange({ ...matches, [answer]: answer })
      setWrong(null)
      celebrate()
      return
    }
    setWrong(answer)
    playUiSound('wrong')
  }

  return (
    <div className="space-y-3">
      <GameHeader lesson={lesson} count={`${solved}/${clues.length}`} />
      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-2xl bg-signal-soft">
          <img src={lesson.sceneImage} alt={t.familyPhotoAlt} className="h-full w-full object-cover" />
          <div className="absolute inset-0 grid" style={coverGridStyle(clues.length)} aria-hidden="true">
            {clues.map(({ answer }) => <span key={answer} className={cx('border border-white/25 bg-ink/80 transition-all duration-500', matches[answer] && 'scale-0 opacity-0')} />)}
          </div>
        </div>
      </Card>
      <div className="grid gap-2 sm:grid-cols-2">
        {clues.map(({ clue, answer }, index) => {
          const done = matches[answer] === answer
          return (
            <Card key={answer} className={cx('p-3', done && 'border-milestone bg-milestone-soft/40', wrong === answer && 'border-danger')}>
              <p className="text-xs font-black text-ink-muted">{index + 1}. <RussianText text={clue} /></p>
              <div className="mt-2 flex gap-2">
                <input
                  value={done ? answer : answers[answer] ?? ''}
                  disabled={done}
                  lang="ru"
                  aria-invalid={wrong === answer}
                  onChange={(event) => {
                    setAnswers((current) => ({ ...current, [answer]: event.target.value }))
                    if (wrong === answer) setWrong(null)
                  }}
                  onKeyDown={(event) => { if (event.key === 'Enter') check(answer) }}
                  placeholder={'_ '.repeat(answer.length).trim()}
                  className="min-w-0 flex-1 rounded-xl border border-hairline bg-ground px-3 py-2 text-sm font-black text-ink outline-none focus:border-signal disabled:text-milestone"
                />
                <button type="button" disabled={done} onClick={() => check(answer)} className="raised raised-signal rounded-xl bg-signal px-3 text-sm font-black text-on-signal disabled:bg-milestone">{done
                ? <Check aria-hidden="true" strokeWidth={3} className="size-4" />
                : <ArrowRight aria-hidden="true" strokeWidth={2.4} className="size-4" />}</button>
              </div>
              {/* A red border alone did not say what was wrong: the word, or only its spelling. */}
              {wrong === answer && (
                <p role="status" className="mt-1.5 text-xs font-bold text-danger">
                  {(answers[answer] ?? '').trim().length === answer.length
                    ? t.crosswordSpelling
                    : fill(t.crosswordLength, { count: answer.length })}
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function MissionModes({
  lesson,
  missionId,
  dialoguePractised,
  aiChatStarted,
  aiAnswered,
  aiSkipped,
  onDialoguePractised,
  onAiChatStarted,
  onAiAnswered,
  onAiSkipped,
}: {
  lesson: LessonData
  missionId?: string
  dialoguePractised: boolean
  aiChatStarted: boolean
  aiAnswered: number[]
  aiSkipped: boolean
  onDialoguePractised: () => void
  onAiChatStarted: () => void
  onAiAnswered: (index: number) => void
  onAiSkipped: () => void
}) {
  const dictionary = useT()
  const { locale } = useLocale()
  const t = dictionary.lesson.missions
  const voiceErrors = dictionary.voiceErrors
  // The block runs in order: practise the dialogue line by line, then carry it into the AI
  // conversation. A learner coming back to a finished dialogue lands straight in the AI step.
  const [mode, setMode] = useState<'dialogue' | 'ai'>(aiChatStarted ? 'ai' : 'dialogue')
  const [revealed, setRevealed] = useState(() => (dialoguePractised ? lesson.dialogue.length : 1))
  const dialogueDone = revealed >= lesson.dialogue.length

  function revealNext() {
    const next = Math.min(revealed + 1, lesson.dialogue.length)
    setRevealed(next)
    if (next >= lesson.dialogue.length) onDialoguePractised()
  }

  function startAiChat() {
    onDialoguePractised()
    onAiChatStarted()
    setMode('ai')
  }

  const [questionIndex, setQuestionIndex] = useState(() => {
    const next = lesson.questions.findIndex((_, index) => !aiAnswered.includes(index))
    return next < 0 ? lesson.questions.length - 1 : next
  })
  const [showAnswer, setShowAnswer] = useState(false)
  /*
   * What the AI said back, or what went wrong. Kept apart because they look different: a
   * refused microphone printed in success green read as praise.
   */
  const [feedback, setFeedback] = useState<{ kind: 'note' | 'error'; text: string } | null>(null)
  /**
   * The browser is asking for the microphone right now. The note explaining that prompt sat
   * under the mic from the start, as one more line nobody needed yet; it shows while the
   * browser's own prompt is open, which is when it helps.
   */
  const [micPending, setMicPending] = useState(false)
  const [listening, setListening] = useState(false)
  const allAnswered = lesson.questions.every((_, index) => aiAnswered.includes(index))
  const answeredEnough = aiAnswered.length >= aiAnswerTarget(lesson.questions.length)

  function goToQuestion(index: number) {
    setQuestionIndex(index)
    setShowAnswer(false)
    setFeedback(null)
  }

  /** After an answer: the next question not yet answered, if any. */
  function nextOpenQuestion(from: number, answered: number[]) {
    for (let step = 1; step <= lesson.questions.length; step += 1) {
      const index = (from + step) % lesson.questions.length
      if (!answered.includes(index)) return index
    }
    return null
  }
  const [processing, setProcessing] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const attemptRef = useRef<StartAttemptResponse | null>(null)

  useEffect(() => () => {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') {
      recorder.onstop = null
      recorder.onerror = null
      recorder.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  async function requireAttempt() {
    if (!missionId) throw new VoiceError('connect_failed')
    if (attemptRef.current && !attemptRef.current.requiresExplicitRestart) return attemptRef.current
    let attempt = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts`)
    if (attempt.requiresExplicitRestart) {
      attempt = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts?restart=true`)
    }
    attemptRef.current = attempt
    return attempt
  }

  async function toggleRecording(onDone?: () => void) {
    if (listening) {
      recorderRef.current?.stop()
      return
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new VoiceError('mic_unsupported')
      }
      setMicPending(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).finally(() => setMicPending(false))
      streamRef.current = stream
      // Keep the permission request inside the learner's tap; Android may reject it after a network await.
      const attempt = await requireAttempt()
      const mimeType = preferredRecordingMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      setFeedback(null)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const recordedType = recorder.mimeType || mimeType || 'audio/webm'
        const audio = new Blob(chunksRef.current, { type: recordedType })
        setListening(false)
        recorderRef.current = null
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        void submitRecording(audio, recordedType, attempt, onDone)
      }
      recorder.onerror = () => {
        setListening(false)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setFeedback({ kind: 'error', text: voiceErrors.mic_failed })
      }
      recorder.start()
      setListening(true)
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setListening(false)
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      const missing = error instanceof DOMException && error.name === 'NotFoundError'
      setFeedback({
        kind: 'error',
        text: denied
          ? voiceErrors.mic_denied
          : missing
            ? voiceErrors.mic_not_found
            : error instanceof VoiceError
              ? voiceErrors[error.code]
              : error instanceof RequestError
                ? error.message
                : voiceErrors.mic_failed,
      })
    }
  }

  async function submitRecording(audio: Blob, mimeType: string, attempt: StartAttemptResponse, onDone?: () => void) {
    if (audio.size === 0) {
      setFeedback({ kind: 'error', text: t.emptyRecording })
      return
    }
    setProcessing(true)
    try {
      const stepIndex = mode === 'ai'
        ? Math.min(questionIndex + 1, Math.max(attempt.totalSteps - 1, 0))
        : Math.min(Math.max(attempt.currentStepIndex, 1), Math.max(attempt.totalSteps - 1, 0))
      const form = new FormData()
      form.set('attemptId', attempt.attemptId)
      form.set('stepIndex', String(stepIndex))
      form.set('isRetry', 'false')
      if (mode === 'dialogue') {
        form.set('practiceMode', 'full-dialogue')
        form.set('expectedText', lesson.dialogue.join(' '))
      }
      form.set('audio', audio, `foundation-answer.${recordingExtension(mimeType)}`)
      const result = await api.postForm<VoiceNoteTurnFeedback>('/missions/attempts/voice-note', form)
      attemptRef.current = { ...attempt, currentStepIndex: result.feedback.nextStepIndex }
      const message = [
        result.transcript ? fill(t.youSaid, { text: result.transcript }) : '',
        result.feedback.strengthNote,
        result.feedback.headlineCorrection,
        result.feedback.pronunciationNote,
      ].filter(Boolean).join('. ')
      setFeedback({ kind: 'note', text: message })
      const spokenFeedback = [result.feedback.strengthNote, result.feedback.headlineCorrection, result.feedback.pronunciationNote].filter(Boolean).join('. ')
      // The server writes the feedback in the learner's language, so it is read in that voice.
      await speak(spokenFeedback, SPEECH_TAG[locale])
      // An answer counts only when something was heard: any recording, silence included, used
      // to tick the question off.
      if (result.transcript?.trim()) onDone?.()
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof RequestError ? error.message : t.checkFailed })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <StepBadge index={1} title={t.practiseDialogue} active={mode === 'dialogue'} done={dialoguePractised} />
        <StepBadge index={2} title={t.aiChat} active={mode === 'ai'} done={aiChatStarted} />
      </div>

      {mode === 'dialogue' ? (
        <div>
          {/* The instruction is the step's subtitle now, above the card, rather than said twice. */}
          <div className="grid gap-2">
            {lesson.dialogue.slice(0, revealed).map((line, index) => (
              <div key={`${line}-${index}`} className={cx('flex items-start gap-2 rounded-2xl p-3 text-sm leading-relaxed sm:text-base', index % 2 === 0 ? 'mr-6 bg-ground-sunken' : 'ml-6 bg-signal-soft')}>
                <SpeechButton
                  text={dialogueSpeechText(line)}
                  lang="ru-RU"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ground-raised text-signal-ink shadow-sm"
                />
                <span className="min-w-0 flex-1"><DialogueLine line={line} /></span>
              </div>
            ))}
          </div>
          {/*
            "Next line" moves the step on, so it is the main action. Recording the whole dialogue
            is optional practice — it was the largest control here while counting for nothing.
            The line count sits on the button it belongs to, not under the mic.
          */}
          <div className="mt-3">
            {dialogueDone
              ? <Button size="lg" block onClick={startAiChat}><span className="whitespace-normal leading-tight">{t.goToAi}</span></Button>
              : (
                <Button size="lg" block onClick={revealNext}>
                  {t.nextLine}
                  <span className="ml-1.5 rounded-full bg-on-signal/20 px-2 text-xs tabular-nums">{Math.min(revealed, lesson.dialogue.length)}/{lesson.dialogue.length}</span>
                </Button>
              )}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-ground-sunken p-2.5">
            <button
              type="button"
              onClick={() => void toggleRecording()}
              disabled={processing}
              aria-label={listening ? t.stopRecording : t.mic}
              className={cx('flex size-10 shrink-0 items-center justify-center rounded-full disabled:opacity-60', listening ? 'animate-pulse bg-danger text-on-danger' : 'bg-signal-soft text-signal-ink')}
            >
              {processing
                ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : listening
                  ? <Square aria-hidden="true" strokeWidth={0} className="size-4 fill-current" />
                  : <Mic aria-hidden="true" strokeWidth={1.9} className="size-5" />}
            </button>
            <p className="min-w-0 text-sm font-bold text-ink-muted">{listening ? t.micStopDialogue : t.micDialogue}</p>
          </div>
          {micPending && <p className="mt-1 text-center text-xs text-ink-faint">{t.micPermissionAhead}</p>}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-xs font-black tracking-[.14em] text-signal-ink uppercase">
            {fill(t.answeredOf, { done: aiAnswered.length, total: lesson.questions.length })}
          </p>
          {allAnswered ? (
            // A finished block says so and points at the button that moves on, instead of
            // staying on the last question forever.
            <p role="status" className="mt-3 rounded-2xl bg-milestone-soft p-5 text-base font-black text-milestone">
              {t.allAnswered}
            </p>
          ) : (
            <>
              <SpeechButton text={lesson.questions[questionIndex].question} lang="ru-RU" autoPlayToken={`${mode}-${questionIndex}`} className="raised raised-signal-soft mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-signal-soft p-5 text-xl font-black text-ink"><RussianText text={lesson.questions[questionIndex].question} /></SpeechButton>
              {showAnswer ? (
                <div className="mt-2 rounded-xl bg-ground-sunken p-3 text-left">
                  <p className="text-xs font-black tracking-[.12em] text-ink-faint uppercase">{t.sampleAnswer}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink"><RussianText text={lesson.questions[questionIndex].answer} /></p>
                </div>
              ) : (
                <button type="button" onClick={() => setShowAnswer(true)} className="mt-2 text-sm font-black text-signal-ink underline">
                  {t.showAnswer}
                </button>
              )}
              <MicButton
                listening={listening}
                processing={processing}
                caption={listening ? t.micStopAnswer : t.micAnswer}
                onClick={() => void toggleRecording(() => {
                  const answered = aiAnswered.includes(questionIndex) ? aiAnswered : [...aiAnswered, questionIndex]
                  onAiAnswered(questionIndex)
                  const next = nextOpenQuestion(questionIndex, answered)
                  if (next !== null) setTimeout(() => goToQuestion(next), 900)
                })}
              />
              {micPending && <p className="mt-1 text-center text-xs text-ink-faint">{t.micPermissionAhead}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {lesson.questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => goToQuestion(nextOpenQuestion(questionIndex, aiAnswered) ?? (questionIndex + 1) % lesson.questions.length)}
                    className="text-sm font-black text-ink-muted underline"
                  >
                    {t.nextQuestion}
                  </button>
                )}
                <button type="button" onClick={() => setMode('dialogue')} className="text-sm font-black text-ink-muted underline">{t.backToDialogue}</button>
              </div>
            </>
          )}
          {/* For a learner whose microphone will not work: an explicit way on, not a hidden one. */}
          {!answeredEnough && !aiSkipped && (
            <button type="button" onClick={onAiSkipped} className="mt-4 text-xs font-bold text-ink-faint underline">
              {t.continueWithoutMic}
            </button>
          )}
        </div>
      )}
      {feedback && (
        feedback.kind === 'error'
          ? <div className="mt-3"><ErrorNote>{feedback.text}</ErrorNote></div>
          : <p role="status" className="mt-3 rounded-xl bg-milestone-soft p-3 text-sm text-milestone"><RussianText text={feedback.text} /></p>
      )}
    </Card>
  )
}

function StepBadge({ index, title, active, done }: { index: number; title: string; active: boolean; done: boolean }) {
  const t = useT().lesson.missions
  return (
    <div className={cx('rounded-xl border-2 px-3 py-2', active ? 'border-signal bg-signal-soft' : done ? 'border-milestone bg-milestone-soft/40' : 'border-hairline bg-ground-sunken')}>
      <p className="text-[10px] font-black tracking-[.12em] text-ink-faint uppercase">{fill(t.step, { n: index })} {done && !active ? '✓' : ''}</p>
      <p className={cx('text-xs font-black', active ? 'text-signal-ink' : 'text-ink-muted')}>{title}</p>
    </div>
  )
}

/** The speaker label in front of a dialogue line is a stage direction, not something to read out. */
function dialogueSpeechText(line: string) {
  const separator = line.indexOf(':')
  return separator < 0 ? line : line.slice(separator + 1).trim()
}

function DialogueLine({ line }: { line: string }) {
  const separator = line.indexOf(':')
  if (separator < 0) return <RussianText text={line} />
  return <><span className="text-ink">{line.slice(0, separator + 1)}</span><RussianText text={line.slice(separator + 1)} /></>
}

/** The microphone, with what to do written under it: a bare round button explained nothing. */
function MicButton({ listening, processing, caption, onClick }: { listening: boolean; processing: boolean; caption: string; onClick: () => void }) {
  const t = useT().lesson.missions
  return <>
    <MicRoundButton listening={listening} processing={processing} onClick={onClick} label={listening ? t.stopRecording : t.mic} />
    <p className="mt-2 text-center text-sm font-bold text-ink-muted">{caption}</p>
  </>
}

function MicRoundButton({ listening, processing, onClick, label }: { listening: boolean; processing: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} disabled={processing} className={cx('raised mx-auto mt-4 flex size-16 items-center justify-center rounded-full text-2xl disabled:opacity-60', listening ? 'animate-pulse bg-danger text-on-danger raised-danger' : 'bg-signal text-on-signal raised-signal')} aria-label={label}>{processing ? <span className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" /> : listening
      ? <Square aria-hidden="true" strokeWidth={0} className="size-5 fill-current" />
      : <Mic aria-hidden="true" strokeWidth={1.9} className="size-6" />}</button>
}

function VocabularySection({ words, reviewed, onReviewed }: {
  words: Vocab[]
  reviewed: number
  onReviewed: (count: number) => void
}) {
  const t = useT().lesson.vocabulary
  const [open, setOpen] = useState(false)
  const target = vocabularyTarget(words.length)
  const finishedDeck = reviewed >= words.length
  // Reopening picks up where the learner stopped; a finished deck starts a fresh pass.
  const startIndex = finishedDeck ? 0 : reviewed

  return (
    <>
      {/* One title and one progress line: the count used to appear twice, plus a third line
          saying how many to look at. */}
      <Card className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-4 sm:p-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-signal-soft sm:size-16"><Layers aria-hidden="true" strokeWidth={1.6} className="size-8 text-signal-ink" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-black text-ink">{t.deckTitle}</h3>
          <p className="mt-1 text-sm font-bold text-ink-muted tabular-nums">
            {fill(t.progress, { seen: Math.min(reviewed, words.length), total: words.length, count: target })}
            {reviewed >= target && <Check aria-hidden="true" strokeWidth={3} className="ml-1 inline size-3.5 text-milestone" />}
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>{reviewed > 0 && !finishedDeck ? t.resume : t.open}</Button>
      </Card>
      {open && (
        <VocabularyDeck
          words={words}
          startIndex={startIndex}
          onClose={() => setOpen(false)}
          onReviewed={onReviewed}
        />
      )}
    </>
  )
}

function VocabularyDeck({ words, startIndex, onClose, onReviewed }: {
  words: Vocab[]
  startIndex: number
  onClose: () => void
  onReviewed: (count: number) => void
}) {
  const t = useT().lesson.vocabulary
  const closeLabel = useT().lesson.phrases.close
  const dialogRef = useFocusTrap<HTMLDivElement>()
  /*
   * The deck as a queue of card indexes. "Don't know" and "review" send a card to the back once,
   * so it comes round again before the deck closes; every rating used to just move on.
   */
  const [queue, setQueue] = useState(() => words.map((_, index) => index).slice(startIndex))
  const [requeued, setRequeued] = useState<Set<number>>(() => new Set())
  const [flipped, setFlipped] = useState(false)
  const index = queue[0] ?? 0
  const word = words[index]
  const comingBack = queue.filter((card, position) => position > 0 && requeued.has(card)).length
  function rate(rating: Rating) {
    // "Don't know" is an honest answer, not a wrong one: it gets the neutral sound, as on the
    // phrase card.
    playUiSound(rating === 'known' ? 'coin' : 'select')
    // Rating a card banks it, so closing early keeps everything seen up to this point.
    if (!requeued.has(index)) onReviewed(index + 1)
    const sendBack = rating !== 'known' && !requeued.has(index)
    const rest = queue.slice(1)
    const next = sendBack ? [...rest, index] : rest
    if (sendBack) setRequeued((current) => new Set(current).add(index))
    if (next.length === 0) { onClose(); return }
    setQueue(next)
    setFlipped(false)
  }
  return createPortal(
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[90] overflow-y-auto bg-ground p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto flex min-h-full max-w-lg flex-col">
        <div className="flex items-center justify-between gap-3 py-2 text-sm font-black text-ink-muted">
          <span className="tabular-nums">
            {index + 1} / {words.length}
            {comingBack > 0 && <span className="ml-2 text-caution">{fill(t.comingBack, { count: comingBack })}</span>}
          </span>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="raised raised-sm flex size-10 items-center justify-center rounded-full border border-hairline text-xl text-ink">×</button>
        </div>
        <div className="flex flex-1 items-center py-2">
          <div role="button" tabIndex={0} onClick={() => setFlipped((current) => !current)} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setFlipped((current) => !current)
            }
          }} className="w-full cursor-pointer overflow-hidden rounded-[1.75rem] border-2 border-hairline bg-ground-raised text-left shadow-[0_12px_35px_rgba(20,35,60,.14)]">
            <div className="flex h-32 items-center justify-center bg-signal-soft text-6xl sm:h-40">{word.icon}</div>
            <div className="min-h-52 p-5 sm:min-h-60 sm:p-7">
              {!flipped ? (
                <><h2 className="text-2xl font-black wrap-break-word text-ink min-[390px]:text-3xl"><RussianText text={word.ru} /></h2><p className="mt-4 rounded-xl bg-ground-sunken p-3 leading-relaxed text-ink"><RussianText text={word.example} /></p><SpeechButton text={word.ru} lang="ru-RU" stopPropagation className="raised raised-signal mt-4 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-black text-on-signal">{t.listenAndRepeat}</SpeechButton></>
              ) : (
                // The back is the translation alone: it used to repeat the front's example
                // sentence and add a hint to tap, which the card already answers to.
                <div className="flex min-h-40 items-center justify-center sm:min-h-48"><h2 className="text-center text-2xl font-black wrap-break-word text-ink min-[390px]:text-3xl">{word.uz}</h2></div>
              )}
            </div>
          </div>
        </div>
        {/* The labels come from the dictionary: hard-coded Russian could not be read on day one. */}
        {flipped && <div className="grid grid-cols-3 gap-2 py-3"><button type="button" onClick={() => rate('known')} className="raised raised-signal rounded-xl bg-signal px-1 py-3 text-xs font-black text-on-signal">{t.known}</button><button type="button" onClick={() => rate('unknown')} className="raised raised-danger-soft rounded-xl border border-danger px-1 py-3 text-xs font-black text-danger">{t.unknown}</button><button type="button" onClick={() => rate('repeat')} className="raised rounded-xl border border-hairline px-1 py-3 text-xs font-black text-ink">{t.again}</button></div>}
      </div>
    </div>, document.body,
  )
}

function ExerciseSection({ lesson, answer, onAnswerChange }: {
  lesson: LessonData
  answer: string
  onAnswerChange: (answer: string) => void
}) {
  const t = useT().lesson.exercise
  // Only some days actually put a picture here; the rest are pure writing tasks, so the
  // heading icon should not promise an illustration that never arrives.
  const hasScene = lesson.day === 1 || Boolean(lesson.sceneImage) || lesson.game.kind === 'room-builder'
  const lessonT = useT().lesson
  const segments = splitBlankSegments(lesson.exercise.starter)
  const hasBlanks = segments.length > 1
  const fullText = fillTemplate(segments, answer)
  // The sample stays folded: shown up front, it was there to copy before the learner had tried.
  const [sampleOpen, setSampleOpen] = useState(false)
  const latinOnly = blankAnswers(lesson.exercise.starter, answer).some((value) => value.trim().length > 0 && !hasRussian(value))

  return (
    <Card className="p-4 sm:p-5">
      {lesson.day === 1 && <NeighborScene />}
      {lesson.sceneImage && <img src={lesson.sceneImage} alt={t.familyPhoto} className="mb-4 aspect-square w-full rounded-2xl object-cover sm:aspect-[16/10]" />}
      {lesson.game.kind === 'room-builder' && <div className="mb-4"><RoomScene /></div>}

      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-signal-soft ">{hasScene
            ? <Image aria-hidden="true" strokeWidth={1.8} className="size-6 text-signal-ink" />
            : <PenLine aria-hidden="true" strokeWidth={1.8} className="size-6 text-signal-ink" />}</span>
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-muted">{lesson.exercise.instruction}</p>
      </div>

      {hasBlanks ? (
        <BlankFillTemplate segments={segments} answer={answer} onAnswerChange={onAnswerChange} />
      ) : (
        <>
          <div className="mt-3 rounded-xl bg-ground-sunken p-3">
            <p className="text-xs font-black tracking-[.12em] text-ink-faint uppercase">{t.template}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink"><RussianText text={lesson.exercise.starter} /></p>
          </div>
          <textarea
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder={t.placeholder}
            lang="ru"
            className="mt-4 min-h-32 w-full rounded-2xl border border-hairline bg-ground p-3 text-ink outline-none focus:border-signal"
          />
        </>
      )}

      {/* Reading an unfilled blank template aloud would just voice silence where each input is. */}
      {fullText.trim() && (
        <SpeechButton text={fullText} lang="ru-RU" className="raised raised-sm raised-signal-soft mt-3 inline-flex items-center gap-2 rounded-full bg-signal-soft px-4 py-2 text-sm font-black text-signal-ink">
          {t.listenToText}
        </SpeechButton>
      )}

      {latinOnly && <p role="status" className="mt-2 text-sm font-bold text-danger">{lessonT.needRussian}</p>}

      {lesson.exercise.example && (sampleOpen ? (
        <div className="mt-4 rounded-xl border border-hairline bg-ground-sunken p-3">
          <p className="text-xs font-black tracking-[.12em] text-ink-muted uppercase">{t.sample}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink"><RussianText text={lesson.exercise.example} /></p>
        </div>
      ) : (
        <button type="button" onClick={() => setSampleOpen(true)} className="mt-4 block text-sm font-black text-signal-ink underline">
          {t.showSample}
        </button>
      ))}
    </Card>
  )
}

function BlankFillTemplate({ segments, answer, onAnswerChange }: {
  segments: string[]
  answer: string
  onAnswerChange: (answer: string) => void
}) {
  const blankCount = segments.length - 1
  const values = readBlankValues(answer)
  const setBlank = (index: number, value: string) => {
    const next = Array.from({ length: blankCount }, (_, i) => (i === index ? value : values[i] ?? ''))
    onAnswerChange(next.join(BLANK_DELIMITER))
  }
  return (
    <p className="mt-4 rounded-2xl border border-hairline bg-ground p-3 text-sm leading-relaxed text-ink">
      {segments.map((segment, index) => (
        <span key={index}>
          <RussianText text={segment} />
          {index < blankCount && (
            <BlankInput value={values[index] ?? ''} onChange={(value) => setBlank(index, value)} />
          )}
        </span>
      ))}
    </p>
  )
}

/**
 * A native <input> can never wrap its own text — a long answer just pushes the whole box onto
 * its own line instead of breaking like the surrounding sentence does. contentEditable flows
 * inline with the paragraph and wraps normally, so this is uncontrolled by design: React sets the
 * DOM text once (on mount, or when the answer changes from outside — a lesson switch, the
 * stale-data reset), and every keystroke after that is read out via onInput without writing back
 * into the DOM. Feeding `value` back in as the rendered content on every keystroke is the standard
 * contentEditable-in-React trap — the cursor jumps to the start on each render.
 *
 * While empty it is an inline-block instead. An empty *inline* editable has no text for the caret
 * to sit in, so when the sentence wraps right after it — which only happens on a narrow screen —
 * a tap focuses the blank but the browser drops the caret into the neighbouring plain text:
 * nothing typed lands, and a phone keyboard may not even open. An inline-block is a box of its
 * own and always takes the caret. With no text to wrap, being a box costs nothing; the first
 * letter makes it inline again.
 */
function BlankInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const lastSynced = useRef<string | null>(null)

  useEffect(() => {
    if (ref.current && lastSynced.current !== value && ref.current.textContent !== value) {
      ref.current.textContent = value
    }
    lastSynced.current = value
  }, [value])

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={(event) => {
        const text = event.currentTarget.textContent ?? ''
        // Erasing everything can leave a stray <br> behind, which keeps :empty from matching and
        // would put the blank back into the inline state that can't take a caret.
        if (!text && event.currentTarget.firstChild) event.currentTarget.replaceChildren()
        lastSynced.current = text
        onChange(text)
      }}
      onKeyDown={(event) => {
        // A blank holds one short answer, not a paragraph — swallow the newline Enter would add.
        if (event.key === 'Enter') event.preventDefault()
      }}
      lang="ru"
      className="mx-0.5 break-words border-b-2 border-ink-faint bg-ground-sunken px-1 font-black text-ink outline-none empty:inline-block empty:min-h-[1.4em] empty:min-w-10 empty:px-0 empty:align-bottom focus:border-signal focus:bg-signal-soft"
    />
  )
}

function NeighborScene() {
  const t = useT().lesson.missions
  return (
    <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-2xl bg-[linear-gradient(180deg,var(--color-signal-soft)_0_62%,#d7c4a7_62%)]">
      <div className="absolute top-5 left-1/2 h-24 w-28 -translate-x-1/2 rounded-t-full border-[10px] border-[#a66b43] bg-[#fff4d7] sm:h-36 sm:w-40" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-5 sm:gap-10">
        <MascotImage mascot="penguin" className="h-32 w-28 sm:h-48 sm:w-40" />
        <MascotImage mascot="panda" className="h-28 w-28 sm:h-44 sm:w-40" />
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-ground-raised/90 px-3 py-1 text-xs font-black text-signal-ink">{t.twoNeighbours}</span>
    </div>
  )
}

function CompleteSection({ lesson, recording }: {
  lesson: LessonData
  recording: 'idle' | 'saving' | 'saved' | 'failed'
}) {
  const dictionary = useT()
  const t = dictionary.lesson.complete
  useEffect(() => { celebrate([45, 45, 80], 'win') }, [])
  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })
  const nextDay = lesson.day + 1
  // What finishing opened. Past the plan it is Pro, and that is said here rather than met as a
  // lock on the path.
  const nextNeedsPro =
    entitlement !== undefined && !entitlement.hasProAccess && nextDay > entitlement.maxUnlockedDay
  return (
    <Card className="relative overflow-hidden border-milestone bg-milestone-soft/35 p-5 text-center sm:p-8">
      <Celebration pieces={180} balloons={34} />
      <MascotImage mascot="penguin" className="mx-auto h-28 w-28 object-contain" />
      <span className="mt-2 inline-flex rounded-full bg-milestone-soft px-3 py-1.5 text-sm font-black text-milestone">{fill(t.badge, { day: lesson.day })}</span>
      <h3 className="mt-3 text-3xl font-black text-ink">{t.title}</h3>
      {/* Only a lesson's own message: the general one said "done" a third time, after the badge
          and the title, before the outcomes that are the useful part. */}
      {lesson.completionMessage && (
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{lesson.completionMessage}</p>
      )}
      <div className="mt-5 grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
        {/*
          The card's tone is decoration, so it rides on a bar rather than on the words: painting the
          heading tinted every word the grammar colouring deliberately left alone — the "и" in
          "Мой и моя" and the bare letters of "Ы и И" came out looking like gender-coded vocabulary.
        */}
        {lesson.outcomes.map((outcome) => (
          <div key={outcome.title} className="rounded-2xl bg-ground-raised p-3">
            <span aria-hidden="true" className={cx('mx-auto mb-2 block h-1.5 w-8 rounded-full', outcome.tone === 'yellow' ? 'bg-[#e5b600]' : outcome.tone === 'red' ? 'bg-[#ff2400]' : 'bg-[#0000ff]')} />
            <h4 className="font-black text-ink"><RussianText text={outcome.title} /></h4>
            <p className="text-sm text-ink-muted">{outcome.translation}</p>
          </div>
        ))}
      </div>
      {/* Saving again is the main button under the card while this shows. */}
      {recording === 'failed' && (
        <div className="mt-4 text-left">
          <ErrorNote>{t.saveFailed}</ErrorNote>
        </div>
      )}
      {recording === 'saved' && nextDay <= 90 && entitlement && (
        <div className="mt-5 rounded-2xl bg-ground-raised p-4 text-left">
          <p className="font-black text-ink">
            {fill(nextNeedsPro ? t.nextNeedsPro : t.nextOpened, { day: nextDay })}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{nextNeedsPro ? t.nextNeedsProBody : t.nextOpenedBody}</p>
          {nextNeedsPro && (
            <LinkButton to="/paywall" size="md" className="mt-3">{dictionary.path.buyPro}</LinkButton>
          )}
        </div>
      )}
      {/* The lesson data still carries `reflection` questions; the closing card no longer asks them. */}
      {lesson.completionAction && <a href={lesson.completionAction.href} target="_blank" rel="noreferrer" className="raised raised-signal mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-signal px-5 py-2.5 text-sm font-black text-on-signal">{lesson.completionAction.label} <ArrowUpRight aria-hidden="true" strokeWidth={2.4} className="inline size-4" /></a>}
    </Card>
  )
}

function MascotImage({ mascot, className }: { mascot: Mascot; className?: string }) {
  return <img src={mascotImage(mascot)} alt={mascotAlt(mascot)} className={cx('object-contain', className)} />
}

function preferredRecordingMimeType() {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    .find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ''
}

function recordingExtension(mimeType: string) {
  return mimeType.includes('mp4') ? 'm4a' : 'webm'
}

async function speak(text: string, lang: string) {
  if (readAudioPreferences().muted) return
  window.dispatchEvent(new CustomEvent('rgg-speech-start', { detail: { id: null } }))
  try {
    await new Promise<void>((resolve, reject) => {
      let started = false
      void playPromptAudio(cleanSpeechText(text), {
        onStateChange: (state) => {
          if (state === 'playing') started = true
          if (state === 'idle' && started) resolve()
        },
      }).catch(reject)
    })
  } catch {
    await new Promise<void>((resolve) => speakWithBrowser(text, lang, resolve))
  }
}

/**
 * Whether the learner has played anything by hand in this visit. A new AI question plays itself
 * only after that: sound starting on its own surprised a learner in a quiet room, and a browser
 * that blocks autoplay before any tap left the button spinning.
 */
let audioUnlocked = false

function SpeechButton({ text, lang, children, className, stopPropagation = false, autoPlayToken, rate, icon }: {
  text: string
  lang: string
  /**
   * The label beside the glyph. Omitted for the icon-only buttons — the round ones in the
   * dialogue and the matching game — where the play glyph is the whole control.
   */
  children?: ReactNode
  className?: string
  stopPropagation?: boolean
  autoPlayToken?: string
  rate?: number
  /** Shown in place of the play glyph while idle — the tongue twister's speed marks. */
  icon?: ReactNode
}) {
  const t = useT().lesson.audio
  const id = useId()
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle')

  async function start() {
    if (readAudioPreferences().muted) return
    window.speechSynthesis?.cancel()
    window.dispatchEvent(new CustomEvent('rgg-speech-start', { detail: { id } }))
    try {
      await playPromptAudio(cleanSpeechText(text), {
        onStateChange: (next) => setStatus(next),
        rate,
      })
    } catch {
      setStatus('playing')
      speakWithBrowser(text, lang, () => setStatus('idle'), rate)
    }
  }

  function toggle(event: React.MouseEvent) {
    if (stopPropagation) event.stopPropagation()
    audioUnlocked = true
    if (status === 'playing') {
      pausePromptAudio()
      window.speechSynthesis?.pause()
      setStatus('paused')
      return
    }
    if (status === 'paused') {
      void resumePromptAudio().then((resumed) => {
        if (!resumed) window.speechSynthesis?.resume()
        setStatus('playing')
      })
      return
    }
    void start()
  }

  useEffect(() => {
    function reset(event: Event) {
      const owner = (event as CustomEvent<{ id: string | null }>).detail?.id
      if (owner !== id) setStatus('idle')
    }
    window.addEventListener('rgg-speech-start', reset)
    return () => window.removeEventListener('rgg-speech-start', reset)
  }, [id])

  useEffect(() => {
    if (autoPlayToken && audioUnlocked) void start()
    // A token is emitted only when a new AI prompt becomes active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayToken])

  return (
    <button type="button" onClick={toggle} className={cx('inline-flex items-center justify-center gap-2', className)} aria-label={status === 'playing' ? t.pause : t.play}>
      {status === 'loading' ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : status === 'playing' ? <PauseGlyph /> : icon ?? <PlayGlyph />}
      {children != null && <span>{children}</span>}
    </button>
  )
}

/** Plays one prompt-audio segment and resolves only once it has actually finished playing —
 * `playPromptAudio` itself resolves as soon as playback *starts*, so callers that need to wait
 * for the end (to chain the next segment) go through this instead. */
function playPromptAudioSegment(text: string, character: Mascot | undefined, onStateChange?: (state: 'idle' | 'loading' | 'playing') => void) {
  return new Promise<void>((resolve, reject) => {
    let started = false
    void playPromptAudio(text, {
      character,
      onStateChange: (state) => {
        onStateChange?.(state)
        if (state === 'playing') started = true
        if (state === 'idle' && started) resolve()
      },
    }).catch(reject)
  })
}

/**
 * Like `SpeechButton`, but for a rule made of several speaker turns: it plays each segment in
 * order, in that segment's own mascot voice, instead of reading the whole passage as one string
 * in one voice.
 */
function RuleSpeechButton({ segments, className, children }: {
  segments: { text: string; character?: Mascot }[]
  className?: string
  children: ReactNode
}) {
  const t = useT().lesson.audio
  const id = useId()
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle')
  const playingRef = useRef(false)

  async function start() {
    if (readAudioPreferences().muted) return
    window.speechSynthesis?.cancel()
    window.dispatchEvent(new CustomEvent('rgg-speech-start', { detail: { id } }))
    playingRef.current = true

    const queue = segments
      .map((segment) => ({ ...segment, text: cleanSpeechText(segment.text) }))
      .filter((segment) => segment.text)

    // Every segment's Gemini request goes out at once. Only playback has to be sequential —
    // the lines still have to be heard in order — so this turns a cold cache from "N requests,
    // N times the wait" back into roughly one request's worth of wait.
    queue.forEach((segment) => void prefetchPromptAudio(segment.text, segment.character))

    try {
      for (const segment of queue) {
        if (!playingRef.current) break
        // Each character's line has to finish before the next one starts.
        await playPromptAudioSegment(segment.text, segment.character, (state) => {
          if (playingRef.current) setStatus(state === 'idle' ? 'loading' : state)
        })
      }
    } catch {
      // One voice for the whole passage beats no audio at all when the provider is down.
      const combined = queue.map((segment) => segment.text).join(' ')
      setStatus('playing')
      // The rule text is lesson content, written in Uzbek whatever the interface language, so
      // the fallback voice stays Uzbek; Russian words in it are split off to a Russian voice.
      await new Promise<void>((resolve) => speakWithBrowser(combined, 'uz-UZ', resolve))
    } finally {
      if (playingRef.current) setStatus('idle')
      playingRef.current = false
    }
  }

  function toggle() {
    audioUnlocked = true
    if (status === 'playing') {
      pausePromptAudio()
      window.speechSynthesis?.pause()
      setStatus('paused')
      return
    }
    if (status === 'paused') {
      void resumePromptAudio().then((resumed) => {
        if (!resumed) window.speechSynthesis?.resume()
        setStatus('playing')
      })
      return
    }
    void start()
  }

  useEffect(() => {
    function reset(event: Event) {
      const owner = (event as CustomEvent<{ id: string | null }>).detail?.id
      if (owner !== id) {
        playingRef.current = false
        setStatus('idle')
      }
    }
    window.addEventListener('rgg-speech-start', reset)
    return () => window.removeEventListener('rgg-speech-start', reset)
  }, [id])

  return (
    <button type="button" onClick={toggle} className={cx('inline-flex items-center justify-center gap-2', className)} aria-label={status === 'playing' ? t.pause : t.play}>
      {status === 'loading' ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : status === 'playing' ? <PauseGlyph /> : <PlayGlyph />}
      {children != null && <span>{children}</span>}
    </button>
  )
}

function speakWithBrowser(text: string, defaultLang: string, onEnd?: () => void, rate = 1) {
  if (!('speechSynthesis' in window)) {
    onEnd?.()
    return
  }
  const segments = splitSpeechByScript(cleanSpeechText(text), defaultLang)
  const voices = window.speechSynthesis.getVoices()
  window.speechSynthesis.cancel()

  function play(index: number) {
    const segment = segments[index]
    if (!segment) {
      onEnd?.()
      return
    }
    const utterance = new SpeechSynthesisUtterance(segment.text)
    utterance.lang = segment.lang
    utterance.rate = (segment.lang === 'ru-RU' ? 0.84 : 0.92) * readAudioPreferences().speed * rate
    utterance.voice = pickVoice(voices, segment.lang)
    utterance.onend = () => play(index + 1)
    utterance.onerror = () => play(index + 1)
    window.speechSynthesis.speak(utterance)
  }

  play(0)
}

function splitSpeechByScript(text: string, defaultLang: string) {
  const segments: Array<{ text: string; lang: string }> = []
  let buffer = ''
  let language = defaultLang
  for (const character of text) {
    const nextLanguage = /[А-Яа-яЁё]/u.test(character) ? 'ru-RU' : /[A-Za-zʻʼ‘’]/u.test(character) ? defaultLang : language
    if (buffer && nextLanguage !== language) {
      segments.push({ text: buffer, lang: language })
      buffer = ''
    }
    language = nextLanguage
    buffer += character
  }
  if (buffer.trim()) segments.push({ text: buffer, lang: language })
  return segments
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string) {
  const prefix = lang.split('-')[0].toLocaleLowerCase()
  const exact = voices.find((voice) => voice.lang.toLocaleLowerCase() === lang.toLocaleLowerCase())
  if (exact) return exact
  const sameLanguage = voices.find((voice) => voice.lang.toLocaleLowerCase().startsWith(prefix))
  if (sameLanguage) return sameLanguage
  if (lang === 'uz-UZ') return voices.find((voice) => voice.lang.toLocaleLowerCase().startsWith('tr')) ?? null
  return null
}

function cleanSpeechText(text: string) {
  return text.replace(/🐧|🐼|🪶|🎭|🎙️/gu, '').replaceAll('—', ',').trim()
}

function readState(storageKey: string | null): StoredState {
  if (!storageKey) return emptyState
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return emptyState
    // `missionModeOpened` is the retired single flag for the dialogue block, still present in
    // state saved before it was split into the two ordered steps.
    const parsed = JSON.parse(raw) as Partial<StoredState> & { missionModeOpened?: boolean }
    const completed = Array.isArray(parsed.completed) ? parsed.completed.filter((id): id is SectionId => sections.some((section) => section.id === id)) : []
    return {
      ...emptyState,
      ...parsed,
      completed,
      sectionIndex: Math.min(Math.max(parsed.sectionIndex ?? 0, 0), sections.length - 1),
      answers: Array.isArray(parsed.answers) ? parsed.answers : [null, null],
      phraseRatings: parsed.phraseRatings ?? {},
      gameMatches: parsed.gameMatches ?? {},
      exerciseAnswer: typeof parsed.exerciseAnswer === 'string' ? parsed.exerciseAnswer : '',
      // Learners who cleared this block under the older single-flag version keep it cleared.
      dialoguePractised: parsed.dialoguePractised === true || parsed.missionModeOpened === true,
      aiChatStarted: parsed.aiChatStarted === true || parsed.missionModeOpened === true,
      aiAnswered: Array.isArray(parsed.aiAnswered) ? parsed.aiAnswered.filter((index) => typeof index === 'number') : [],
      // The old single flag cleared the whole block; those learners are not asked again.
      aiSkipped: parsed.aiSkipped === true || parsed.missionModeOpened === true,
      vocabularyReviewed: typeof parsed.vocabularyReviewed === 'number' && parsed.vocabularyReviewed > 0
        ? parsed.vocabularyReviewed
        : 0,
    }
  } catch { return emptyState }
}

