import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Check,
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
import { fill, useT, type Dictionary } from '../lib/i18n'
import { useFocusTrap } from '../lib/focus-trap'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Card, PauseGlyph, PlayGlyph, ProgressBar } from '../components/ui'
import { ColorScopeProvider, RussianText } from '../components/RussianText'
import { readAudioPreferences } from '../lib/audio-preferences'
import { useAuth } from '../lib/auth-context'
import { cx } from '../lib/cx'
import { foundationLessons, type LessonData, type Mascot, type Phrase, type Quiz, type Vocab } from '../lib/foundation-lessons'
import { mascotAlt, mascotImage } from '../lib/mascot-images'
import { foundationLessonStorageKey } from '../lib/demo-lesson-one'
import { syncLessonOneCompletion } from '../lib/lesson-one-sync'
import { api, RequestError } from '../lib/api'
import { pausePromptAudio, playPromptAudio, prefetchPromptAudio, resumePromptAudio } from '../lib/liveVoice'
import { playUiSound, type UiSound } from '../lib/ui-sounds'
import type { StartAttemptResponse, VoiceNoteTurnFeedback } from '../lib/types'

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
      // Two steps, in order: read the dialogue through, then take it to the AI conversation.
      // Finishing the dialogue alone is not the end of the block — it hands over to the AI part.
      if (!state.dialoguePractised) return gate.dialogue
      return state.aiChatStarted ? null : gate.aiChat
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

function isExerciseAnswered(starter: string, answer: string): boolean {
  const segments = splitBlankSegments(starter)
  if (segments.length === 1) return answer.trim().length > 0
  const values = readBlankValues(answer)
  return segments.slice(0, -1).every((_, index) => (values[index] ?? '').trim().length > 0)
}

function isGameSolved(lesson: LessonData, matches: Record<string, string>): boolean {
  if (lesson.game.kind === 'family-crossword') {
    return (lesson.game.clues ?? []).every((clue) => matches[clue.answer] === clue.answer)
  }
  // The picture game stores a free-text description rather than a fixed right-hand value.
  if (lesson.game.kind === 'picture-description') {
    return lesson.game.pairs.every((pair) => Boolean(matches[pair.left]?.trim()))
  }
  return lesson.game.pairs.every((pair) => matches[pair.left] === pair.right)
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
  vocabularyReviewed: 0,
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

  if (!lesson || day < 1 || day > 15) return <Navigate to="/path" replace />

  async function finishCurrent() {
    const completed = state.completed.includes(active.id)
      ? state.completed
      : [...state.completed, active.id]
    const nextIndex = Math.min(state.sectionIndex + 1, sections.length - 1)
    setState((current) => ({ ...current, completed, sectionIndex: nextIndex }))
    window.scrollTo({ top: 0, behavior: 'smooth' })

    if (active.id === 'complete' && missionId) {
      try {
        await syncLessonOneCompletion(missionId)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['course-map'] }),
          queryClient.invalidateQueries({ queryKey: ['progress'] }),
          queryClient.invalidateQueries({ queryKey: ['home'] }),
        ])
      } catch {
        // Local progress remains safe; CoursePath retries its day-one sync and the learner can retry.
      } finally {
        navigate('/path', { replace: true })
      }
    } else if (active.id === 'complete') {
      navigate('/path', { replace: true })
    }
  }

  function goBack() {
    setState((current) => ({ ...current, sectionIndex: Math.max(0, current.sectionIndex - 1) }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <ColorScopeProvider day={day}>
    <div className="foundation-lesson mx-auto max-w-4xl space-y-4 pb-5 sm:space-y-6">
      <LessonHero lesson={lesson} progress={progress} compact={state.sectionIndex > 0} />

      <section aria-labelledby={`section-${active.id}`}>
        {/*
          The nine steps have names of their own — Просыпайся!, Говори чётко! — and they are the
          same nine in every lesson, so the name alone does not say what this one asks for. The
          line under it does: what the step is in general, or, where the lesson wrote something
          more specific than the general case, that instead.
        */}
        <div className="mb-3 flex items-end gap-3 sm:mb-4">
          {/*
            Filled rather than tinted: this header sits on the page background, not on a card, and
            `signal-soft` on `ground` is two pale greys apart — the tile disappeared and took the
            mark with it.
          */}
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-signal text-on-signal shadow-[0_6px_16px_rgb(31_111_224/0.25)] sm:size-14">
            <active.icon aria-hidden="true" strokeWidth={1.9} className="size-6 sm:size-7" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black tracking-[.1em] text-ink-faint uppercase">
              {fill(t.sectionsOf, { done: state.sectionIndex + 1, total: sections.length })}
            </p>
            <h2 id={`section-${active.id}`} className="text-xl font-black tracking-tight text-ink sm:text-2xl">
              {t.sections[active.id]}
            </h2>
            <p className="mt-0.5 text-sm leading-snug text-ink-muted">
              {active.id === 'picture'
                ? lesson.exercise.title
                : active.id === 'grammar' && day === 1
                  ? t.sections.genderTale
                  : t.sectionNotes[active.id]}
            </p>
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
            onDialoguePractised={() => setState((current) => ({ ...current, dialoguePractised: true }))}
            onAiChatStarted={() => setState((current) => ({ ...current, aiChatStarted: true }))}
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
        {active.id === 'complete' && <CompleteSection lesson={lesson} />}
      </section>

      <div className="border-t border-hairline pt-4">
        <div className="flex items-center gap-2">
          {state.sectionIndex > 0 && <Button variant="ghost" onClick={goBack}>{t.back}</Button>}
          <Button className="ml-auto" disabled={!canContinue} onClick={() => void finishCurrent()}>
            {active.id === 'complete' ? t.finishLesson : t.next}
          </Button>
        </div>
        {/* A disabled button with no reason next to it reads as a broken page. */}
        {blockReason && <p className="mt-2 text-right text-xs font-bold text-ink-muted">{blockReason}</p>}
      </div>
    </div>
    </ColorScopeProvider>
  )
}

function LessonHero({ lesson, progress, compact }: { lesson: LessonData; progress: number; compact: boolean }) {
  const t = useT().lesson
  return (
    <Card className={cx('lesson-hero p-4 sm:p-6', compact && 'py-3 sm:py-4')}>
      {!compact && <>
        <p className="text-xs font-black tracking-[.16em] text-signal-ink uppercase">{fill(t.eyebrow, { day: lesson.day })}</p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-ink sm:text-4xl"><RussianText text={lesson.titleRu} /></h1>
        <p className="mt-1 text-sm text-ink-muted sm:text-base">{lesson.titleUz}</p>
      </>}
      <div className={cx('flex items-center justify-between gap-3 text-xs font-bold sm:text-sm', !compact && 'mt-4')}>
        <span className="text-ink">{t.progress}</span>
        <span className="text-ink-faint">{fill(t.sectionsOf, { done: progress, total: sections.length })}</span>
      </div>
      <div className="mt-2"><ProgressBar value={progress} max={sections.length} label={t.progress} /></div>
    </Card>
  )
}

function TestsSection({ lesson, answers, onAnswer }: { lesson: LessonData; answers: Array<number | null>; onAnswer: (index: number, answer: number) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {lesson.tests.map((quiz, index) => (
        <QuizCard key={quiz.question} quiz={quiz} number={index + 1} answer={answers[index] ?? null} onAnswer={(answer) => onAnswer(index, answer)} />
      ))}
    </div>
  )
}

function QuizCard({ quiz, number, answer, onAnswer }: { quiz: Quiz; number: number; answer: number | null; onAnswer: (answer: number) => void }) {
  const t = useT().lesson
  const correct = answer === quiz.correct
  return (
    <Card className={cx('relative overflow-hidden p-4 sm:p-5', correct && 'border-milestone')}>
      {correct && <Celebration />}
      {quiz.context && <p className="mb-3 text-sm leading-relaxed text-ink-muted"><RussianText text={quiz.context} /></p>}
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ground-sunken text-sm font-black text-ink-muted">{number}</span>
        <h3 className="font-black leading-snug text-ink"><RussianText text={quiz.question} /></h3>
      </div>
      <div className="mt-4 grid gap-2">
        {quiz.options.map((option, index) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              onAnswer(index)
              if (index === quiz.correct) celebrate()
              else playUiSound('wrong')
            }}
            className={cx(
              'rounded-xl border-2 px-3 py-2.5 text-left text-sm font-bold transition',
              answer === index
                ? index === quiz.correct ? 'border-milestone bg-milestone-soft' : 'border-danger bg-danger-soft'
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
          <p>{correct ? quiz.feedback : t.tryAgain}</p>
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
          <RuleSpeechButton segments={speechSegments} className="mt-3 inline-flex items-center gap-2 rounded-full bg-signal-soft px-3 py-2 text-sm font-black text-signal-ink">{t.listen}</RuleSpeechButton>
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
              <MascotImage mascot={mascot} className="mx-auto size-20 sm:size-28" />
              <p className="mt-1 text-[10px] font-bold text-ink sm:text-xs">{kingdom}</p>
              <p
                className="mt-0.5 text-xs font-black sm:text-sm"
                style={{ color, WebkitTextStroke: color === '#FFFF00' ? '0.35px #8a7600' : undefined }}
              >
                {title}
              </p>
              <p className="mt-0.5 text-[10px] font-bold sm:text-xs" style={{ color }}>{colorName}</p>
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
            <SpeechButton key={example} text={example} lang="ru-RU" className={cx('rounded-full border border-hairline bg-ground-raised px-3 py-2 font-black text-ink shadow-sm', /^[АОУ]$/u.test(example) && 'text-3xl text-[#FF2400]')}>
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

      <div className="mt-3 flex flex-wrap gap-2">
        {tongueTwisterSpeeds.map(({ icon: Icon, key, rate }) => (
          <SpeechButton
            key={key}
            text={twister.ru}
            lang="ru-RU"
            rate={rate}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-ground-raised px-3 py-2 text-sm font-black text-ink shadow-sm"
          >
            <Icon aria-hidden="true" strokeWidth={2} className="size-4" />
            {t.speed[key]}
          </SpeechButton>
        ))}
      </div>
      <p className="mt-2 text-xs font-bold text-ink-faint">{t.tongueTwisterHint}</p>

      {twister.breakdown && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {twister.breakdown.map((item) => (
            <div key={item.word} className="rounded-xl bg-ground-raised p-3">
              <p className="font-black text-ink"><RussianText text={item.word} /></p>
              <p className="mt-0.5 text-sm font-bold text-ink-muted">{item.transcription}</p>
              <p className="mt-0.5 text-xs font-black text-signal-ink">{item.sound}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SpeakerLine({ speaker, text }: { speaker: Mascot; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ground-sunken p-3">
      <MascotImage mascot={speaker} className="size-16 shrink-0 sm:size-20" />
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
  return (
    <>
      <p className="mb-3 text-sm leading-relaxed text-ink-muted">{t.intro}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {phrases.map((phrase, index) => (
          <button key={`${phrase.ru}-${index}`} type="button" onClick={() => setOpen(index)} className="flex items-center gap-3 rounded-2xl border border-hairline bg-ground-raised p-3 text-left shadow-sm transition hover:border-signal">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-xl">{phrase.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-black text-ink"><RussianText text={phrase.ru} /></span>
              <span className="mt-0.5 block text-xs font-bold text-signal-ink">{t.open}</span>
            </span>
            {ratings[index] && <Check aria-hidden="true" strokeWidth={3} className="size-4 text-milestone" />}
          </button>
        ))}
      </div>
      {open !== null && <StudyCard phrase={phrases[open]} onClose={() => setOpen(null)} onRate={(rating) => {
        onRate(open, rating)
        const next = phrases.findIndex((_, index) => index !== open && !ratings[index])
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
      <Card className="w-full max-w-md overflow-hidden p-0">
        <div className="relative flex h-36 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#fff,var(--color-signal-soft))]">
          <span className="lesson-scene-icon text-6xl">{phrase.icon}</span>
          <button type="button" onClick={onClose} aria-label={t.close} className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-xl font-black">×</button>
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
          <SpeechButton text={phrase.ru} lang="ru-RU" className="mt-3 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-black text-on-signal">{t.repeat}</SpeechButton>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => { playUiSound('coin'); onRate('known') }} className="rounded-xl bg-signal px-2 py-2 text-xs font-black text-on-signal">{rating.known}</button>
            <button type="button" onClick={() => { playUiSound('wrong'); onRate('unknown') }} className="rounded-xl border border-danger px-2 py-2 text-xs font-black text-danger">{rating.unknown}</button>
            <button type="button" onClick={() => { playUiSound('select'); onRate('repeat') }} className="rounded-xl border border-hairline px-2 py-2 text-xs font-black text-ink">{rating.again}</button>
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
  const [burst, setBurst] = useState<{ id: number; final: boolean } | null>(null)
  const solvedRef = useRef(solvedCount)
  const burstTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (solvedCount > solvedRef.current) {
      const final = total > 0 && solvedCount >= total
      setBurst({ id: Date.now(), final })
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current)
      burstTimerRef.current = window.setTimeout(() => setBurst(null), final ? 4_200 : 2_600)
    }
    solvedRef.current = solvedCount
  }, [solvedCount, total])

  useEffect(() => () => {
    if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current)
  }, [])

  return (
    <>
      {burst && <Celebration key={burst.id} pieces={burst.final ? 150 : 46} balloons={burst.final ? 28 : 0} />}
      {children}
    </>
  )
}

type GenderHouseName = 'Мужской род' | 'Женский род' | 'Средний род'
type WordDrag = { word: string; x: number; y: number }

const genderHouses: Array<{
  name: GenderHouseName
  label: string
  mascot: Mascot
  /** Who lives here — this house's own character answers when a word lands on it. */
  speaker: string
  color: string
  /** The yellow house's accent is too pale to read as text, so text carries its own ink. */
  ink: string
  background: string
}> = [
  { name: 'Мужской род', label: 'Ko‘k uy', mascot: 'penguin', speaker: 'Pingvin', color: '#0000FF', ink: '#0000FF', background: '#e7f0ff' },
  { name: 'Женский род', label: 'Qizil uy', mascot: 'panda', speaker: 'Panda', color: '#FF2400', ink: '#FF2400', background: '#fff0ef' },
  { name: 'Средний род', label: 'Sariq uy', mascot: 'pero', speaker: 'Pat', color: '#d4b500', ink: '#8a6d00', background: '#fff9d8' },
]

type GenderHouse = (typeof genderHouses)[number]

function houseByName(name: string): GenderHouse | undefined {
  return genderHouses.find((house) => house.name === name)
}

/**
 * Feedback in this game is spoken by the house the word was dropped on, not by one fixed
 * character — the penguin owns Мужской, the panda Женский, Pat Средний.
 */
function HouseSpeech({ house, tone, children }: { house: GenderHouse | undefined; tone: 'success' | 'error'; children: ReactNode }) {
  return (
    <p
      role="status"
      className={cx(
        'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black',
        tone === 'success' ? 'bg-milestone-soft text-milestone' : 'bg-danger-soft text-danger',
      )}
    >
      {house && <MascotImage mascot={house.mascot} className="size-8 shrink-0" />}
      <span>{house ? `${house.speaker}: ` : ''}«{children}»</span>
    </p>
  )
}

function GenderHouseGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const t = useT().lesson.game
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<WordDrag | null>(null)
  const [error, setError] = useState<{ word: string; house: string } | null>(null)
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

  function showError(word: string, house: string) {
    setError({ word, house })
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
      onChange({ ...matches, [word]: house })
      celebrate([25, 35, 60], 'coin')
      if (lesson.game.feedback) showSuccess(house)
      return
    }
    showError(word, house)
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
      <Card className="border-signal/40 bg-signal-soft/45 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-signal-ink">{lesson.game.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.game.instruction}</p>
          </div>
          <span className="shrink-0 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-signal-ink">{matchedCount}/{lesson.game.pairs.length}</span>
        </div>
      </Card>

      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black text-ink-muted">
          <span>{t.words}</span>
          <span>{t.swipe}</span>
        </div>
        <div className="-mx-3 overflow-x-auto px-3 pb-2 [scrollbar-width:thin] sm:-mx-4 sm:px-4">
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
            : <><RussianText text={error.word} />{t.wrongHouse}</>}
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
          return (
            <button
              key={house.name}
              type="button"
              data-gender-house={house.name}
              onClick={() => { if (selected) placeWord(selected, house.name) }}
              className={cx('flex min-h-44 flex-col overflow-hidden rounded-2xl border-2 border-dashed p-2 text-left transition sm:min-h-52 sm:p-4', selected && 'ring-2 ring-signal/30', isWrongTarget && 'animate-pulse border-danger')}
              style={{ borderColor: isWrongTarget ? '#dc2626' : house.color, background: house.background }}
              aria-label={`${house.label}: ${house.name}`}
            >
              <MascotImage mascot={house.mascot} className="h-12 w-12 shrink-0 object-contain object-left sm:h-16 sm:w-16" />
              <span className="mt-2 block text-[10px] font-black tracking-[.12em] uppercase sm:text-xs" style={{ color: house.ink }}>{house.label}</span>
              <span className="mt-1 block text-xs font-black leading-tight sm:text-base" style={{ color: house.ink }}><RussianText text={house.name} /></span>
              <span className="mt-2 flex flex-1 flex-wrap content-start gap-1">
                {placed.map((pair) => <span key={pair.left} className="h-fit rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black shadow-sm sm:px-2 sm:py-1 sm:text-xs" style={{ color: house.ink }}><RussianText text={pair.left} /> <Check aria-hidden="true" strokeWidth={3} className="inline size-3" /></span>)}
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

function MatchingGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const t = useT().lesson.game
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState<'correct' | 'incorrect' | null>(null)
  const noteTimerRef = useRef<number | null>(null)
  const shuffledRight = useMemo(() => [...lesson.game.pairs].sort((a, b) => a.right.localeCompare(b.right)), [lesson])
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

  function showNote(kind: 'correct' | 'incorrect') {
    if (!lesson.game.feedback) return
    setNote(kind)
    if (noteTimerRef.current !== null) window.clearTimeout(noteTimerRef.current)
    noteTimerRef.current = window.setTimeout(() => setNote(null), 1_800)
  }

  return (
    <div className="space-y-3">
      <Card className="border-signal/40 bg-signal-soft/45 p-3 sm:p-4">
        <h3 className="font-black text-signal-ink">{lesson.game.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.game.instruction}</p>
      </Card>
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-black text-ink-muted"><span>{t.pairs}</span><span>{matchedCount}/{lesson.game.pairs.length}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid content-start gap-2">
            {lesson.game.pairs.map((pair) => {
              const done = matches[pair.left] === pair.right
              return <button key={pair.left} type="button" disabled={done} onClick={() => setSelected(pair.left)} className={cx('min-h-11 rounded-xl border-2 px-2 py-2 text-sm font-black', done ? 'border-milestone bg-milestone-soft text-milestone' : selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink' : 'border-hairline bg-ground-raised text-ink')}><RussianText text={pair.left} /></button>
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
              return <button key={`${pair.left}→${pair.right}`} type="button" disabled={used} onClick={() => {
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
                  showNote('incorrect')
                }
              }} className={cx('min-h-11 rounded-xl border-2 px-2 py-2 text-sm font-black', used ? 'border-milestone bg-milestone-soft text-milestone' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><RussianText text={pair.right} /></button>
            })}
          </div>
        </div>
      </Card>

      {lesson.game.feedback && solved && (
        <p role="status" className="rounded-xl bg-milestone-soft px-3 py-2 text-center text-sm font-black text-milestone">
          {lesson.game.feedback.allDone}
        </p>
      )}

      {lesson.game.feedback && note && !solved && (
        <p
          role="status"
          className={cx(
            'rounded-xl px-3 py-2 text-center text-sm font-black',
            note === 'correct' ? 'bg-milestone-soft text-milestone' : 'bg-danger-soft text-danger',
          )}
        >
          {note === 'correct' ? lesson.game.feedback.correct : lesson.game.feedback.incorrect}
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
  const score = solved.length * 10 + (solved.length === lesson.game.pairs.length ? 30 : 0)
  const options = useMemo(() => {
    if (!current) return []
    const distractors = lesson.game.pairs
      .filter((pair) => pair.left !== current.left && matches[pair.left] !== pair.right)
      .map((pair) => pair.right)
      .slice(0, 2)
    return [current.right, ...distractors].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [current, lesson.game.pairs, matches])

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
      <Card className="border-signal/40 bg-signal-soft/45 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-black text-signal-ink">{lesson.game.title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.game.instruction}</p></div>
          <span className="shrink-0 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-signal-ink">{score} {t.points}</span>
        </div>
      </Card>

      <Card className="overflow-hidden p-3 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:items-center">
          <div className="relative mx-auto flex aspect-square w-full max-w-56 items-center justify-center rounded-[2rem] bg-[linear-gradient(145deg,#dff3ff,#fff2c9)]">
            <ShoppingBag aria-hidden="true" strokeWidth={1.2} className="size-24 text-signal-ink/80" />
            <span className="absolute right-3 bottom-3 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-ink">{solved.length}/{lesson.game.pairs.length}</span>
          </div>
          <div>
            {current ? <>
              <p className="text-xs font-black tracking-[.12em] text-ink-muted uppercase">{t.missingFromBag}</p>
              <div className="my-3 flex items-center gap-3 rounded-2xl bg-ground-sunken p-3">
                <BagIcon word={current.left} className="size-10 text-signal-ink" />
                <span className="text-xl font-black text-ink"><RussianText text={current.left} /></span>
              </div>
              <div className="grid gap-2">
                {options.map((option) => <button key={option} type="button" onClick={() => choose(option)} className={cx('min-h-12 rounded-xl border-2 px-3 py-2 text-left text-sm font-black transition', wrong === option ? 'animate-pulse border-danger bg-danger-soft text-danger' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><RussianText text={option} /></button>)}
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
  const [selected, setSelected] = useState(lesson.game.pairs[0]?.left ?? '')
  const [draft, setDraft] = useState(matches[selected] ?? '')
  const completed = lesson.game.pairs.filter((pair) => Boolean(matches[pair.left]?.trim())).length

  function selectPicture(place: string) {
    setSelected(place)
    setDraft(matches[place] ?? '')
    playUiSound('select')
  }

  function saveDescription() {
    const description = draft.trim()
    if (!selected || !description) return
    onChange({ ...matches, [selected]: description })
    celebrate([25, 30, 45], completed + 1 === lesson.game.pairs.length ? 'win' : 'coin')
  }

  return (
    <div className="space-y-3">
      <Card className="border-signal/40 bg-signal-soft/45 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-black text-signal-ink">{lesson.game.title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.game.instruction}</p></div>
          <span className="shrink-0 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-signal-ink">{completed}/{lesson.game.pairs.length}</span>
        </div>
      </Card>

      <Card className="p-3 sm:p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {lesson.game.pairs.map((pair) => {
            const done = Boolean(matches[pair.left]?.trim())
            return <button key={pair.left} type="button" onClick={() => selectPicture(pair.left)} className={cx('flex min-h-28 flex-col items-center justify-center rounded-2xl border-2 p-3 transition', done ? 'border-milestone bg-milestone-soft text-milestone' : selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><SceneIcon word={pair.left} className="size-9 text-signal-ink" /><span className="mt-2 text-sm font-black">{pair.left}</span>{done && <Check aria-hidden="true" strokeWidth={3} className="mt-1 size-3.5" />}</button>
          })}
        </div>
      </Card>

      {lesson.game.example && <Card className="border-hairline bg-ground-raised p-4 text-sm leading-relaxed text-ink"><RussianText text={lesson.game.example} /></Card>}

      <Card className="p-3 sm:p-4">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} className="w-full resize-y rounded-2xl border border-hairline bg-ground-raised px-4 py-3 text-sm text-ink outline-none transition focus:border-signal" />
        <Button className="mt-3" disabled={!draft.trim()} onClick={saveDescription}>{t.ready}</Button>
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
  const options = useMemo(() => {
    if (!current) return []
    const distractors = lesson.game.pairs
      .filter((pair) => pair.left !== current.left && matches[pair.left] !== pair.right)
      .map((pair) => pair.right)
      .slice(0, 2)
    return [current.right, ...distractors].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [current, lesson.game.pairs, matches])

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
      <Card className="border-signal/40 bg-signal-soft/45 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-signal-ink">{lesson.game.title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.game.instruction}</p></div><span className="shrink-0 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-signal-ink">{solved.length * 10} ball</span></div>
      </Card>

      <Card className="overflow-hidden p-3 sm:p-5">
        <div className="rounded-2xl bg-[linear-gradient(145deg,#ddf3ff,#e6f7df_55%,#fff0c5)] p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between text-xs font-black text-ink-muted"><span>{t.cityMap}</span><span>{solved.length}/{lesson.game.pairs.length}</span></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {lesson.game.pairs.map((pair) => {
              const done = matches[pair.left] === pair.right
              return <button key={pair.left} type="button" disabled={done} onClick={() => { setSelected(pair.left); setWrong(null); playUiSound('select') }} className={cx('flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 p-2 text-center shadow-sm transition', done ? 'border-milestone bg-milestone-soft text-milestone' : selected === pair.left ? 'border-signal bg-ground-raised text-signal-ink' : 'border-white bg-white/75 text-ink hover:border-signal')}><CityIcon word={pair.left} className="size-8" /><span className="mt-1 text-xs font-black"><RussianText text={pair.left} /></span>{done && <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-black">+10 <Check aria-hidden="true" strokeWidth={3} className="size-3" /></span>}</button>
            })}
          </div>
        </div>
      </Card>

      {current && <Card className="p-3 sm:p-4"><p className="mb-3 text-sm font-black text-ink"><CityIcon word={current.left} className="mr-2 inline size-6" /><RussianText text={current.left} /> {t.pickTrueSentenceSuffix}</p><div className="grid gap-2">{options.map((option) => <button key={option} type="button" onClick={() => choose(option)} className={cx('min-h-12 rounded-xl border-2 px-3 py-2 text-left text-sm font-black transition', wrong === option ? 'animate-pulse border-danger bg-danger-soft text-danger' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><RussianText text={option} /></button>)}</div></Card>}
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
      <Card className="border-signal/40 bg-signal-soft/45 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-black text-signal-ink">{lesson.game.title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.game.instruction}</p></div>
          <span className="shrink-0 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-signal-ink">{solved}/{lesson.game.pairs.length}</span>
        </div>
      </Card>

      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="relative mx-auto aspect-[4/3] max-w-xl overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#fff7dc,#dff3ff)]">
          {lesson.sceneImage
            ? <img src={lesson.sceneImage} alt={t.guestsAndFamily} className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center"><Users aria-hidden="true" strokeWidth={1.2} className="size-20 text-signal-ink/70" /></div>}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2" aria-hidden="true">
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
            <button key={pair.left} type="button" disabled={done} onClick={() => { setSelected(pair.left); setWrong(null); playUiSound('select') }} className={cx('rounded-xl border-2 px-3 py-2.5 text-left text-sm font-black transition', done ? 'border-milestone bg-milestone-soft text-milestone' : selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink' : 'border-hairline bg-ground-raised text-ink')}>
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
              <button key={option} type="button" onClick={() => choosePlural(option)} className={cx('rounded-full border-2 px-3 py-2 text-sm font-black', wrong === option ? 'animate-pulse border-danger bg-danger-soft text-danger' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}>
                <RussianText text={option} />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

const roomSlots = [
  { id: 'picture-wall', label: 'devorda', gridColumn: '1', gridRow: '1' },
  { id: 'tv-wall', label: 'devorda', gridColumn: '2 / span 2', gridRow: '1' },
  { id: 'near-window', label: 'deraza yonida', gridColumn: '4', gridRow: '1' },
  { id: 'corner', label: 'burchakda', gridColumn: '1', gridRow: '2' },
  { id: 'room-centre', label: 'xona o‘rtasida', gridColumn: '2 / span 2', gridRow: '2' },
  { id: 'beside-wall', label: 'devor yonida', gridColumn: '4', gridRow: '2' },
  { id: 'beside-table', label: 'stol yonida', gridColumn: '1', gridRow: '3' },
  { id: 'on-desk', label: 'stol ustida', gridColumn: '2', gridRow: '3' },
  { id: 'computer-desk', label: 'stol ustida', gridColumn: '3', gridRow: '3' },
  { id: 'on-floor', label: 'polda', gridColumn: '4', gridRow: '3' },
] as const

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
      <Card className="border-signal/40 bg-signal-soft/45 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-black text-signal-ink">{lesson.game.title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.game.instruction}</p></div>
          <span className="shrink-0 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-signal-ink">{placed}/{lesson.game.pairs.length}</span>
        </div>
      </Card>

      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black text-ink-muted"><span>{t.objects}</span><span>{t.swipe}</span></div>
        <div className="-mx-3 overflow-x-auto px-3 pb-2 [scrollbar-width:thin] sm:-mx-4 sm:px-4">
          <div className="flex w-max min-w-full gap-2">
            {remaining.length > 0 ? remaining.map((pair) => (
              <button key={pair.left} type="button" onClick={() => { setSelected(pair.left); setWrongSlot(null); playUiSound('select') }} className={cx('shrink-0 rounded-xl border-2 px-3 py-2.5 text-sm font-black transition', selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink' : 'border-hairline bg-ground-raised text-ink')}>
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
  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className="relative mx-auto aspect-[4/3] max-w-2xl overflow-hidden rounded-2xl border border-signal/25 bg-[linear-gradient(to_bottom,#dff3ff_0_63%,#d8bd98_63%_100%)] p-2 sm:p-4">
        <div className="absolute top-2 right-3 h-16 w-20 rounded-lg border-4 border-white bg-[#bfe6ff] shadow-inner sm:h-24 sm:w-32"><span className="absolute inset-x-0 top-1/2 border-t-2 border-white" /><span className="absolute inset-y-0 left-1/2 border-l-2 border-white" /></div>
        <div className="relative z-10 grid h-full grid-cols-4 grid-rows-3 gap-1.5 sm:gap-3">
          {roomSlots.map((slot) => {
            const word = Object.entries(matches).find(([, value]) => value === slot.id)?.[0]
            return (
              <button key={slot.id} type="button" disabled={!onSlot} onClick={() => onSlot?.(slot.id)} style={{ gridColumn: slot.gridColumn, gridRow: slot.gridRow }} className={cx('flex min-h-0 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white/72 p-1 text-center shadow-sm transition sm:p-2', selected && 'hover:border-signal hover:bg-white', wrongSlot === slot.id ? 'animate-pulse border-danger bg-danger-soft' : word ? 'border-milestone bg-milestone-soft/90' : 'border-white/90')}>
                <RoomCellIcon word={word} slot={slot.id} className="size-5 sm:size-6" />
                <span className={cx('mt-0.5 text-[9px] font-black leading-tight sm:text-xs', word ? 'text-milestone' : 'text-ink-muted')}>{word ? <RussianText text={word} /> : slot.label}</span>
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
  const solved = Object.keys(matches).length

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
      <Card className="border-signal/40 bg-signal-soft/45 p-3 sm:p-4">
        <h3 className="font-black text-signal-ink">{lesson.game.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.game.instruction}</p>
      </Card>
      <Card className="overflow-hidden p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-black text-ink-muted"><span>{t.familyPhoto}</span><span>{solved}/{clues.length}</span></div>
        <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-2xl bg-signal-soft">
          <img src={lesson.sceneImage} alt={t.familyPhotoAlt} className="h-full w-full object-cover" />
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-5" aria-hidden="true">
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
                  onChange={(event) => setAnswers((current) => ({ ...current, [answer]: event.target.value }))}
                  onKeyDown={(event) => { if (event.key === 'Enter') check(answer) }}
                  placeholder={'_ '.repeat(answer.length).trim()}
                  className="min-w-0 flex-1 rounded-xl border border-hairline bg-ground px-3 py-2 text-sm font-black text-ink outline-none focus:border-signal disabled:text-milestone"
                />
                <button type="button" disabled={done} onClick={() => check(answer)} className="rounded-xl bg-signal px-3 text-sm font-black text-on-signal disabled:bg-milestone">{done
                ? <Check aria-hidden="true" strokeWidth={3} className="size-4" />
                : <ArrowRight aria-hidden="true" strokeWidth={2.4} className="size-4" />}</button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function MissionModes({ lesson, missionId, dialoguePractised, aiChatStarted, onDialoguePractised, onAiChatStarted }: {
  lesson: LessonData
  missionId?: string
  dialoguePractised: boolean
  aiChatStarted: boolean
  onDialoguePractised: () => void
  onAiChatStarted: () => void
}) {
  const t = useT().lesson.missions
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

  const [questionIndex, setQuestionIndex] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [listening, setListening] = useState(false)
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
    if (!missionId) throw new Error('Missiya topilmadi.')
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
        throw new Error('Bu brauzer ovoz yozishni qo‘llamaydi.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      // Keep the permission request inside the learner's tap; Android may reject it after a network await.
      const attempt = await requireAttempt()
      const mimeType = preferredRecordingMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      setFeedback('')

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
        setFeedback('Ovoz yozishda xatolik yuz berdi. Mikrofon ruxsatini tekshirib, yana bosing.')
      }
      recorder.start()
      setListening(true)
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setListening(false)
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      setFeedback(denied
        ? 'Mikrofonga ruxsat berilmagan. Brauzer sozlamasidan mikrofonni yoqing va qayta bosing.'
        : error instanceof RequestError ? error.message : error instanceof Error ? error.message : 'Mikrofonni ishga tushirib bo‘lmadi.')
    }
  }

  async function submitRecording(audio: Blob, mimeType: string, attempt: StartAttemptResponse, onDone?: () => void) {
    if (audio.size === 0) {
      setFeedback('Ovoz yozilmadi. Mikrofonni yana bosib, gapirib bo‘lgach to‘xtating.')
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
        result.transcript ? `Siz aytdingiz: ${result.transcript}` : '',
        result.feedback.strengthNote,
        result.feedback.headlineCorrection,
        result.feedback.pronunciationNote,
      ].filter(Boolean).join('. ')
      setFeedback(message)
      const spokenFeedback = [result.feedback.strengthNote, result.feedback.headlineCorrection, result.feedback.pronunciationNote].filter(Boolean).join('. ')
      await speak(spokenFeedback, 'uz-UZ')
      onDone?.()
    } catch (error) {
      setFeedback(error instanceof RequestError ? error.message : 'Ovozni tekshirib bo‘lmadi. Internetni tekshirib, yana urinib ko‘ring.')
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
          <p className="mb-3 text-sm leading-relaxed text-ink-muted">
            {t.intro}
          </p>
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
          <MicButton listening={listening} processing={processing} onClick={() => void toggleRecording()} />
          <p className="mt-2 text-center text-xs font-black text-ink-faint">{Math.min(revealed, lesson.dialogue.length)} / {lesson.dialogue.length}</p>
          <div className="mt-3">
            {dialogueDone
              ? <Button size="lg" block onClick={startAiChat}>{t.goToAi}</Button>
              : <Button size="lg" block variant="secondary" onClick={revealNext}>{t.nextLine}</Button>}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-xs font-black tracking-[.14em] text-signal-ink uppercase">{questionIndex + 1} / {lesson.questions.length}</p>
          <SpeechButton text={lesson.questions[questionIndex].question} lang="ru-RU" autoPlayToken={`${mode}-${questionIndex}`} className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-signal-soft p-5 text-xl font-black text-ink"><RussianText text={lesson.questions[questionIndex].question} /></SpeechButton>
          <MicButton listening={listening} processing={processing} onClick={() => void toggleRecording(() => setTimeout(() => setQuestionIndex((current) => Math.min(current + 1, lesson.questions.length - 1)), 900))} />
          <button type="button" onClick={() => setMode('dialogue')} className="mt-3 text-sm font-black text-ink-muted underline">{t.backToDialogue}</button>
        </div>
      )}
      {feedback && <p role="status" className="mt-3 rounded-xl bg-milestone-soft p-3 text-sm text-milestone"><RussianText text={feedback} /></p>}
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

function MicButton({ listening, processing, onClick }: { listening: boolean; processing: boolean; onClick: () => void }) {
  const t = useT().lesson.missions
  return <button type="button" onClick={onClick} disabled={processing} className={cx('mx-auto mt-4 flex size-16 items-center justify-center rounded-full text-2xl text-white shadow-lg disabled:opacity-60', listening ? 'animate-pulse bg-danger' : 'bg-signal')} aria-label={listening ? t.stopRecording : t.mic}>{processing ? <span className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" /> : listening
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
      <Card className="flex items-center gap-4 p-4 sm:p-5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-signal-soft"><Layers aria-hidden="true" strokeWidth={1.6} className="size-8 text-signal-ink" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black tracking-[.12em] text-signal-ink uppercase">{fill(t.cards, { count: words.length })}</p>
          <h3 className="mt-1 text-xl font-black text-ink">{t.deckTitle}</h3>
          <p className="mt-1 text-sm font-bold text-ink-muted">
            {reviewed === 0
              ? `Kamida ${target} ta kartani ko‘ring`
              : `Ko‘rildi: ${Math.min(reviewed, words.length)} / ${words.length}${reviewed >= target ? ' ✓' : ` (kamida ${target})`}`}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>{reviewed > 0 && !finishedDeck ? t.resume : t.open}</Button>
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
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const [index, setIndex] = useState(startIndex)
  const [flipped, setFlipped] = useState(false)
  const word = words[index]
  function rate(sound: UiSound) {
    playUiSound(sound)
    // Rating a card banks it, so closing early keeps everything seen up to this point.
    onReviewed(index + 1)
    if (index === words.length - 1) { onClose(); return }
    setIndex((current) => current + 1)
    setFlipped(false)
  }
  return createPortal(
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[90] overflow-y-auto bg-ground p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto flex min-h-full max-w-lg flex-col">
        <div className="flex items-center justify-between py-2 text-sm font-black text-ink-muted"><span>{index + 1} / {words.length}</span><button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full border border-hairline text-xl text-ink">×</button></div>
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
                <><h2 className="text-3xl font-black text-ink"><RussianText text={word.ru} /></h2><p className="mt-4 rounded-xl bg-ground-sunken p-3 leading-relaxed text-ink"><RussianText text={word.example} /></p><SpeechButton text={word.ru} lang="ru-RU" stopPropagation className="mt-4 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-black text-on-signal">{t.listenAndRepeat}</SpeechButton></>
              ) : (
                <><h2 className="text-3xl font-black text-ink">{word.uz}</h2><p className="mt-4 rounded-xl bg-ground-sunken p-3 leading-relaxed text-ink"><RussianText text={word.example} /></p><span className="mt-4 block text-sm font-bold text-ink-muted">{t.tapForFront}</span></>
              )}
            </div>
          </div>
        </div>
        {flipped && <div className="grid grid-cols-3 gap-2 py-3"><button type="button" onClick={() => rate('coin')} className="rounded-xl bg-signal py-3 text-xs font-black text-white">выучил</button><button type="button" onClick={() => rate('wrong')} className="rounded-xl border border-danger py-3 text-xs font-black text-danger">не знаю</button><button type="button" onClick={() => rate('select')} className="rounded-xl border border-hairline py-3 text-xs font-black text-ink">повторю</button></div>}
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
  const segments = splitBlankSegments(lesson.exercise.starter)
  const hasBlanks = segments.length > 1
  const fullText = fillTemplate(segments, answer)

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
        <SpeechButton text={fullText} lang="ru-RU" className="mt-3 inline-flex items-center gap-2 rounded-full bg-signal-soft px-4 py-2 text-sm font-black text-signal-ink">
          {t.listenToText}
        </SpeechButton>
      )}

      {lesson.exercise.example && (
        <div className="mt-4 rounded-xl border border-hairline bg-ground-sunken p-3">
          <p className="text-xs font-black tracking-[.12em] text-ink-muted uppercase">{t.sample}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink"><RussianText text={lesson.exercise.example} /></p>
        </div>
      )}
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
        lastSynced.current = text
        onChange(text)
      }}
      onKeyDown={(event) => {
        // A blank holds one short answer, not a paragraph — swallow the newline Enter would add.
        if (event.key === 'Enter') event.preventDefault()
      }}
      lang="ru"
      className="mx-0.5 break-words border-b-2 border-ink-faint bg-ground-sunken px-1 font-black text-ink outline-none empty:px-4 focus:border-signal focus:bg-signal-soft"
    />
  )
}

function NeighborScene() {
  const t = useT().lesson.missions
  return (
    <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#dff1ff_0_62%,#d7c4a7_62%)]">
      <div className="absolute top-5 left-1/2 h-24 w-28 -translate-x-1/2 rounded-t-full border-[10px] border-[#a66b43] bg-[#fff4d7] sm:h-36 sm:w-40" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-5 sm:gap-10">
        <MascotImage mascot="penguin" className="h-32 w-28 sm:h-48 sm:w-40" />
        <MascotImage mascot="panda" className="h-28 w-28 sm:h-44 sm:w-40" />
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-signal-ink">{t.twoNeighbours}</span>
    </div>
  )
}

function CompleteSection({ lesson }: { lesson: LessonData }) {
  const t = useT().lesson.complete
  useEffect(() => { celebrate([45, 45, 80], 'win') }, [])
  return (
    <Card className="relative overflow-hidden border-milestone bg-milestone-soft/35 p-5 text-center sm:p-8">
      <Celebration pieces={180} balloons={34} />
      <MascotImage mascot="penguin" className="mx-auto h-28 w-28 object-contain" />
      <span className="mt-2 inline-flex rounded-full bg-milestone-soft px-3 py-1.5 text-sm font-black text-milestone">{fill(t.badge, { day: lesson.day })}</span>
      <h3 className="mt-3 text-3xl font-black text-ink">{t.title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{lesson.completionMessage ?? t.body}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
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
      {lesson.reflection && <ReflectionQuestions reflection={lesson.reflection} />}
      {lesson.completionAction && <a href={lesson.completionAction.href} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-signal px-5 py-2.5 text-sm font-black text-on-signal shadow-sm">{lesson.completionAction.label} <ArrowUpRight aria-hidden="true" strokeWidth={2.4} className="inline size-4" /></a>}
    </Card>
  )
}

function ReflectionQuestions({ reflection }: { reflection: NonNullable<LessonData['reflection']> }) {
  const [picked, setPicked] = useState<Record<number, number>>({})
  return (
    <div className="mt-5 space-y-3 text-left">
      {reflection.questions.map((item, questionIndex) => (
        <div key={item.question} className="rounded-2xl bg-ground-raised p-3 sm:p-4">
          <p className="text-sm font-black text-ink">{item.question}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.options.map((option, optionIndex) => (
              <button
                key={option}
                type="button"
                onClick={() => { setPicked((current) => ({ ...current, [questionIndex]: optionIndex })); playUiSound('select') }}
                className={cx(
                  'rounded-full border-2 px-3 py-1.5 text-xs font-black transition',
                  picked[questionIndex] === optionIndex ? 'border-signal bg-signal-soft text-signal-ink' : 'border-hairline bg-ground text-ink-muted hover:border-signal',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
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

function SpeechButton({ text, lang, children, className, stopPropagation = false, autoPlayToken, rate }: {
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
    if (autoPlayToken) void start()
    // A token is emitted only when a new AI prompt becomes active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayToken])

  return (
    <button type="button" onClick={toggle} className={cx('inline-flex items-center justify-center gap-2', className)} aria-label={status === 'playing' ? t.pause : t.play}>
      {status === 'loading' ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : status === 'playing' ? <PauseGlyph /> : <PlayGlyph />}
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
      await new Promise<void>((resolve) => speakWithBrowser(combined, 'uz-UZ', resolve))
    } finally {
      if (playingRef.current) setStatus('idle')
      playingRef.current = false
    }
  }

  function toggle() {
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
      vocabularyReviewed: typeof parsed.vocabularyReviewed === 'number' && parsed.vocabularyReviewed > 0
        ? parsed.vocabularyReviewed
        : 0,
    }
  } catch { return emptyState }
}

const celebrationColors = ['#5b9bf5', '#ff2400', '#f4c84d', '#44944a', '#ed3cca']
/**
 * Defaults are the small burst a correct answer earns. The end-of-lesson card asks for more —
 * finishing a whole day should not look the same as getting one quiz right.
 */
function Celebration({ pieces = 52, balloons = 12 }: { pieces?: number; balloons?: number }) {
  return createPortal(<span className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">{Array.from({ length: pieces }, (_, index) => {
    const style = { '--fall-x': `${3 + ((index * 37) % 94)}vw`, '--fall-drift': `${(index % 2 ? -1 : 1) * (16 + (index % 5) * 8)}px`, '--fall-rotate': `${360 + index * 29}deg`, '--fall-delay': `${(index % 12) * 45}ms`, '--fall-duration': `${1900 + (index % 7) * 130}ms`, '--fall-color': celebrationColors[index % celebrationColors.length] } as CSSProperties
    return <span key={index} className={cx('answer-celebration__piece', index % 3 === 0 ? 'answer-celebration__ball' : 'answer-celebration__ribbon')} style={style} />
  })}{Array.from({ length: balloons }, (_, index) => <span key={`balloon-${index}`} className="answer-celebration__balloon" style={{ '--balloon-x': `${5 + ((index * 41) % 90)}vw`, '--balloon-delay': `${index * 90}ms`, '--fall-color': celebrationColors[index % celebrationColors.length] } as CSSProperties} />)}</span>, document.body)
}

function celebrate(pattern: number | number[] = 35, sound: UiSound = 'correct') {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(pattern)
  playUiSound(sound)
}
