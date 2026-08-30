import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Card, PauseGlyph, PlayGlyph, ProgressBar } from '../components/ui'
import { RussianText } from '../components/RussianText'
import { readAudioPreferences } from '../lib/audio-preferences'
import { useAuth } from '../lib/auth-context'
import { cx } from '../lib/cx'
import { foundationLessons, type LessonData, type Mascot, type Phrase, type Quiz, type Vocab } from '../lib/foundation-lessons'
import { mascotAlt, mascotImage } from '../lib/mascot-images'
import { foundationLessonStorageKey } from '../lib/demo-lesson-one'
import { syncLessonOneCompletion } from '../lib/lesson-one-sync'
import { api, RequestError } from '../lib/api'
import { pausePromptAudio, playPromptAudio, resumePromptAudio } from '../lib/liveVoice'
import { playUiSound, type UiSound } from '../lib/ui-sounds'
import type { StartAttemptResponse, VoiceNoteTurnFeedback } from '../lib/types'

const sections = [
  { id: 'tests', title: 'Yengil test' },
  { id: 'phonetics', title: 'Fonetik qoida' },
  { id: 'grammar', title: 'Grammatik qoida' },
  { id: 'phrases', title: 'Kun frazalari' },
  { id: 'game', title: 'Kreativ o‘yin' },
  { id: 'missions', title: 'Dialog va AI savollari' },
  { id: 'vocabulary', title: 'Словарь' },
  { id: 'picture', title: 'Rasmli mashq' },
  { id: 'complete', title: 'Dars yakuni' },
] as const

type SectionId = (typeof sections)[number]['id']
type StoredState = {
  sectionIndex: number
  completed: SectionId[]
  answers: Array<number | null>
  phraseRatings: Record<number, Rating>
  gameMatches: Record<string, string>
}
type Rating = 'known' | 'unknown' | 'repeat'

const emptyState: StoredState = {
  sectionIndex: 0,
  completed: [],
  answers: [null, null],
  phraseRatings: {},
  gameMatches: {},
}

export function FoundationLesson() {
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
  const canContinue = active.id !== 'phrases' || !lesson || Object.keys(state.phraseRatings).length >= lesson.phrases.length

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
    <div className="foundation-lesson mx-auto max-w-4xl space-y-4 pb-5 sm:space-y-6">
      <LessonHero lesson={lesson} progress={progress} compact={state.sectionIndex > 0} />

      <section aria-labelledby={`section-${active.id}`}>
        <div className="mb-3 flex items-baseline gap-2 sm:mb-4">
          <span className="text-sm font-black text-signal-ink">{state.sectionIndex + 1}</span>
          <h2 id={`section-${active.id}`} className="text-xl font-black tracking-tight text-ink sm:text-3xl">
            {active.id === 'grammar' && day === 1 ? 'Rodlar haqida ertak' : active.id === 'missions' ? 'Dialog' : active.title}
          </h2>
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
          lesson.game.kind === 'picture-description'
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
              }} />
        )}
        {active.id === 'missions' && <MissionModes lesson={lesson} missionId={missionId} />}
        {active.id === 'vocabulary' && <VocabularySection words={lesson.vocabulary} />}
        {active.id === 'picture' && <ExerciseSection lesson={lesson} />}
        {active.id === 'complete' && <CompleteSection lesson={lesson} />}
      </section>

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        {state.sectionIndex > 0 && <Button variant="ghost" onClick={goBack}>← Orqaga</Button>}
        <Button className="ml-auto" disabled={!canContinue} onClick={() => void finishCurrent()}>
          {active.id === 'complete' ? 'Darsni yakunlash' : 'Davom etish →'}
        </Button>
      </div>
    </div>
  )
}

function LessonHero({ lesson, progress, compact }: { lesson: LessonData; progress: number; compact: boolean }) {
  return (
    <Card className={cx('lesson-hero p-4 sm:p-6', compact && 'py-3 sm:py-4')}>
      {!compact && <>
        <p className="text-xs font-black tracking-[.16em] text-signal-ink uppercase">{lesson.day}-dars · A1</p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-ink sm:text-4xl"><RussianText text={lesson.titleRu} /></h1>
        <p className="mt-1 text-sm text-ink-muted sm:text-base">{lesson.titleUz}</p>
      </>}
      <div className={cx('flex items-center justify-between gap-3 text-xs font-bold sm:text-sm', !compact && 'mt-4')}>
        <span className="text-ink">Dars progressi</span>
        <span className="text-ink-faint">{progress} / {sections.length} bo‘lim</span>
      </div>
      <div className="mt-2"><ProgressBar value={progress} max={sections.length} label="Dars progressi" /></div>
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
          <p>{correct ? quiz.feedback : 'Yana urinib ko‘ring.'}</p>
        </div>
      )}
    </Card>
  )
}

function RuleSection({ rule, genderStory = false }: { rule: LessonData['phonetics']; genderStory?: boolean }) {
  const bodyForSpeech = rule.body.map((paragraph) => typeof paragraph === 'string' ? paragraph : `${speakerNames[paragraph.speaker]}: ${paragraph.text}`).join(' ')
  const hasSpeakerLines = rule.body.some((paragraph) => typeof paragraph !== 'string')
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-5">
        {!hasSpeakerLines && <MascotImage mascot={rule.mascot} className="size-16 shrink-0 sm:size-24" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black leading-tight text-ink sm:text-2xl"><RussianText text={rule.title} /></h3>
          <p className="mt-2 font-semibold leading-relaxed text-ink-muted"><RussianText text={rule.lead} /></p>
          <SpeechButton text={`${rule.title}. ${rule.lead} ${bodyForSpeech}`} lang="uz-UZ" className="mt-3 inline-flex items-center gap-2 rounded-full bg-signal-soft px-3 py-2 text-sm font-black text-signal-ink">Qoidani tinglash</SpeechButton>
        </div>
      </div>
      {genderStory && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([
            ['penguin', 'Pingvin qirolligi', 'Мужской род', 'Синий', '#0000FF'],
            ['panda', 'Panda qirolligi', 'Женский род', 'Красный', '#FF2400'],
            ['pero', 'Pat qirolligi', 'Средний род', 'Жёлтый', '#FFFF00'],
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
          : <SpeakerLine key={index} speaker={paragraph.speaker} text={paragraph.text} />)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {rule.examples.map((example) => (
          <SpeechButton key={example} text={example} lang="ru-RU" className={cx('rounded-full border border-hairline bg-ground-raised px-3 py-2 font-black text-ink shadow-sm', /^[АОУ]$/u.test(example) && 'text-3xl text-[#FF2400]')}>
            <RussianText text={example} />
          </SpeechButton>
        ))}
      </div>
      {rule.tongueTwister && <TongueTwister twister={rule.tongueTwister} />}
    </Card>
  )
}

const tongueTwisterSpeeds = [
  { label: '🐢 Sekin', rate: 0.7 },
  { label: '▶️ Oddiy', rate: 1 },
  { label: '⚡ Tez', rate: 1.35 },
] as const

function TongueTwister({ twister }: { twister: NonNullable<LessonData['phonetics']['tongueTwister']> }) {
  return (
    <div className="mt-4 rounded-2xl border border-caution bg-caution-soft/40 p-4">
      <p className="text-xs font-black tracking-[.12em] text-caution uppercase">Скороговорка · tez aytish mashqi</p>
      <p className="mt-2 text-xl font-black text-ink sm:text-2xl"><RussianText text={twister.ru} /></p>
      <p className="mt-1 text-sm font-semibold text-ink-muted">{twister.uz}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {tongueTwisterSpeeds.map((speed) => (
          <SpeechButton
            key={speed.label}
            text={twister.ru}
            lang="ru-RU"
            rate={speed.rate}
            className="rounded-full border border-hairline bg-ground-raised px-3 py-2 text-sm font-black text-ink shadow-sm"
          >
            {speed.label}
          </SpeechButton>
        ))}
      </div>
      <p className="mt-2 text-xs font-bold text-ink-faint">Avval sekin, keyin oddiy tezlikda, so‘ng tez ayting.</p>

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

const speakerNames: Record<Mascot, string> = { penguin: 'Пингвин', panda: 'Панда', pero: 'Перо' }

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

function PhrasesSection({ phrases, ratings, onRate }: { phrases: Phrase[]; ratings: Record<number, Rating>; onRate: (index: number, rating: Rating) => void }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <p className="mb-3 text-sm leading-relaxed text-ink-muted">Iborani tanlang. U karta shaklida ochiladi: vaziyat, talaffuz, namuna gap va eslab qolish holati bir joyda.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {phrases.map((phrase, index) => (
          <button key={`${phrase.ru}-${index}`} type="button" onClick={() => setOpen(index)} className="flex items-center gap-3 rounded-2xl border border-hairline bg-ground-raised p-3 text-left shadow-sm transition hover:border-signal">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-xl">{phrase.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-black text-ink"><RussianText text={phrase.ru} /></span>
              <span className="mt-0.5 block text-xs font-bold text-signal-ink">Kartani oching</span>
            </span>
            {ratings[index] && <span className="text-sm text-milestone">✓</span>}
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
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/45 p-3" role="dialog" aria-modal="true">
      <Card className="w-full max-w-md overflow-hidden p-0">
        <div className="relative flex h-36 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#fff,var(--color-signal-soft))]">
          <span className="lesson-scene-icon text-6xl">{phrase.icon}</span>
          <button type="button" onClick={onClose} aria-label="Yopish" className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-xl font-black">×</button>
        </div>
        <div className="p-5">
          <h3 className="text-2xl font-black text-ink"><RussianText text={phrase.ru} /></h3>
          {phrase.pronunciation && <p className="mt-1 text-sm font-semibold text-ink-muted"><RussianText text={phrase.pronunciation} /></p>}
          <p className="mt-3 rounded-xl bg-ground-sunken p-3 text-sm leading-relaxed text-ink"><RussianText text={phrase.example} /></p>
          <SpeechButton text={phrase.ru} lang="ru-RU" className="mt-3 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-black text-on-signal">Tinglang va takrorlang!</SpeechButton>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => { playUiSound('coin'); onRate('known') }} className="rounded-xl bg-signal px-2 py-2 text-xs font-black text-on-signal">выучил</button>
            <button type="button" onClick={() => { playUiSound('wrong'); onRate('unknown') }} className="rounded-xl border border-danger px-2 py-2 text-xs font-black text-danger">не знаю</button>
            <button type="button" onClick={() => { playUiSound('select'); onRate('repeat') }} className="rounded-xl border border-hairline px-2 py-2 text-xs font-black text-ink">повторю</button>
          </div>
        </div>
      </Card>
    </div>, document.body,
  )
}

type GenderHouseName = 'Мужской род' | 'Женский род' | 'Средний род'
type WordDrag = { word: string; x: number; y: number }

const genderHouses: Array<{
  name: GenderHouseName
  label: string
  mascot: Mascot
  color: string
  background: string
}> = [
  { name: 'Мужской род', label: 'Ko‘k uy', mascot: 'penguin', color: '#0000FF', background: '#e7f0ff' },
  { name: 'Женский род', label: 'Qizil uy', mascot: 'panda', color: '#FF2400', background: '#fff0ef' },
  { name: 'Средний род', label: 'Sariq uy', mascot: 'pero', color: '#d4b500', background: '#fff9d8' },
]

function GenderHouseGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<WordDrag | null>(null)
  const [error, setError] = useState<{ word: string; house: string } | null>(null)
  const [success, setSuccess] = useState(false)
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

  function showSuccess() {
    setSuccess(true)
    if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current)
    successTimerRef.current = window.setTimeout(() => setSuccess(false), 1_800)
  }

  function placeWord(word: string, house: string | undefined) {
    setSelected(null)
    if (!house) return
    const expected = lesson.game.pairs.find((pair) => pair.left === word)?.right
    if (expected === house) {
      setError(null)
      onChange({ ...matches, [word]: house })
      celebrate([25, 35, 60], 'coin')
      if (lesson.game.feedback) showSuccess()
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
          <span>So‘zlar</span>
          <span>Yon tomonga suring →</span>
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
                  <span className="sr-only">{pair.left} so‘zini tinglash</span>
                </SpeechButton>
              </div>
            )) : <p className="w-full py-2 text-center text-sm font-black text-milestone">Barcha so‘zlar joylashtirildi! ✓</p>}
          </div>
        </div>
      </Card>

      {remaining.length === 0 && lesson.game.feedback && (
        <p role="status" className="rounded-xl bg-milestone-soft px-3 py-2 text-center text-sm font-black text-milestone">
          {lesson.game.feedback.allDone}
        </p>
      )}

      {error && (
        <p role="status" className="rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-black text-danger">
          {lesson.game.feedback
            ? lesson.game.feedback.incorrect
            : <><RussianText text={error.word} /> — bu uyga mos emas, yana urinib ko‘ring</>}
        </p>
      )}

      {success && lesson.game.feedback && (
        <p role="status" className="rounded-xl bg-milestone-soft px-3 py-2 text-center text-sm font-black text-milestone">
          {lesson.game.feedback.correct}
        </p>
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
              className={cx('min-h-44 rounded-2xl border-2 border-dashed p-2 text-left transition sm:min-h-52 sm:p-4', selected && 'ring-2 ring-signal/30', isWrongTarget && 'animate-pulse border-danger')}
              style={{ borderColor: isWrongTarget ? '#dc2626' : house.color, background: house.background }}
              aria-label={`${house.label}: ${house.name}`}
            >
              <MascotImage mascot={house.mascot} className="h-12 w-12 object-contain object-left sm:h-16 sm:w-16" />
              <span className="mt-2 block text-[10px] font-black tracking-[.12em] uppercase sm:text-xs" style={{ color: house.color }}>{house.label}</span>
              <span className="mt-1 block text-xs font-black leading-tight sm:text-base" style={{ color: house.color }}><RussianText text={house.name} /></span>
              <span className="mt-3 flex flex-wrap gap-1">
                {placed.map((pair) => <span key={pair.left} className="rounded-full bg-white px-2 py-1 text-[11px] font-black shadow-sm sm:text-xs" style={{ color: house.color }}><RussianText text={pair.left} /> ✓</span>)}
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
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState<'correct' | 'incorrect' | null>(null)
  const noteTimerRef = useRef<number | null>(null)
  const shuffledRight = useMemo(() => [...lesson.game.pairs].sort((a, b) => a.right.localeCompare(b.right)), [lesson])
  const matchedCount = Object.keys(matches).length
  const solved = matchedCount === lesson.game.pairs.length

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
        <div className="mb-3 flex items-center justify-between text-xs font-black text-ink-muted"><span>Juftlar</span><span>{matchedCount}/{lesson.game.pairs.length}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid content-start gap-2">
            {lesson.game.pairs.map((pair) => {
              const done = matches[pair.left] === pair.right
              return <button key={pair.left} type="button" disabled={done} onClick={() => setSelected(pair.left)} className={cx('min-h-11 rounded-xl border-2 px-2 py-2 text-sm font-black', done ? 'border-milestone bg-milestone-soft text-milestone' : selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink' : 'border-hairline bg-ground-raised text-ink')}><RussianText text={pair.left} /></button>
            })}
          </div>
          <div className="grid content-start gap-2">
            {shuffledRight.map((pair) => {
              const used = Object.values(matches).includes(pair.right)
              return <button key={pair.right} type="button" disabled={used} onClick={() => {
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

const bagItemIcons: Record<string, string> = {
  ключи: '🔑', телефон: '📱', зарядник: '🔌', кошелёк: '👛',
  деньги: '💵', зонт: '☂️', очки: '👓', наушники: '🎧',
}

function MissingBagGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
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
          <span className="shrink-0 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-signal-ink">{score} ball</span>
        </div>
      </Card>

      <Card className="overflow-hidden p-3 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:items-center">
          <div className="relative mx-auto flex aspect-square w-full max-w-56 items-center justify-center rounded-[2rem] bg-[linear-gradient(145deg,#dff3ff,#fff2c9)]">
            <span className="text-8xl" aria-hidden="true">👜</span>
            <span className="absolute right-3 bottom-3 rounded-full bg-ground-raised px-2.5 py-1 text-xs font-black text-ink">{solved.length}/{lesson.game.pairs.length}</span>
          </div>
          <div>
            {current ? <>
              <p className="text-xs font-black tracking-[.12em] text-ink-muted uppercase">Sumkada nima yo‘q?</p>
              <div className="my-3 flex items-center gap-3 rounded-2xl bg-ground-sunken p-3">
                <span className="text-4xl">{bagItemIcons[current.left] ?? '🎒'}</span>
                <span className="text-xl font-black text-ink"><RussianText text={current.left} /></span>
              </div>
              <div className="grid gap-2">
                {options.map((option) => <button key={option} type="button" onClick={() => choose(option)} className={cx('min-h-12 rounded-xl border-2 px-3 py-2 text-left text-sm font-black transition', wrong === option ? 'animate-pulse border-danger bg-danger-soft text-danger' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><RussianText text={option} /></button>)}
              </div>
            </> : <div className="rounded-2xl bg-milestone-soft p-5 text-center"><span className="text-5xl">🏃‍♂️</span><h4 className="mt-2 text-xl font-black text-milestone">Sumka tayyor!</h4><p className="mt-1 text-sm text-ink-muted">Ishga o‘z vaqtida yetib keldingiz. +30 bonus ball!</p></div>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {solved.map((pair) => <span key={pair.left} className="rounded-full bg-milestone-soft px-2.5 py-1 text-xs font-black text-milestone">{bagItemIcons[pair.left]} <RussianText text={pair.left} /> ✓</span>)}
        </div>
      </Card>
    </div>
  )
}

const pictureDescriptionIcons: Record<string, string> = {
  shahar: '🏙️', "bog'": '🌿', uy: '🏠', "ko'cha": '🛣️', "do'kon": '🏬', park: '🌳',
}

function PictureDescriptionGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
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
            return <button key={pair.left} type="button" onClick={() => selectPicture(pair.left)} className={cx('flex min-h-28 flex-col items-center justify-center rounded-2xl border-2 p-3 transition', done ? 'border-milestone bg-milestone-soft text-milestone' : selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><span className="text-4xl">{pictureDescriptionIcons[pair.left] ?? '🖼️'}</span><span className="mt-2 text-sm font-black">{pair.left}</span>{done && <span className="mt-1 text-xs font-black">✓</span>}</button>
          })}
        </div>
      </Card>

      {lesson.game.example && <Card className="border-hairline bg-ground-raised p-4 text-sm leading-relaxed text-ink"><RussianText text={lesson.game.example} /></Card>}

      <Card className="p-3 sm:p-4">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} className="w-full resize-y rounded-2xl border border-hairline bg-ground-raised px-4 py-3 text-sm text-ink outline-none transition focus:border-signal" />
        <Button className="mt-3" disabled={!draft.trim()} onClick={saveDescription}>Tayyor</Button>
      </Card>
    </div>
  )
}

const cityPlaceIcons: Record<string, string> = {
  парк: '🌳', музей: '🏛️', кафе: '☕', улица: '🛣️', мост: '🌉',
  фонтан: '⛲', магазин: '🏬', школа: '🏫', вокзал: '🚉', театр: '🎭',
}

function CityMapGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
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
          <div className="mb-3 flex items-center justify-between text-xs font-black text-ink-muted"><span>Shahar xaritasi</span><span>{solved.length}/{lesson.game.pairs.length}</span></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {lesson.game.pairs.map((pair) => {
              const done = matches[pair.left] === pair.right
              return <button key={pair.left} type="button" disabled={done} onClick={() => { setSelected(pair.left); setWrong(null); playUiSound('select') }} className={cx('flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 p-2 text-center shadow-sm transition', done ? 'border-milestone bg-milestone-soft text-milestone' : selected === pair.left ? 'border-signal bg-ground-raised text-signal-ink' : 'border-white bg-white/75 text-ink hover:border-signal')}><span className="text-3xl">{cityPlaceIcons[pair.left]}</span><span className="mt-1 text-xs font-black"><RussianText text={pair.left} /></span>{done && <span className="mt-1 text-[10px] font-black">+10 ✓</span>}</button>
            })}
          </div>
        </div>
      </Card>

      {current && <Card className="p-3 sm:p-4"><p className="mb-3 text-sm font-black text-ink"><span className="mr-2 text-2xl">{cityPlaceIcons[current.left]}</span><RussianText text={current.left} /> haqida to‘g‘ri gapni tanlang:</p><div className="grid gap-2">{options.map((option) => <button key={option} type="button" onClick={() => choose(option)} className={cx('min-h-12 rounded-xl border-2 px-3 py-2 text-left text-sm font-black transition', wrong === option ? 'animate-pulse border-danger bg-danger-soft text-danger' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><RussianText text={option} /></button>)}</div></Card>}
      {solved.length === lesson.game.pairs.length && <Card className="border-milestone bg-milestone-soft/50 p-5 text-center"><span className="text-5xl">🏙️</span><h4 className="mt-2 text-xl font-black text-milestone">Shahar xaritasi tayyor!</h4><p className="mt-1 text-sm text-ink-muted">10 ta sevimli joy haqida to‘g‘ri gap tuzdingiz — 100 ball!</p></Card>}
    </div>
  )
}

function PluralPuzzle({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
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
            ? <img src={lesson.sceneImage} alt="Mehmonlar va oila bir xonada" className="h-full w-full object-cover" />
            : <div className="flex h-full items-center justify-center text-7xl">👨‍👩‍👧‍👦</div>}
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
              <RussianText text={pair.left} /> {done ? '✓' : '→ ?'}
            </button>
          )
        })}
      </div>

      {selected && (
        <Card className="p-3 sm:p-4">
          <p className="mb-2 text-xs font-black text-ink-muted"><RussianText text={selected} /> so‘zining ko‘pligini tanlang:</p>
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
  { id: 'picture-wall', label: 'devorda', icon: '🖼️', gridColumn: '1', gridRow: '1' },
  { id: 'tv-wall', label: 'devorda', icon: '📺', gridColumn: '2 / span 2', gridRow: '1' },
  { id: 'near-window', label: 'deraza yonida', icon: '💐', gridColumn: '4', gridRow: '1' },
  { id: 'corner', label: 'burchakda', icon: '🚪', gridColumn: '1', gridRow: '2' },
  { id: 'room-centre', label: 'xona o‘rtasida', icon: '🪑', gridColumn: '2 / span 2', gridRow: '2' },
  { id: 'beside-wall', label: 'devor yonida', icon: '🛏️', gridColumn: '4', gridRow: '2' },
  { id: 'beside-table', label: 'stol yonida', icon: '🪑', gridColumn: '1', gridRow: '3' },
  { id: 'on-desk', label: 'stol ustida', icon: '💡', gridColumn: '2', gridRow: '3' },
  { id: 'computer-desk', label: 'stol ustida', icon: '💻', gridColumn: '3', gridRow: '3' },
  { id: 'on-floor', label: 'polda', icon: '🧶', gridColumn: '4', gridRow: '3' },
] as const

const roomObjectIcons: Record<string, string> = {
  стол: '🪑', стул: '🪑', кровать: '🛏️', лампа: '💡', шкаф: '🚪',
  телевизор: '📺', ковёр: '🧶', картина: '🖼️', цветы: '💐', компьютер: '💻',
}

function RoomBuilder({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
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
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black text-ink-muted"><span>Buyumlar</span><span>Yon tomonga suring →</span></div>
        <div className="-mx-3 overflow-x-auto px-3 pb-2 [scrollbar-width:thin] sm:-mx-4 sm:px-4">
          <div className="flex w-max min-w-full gap-2">
            {remaining.length > 0 ? remaining.map((pair) => (
              <button key={pair.left} type="button" onClick={() => { setSelected(pair.left); setWrongSlot(null); playUiSound('select') }} className={cx('shrink-0 rounded-xl border-2 px-3 py-2.5 text-sm font-black transition', selected === pair.left ? 'border-signal bg-signal-soft text-signal-ink' : 'border-hairline bg-ground-raised text-ink')}>
                <span className="mr-1.5">{roomObjectIcons[pair.left]}</span><RussianText text={pair.left} />
              </button>
            )) : <p className="w-full py-2 text-center text-sm font-black text-milestone">Xona tayyor! ✓</p>}
          </div>
        </div>
      </Card>

      <RoomScene matches={matches} selected={selected} wrongSlot={wrongSlot} onSlot={place} />
      {wrongSlot && <p role="status" className="rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-black text-danger">Bu buyumning joyi boshqa. Yana urinib ko‘ring.</p>}
      {selected && <p className="text-center text-xs font-bold text-signal-ink"><RussianText text={selected} /> uchun xonadagi mos joyni bosing.</p>}
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
                <span className="text-lg sm:text-2xl">{word ? roomObjectIcons[word] : slot.icon}</span>
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
        <div className="mb-3 flex items-center justify-between text-xs font-black text-ink-muted"><span>Oilaviy surat</span><span>{solved}/{clues.length}</span></div>
        <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-2xl bg-signal-soft">
          <img src={lesson.sceneImage} alt="Panda va Pingvin bilan oilaviy surat" className="h-full w-full object-cover" />
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
                <button type="button" disabled={done} onClick={() => check(answer)} className="rounded-xl bg-signal px-3 text-sm font-black text-on-signal disabled:bg-milestone">{done ? '✓' : '→'}</button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function MissionModes({ lesson, missionId }: { lesson: LessonData; missionId?: string }) {
  const [mode, setMode] = useState<'dialogue' | 'ai' | null>(null)
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

  if (!mode) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" block onClick={() => setMode('dialogue')}>🎭 Dialogni mashq qilish</Button>
          <Button size="lg" block variant="secondary" onClick={() => setMode('ai')}>🎙️ AI bilan suhbat</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-5">
      {mode === 'dialogue' ? (
        <div>
          <div className="grid gap-2">
            {lesson.dialogue.map((line, index) => (
              <div key={`${line}-${index}`} className={cx('rounded-2xl p-3 text-sm leading-relaxed sm:text-base', index % 2 === 0 ? 'mr-6 bg-ground-sunken' : 'ml-6 bg-signal-soft')}><DialogueLine line={line} /></div>
            ))}
          </div>
          <MicButton listening={listening} processing={processing} onClick={() => void toggleRecording()} />
        </div>
      ) : (
        <div className="text-center">
          <p className="text-xs font-black tracking-[.14em] text-signal-ink uppercase">{questionIndex + 1} / {lesson.questions.length}</p>
          <SpeechButton text={lesson.questions[questionIndex].question} lang="ru-RU" autoPlayToken={`${mode}-${questionIndex}`} className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-signal-soft p-5 text-xl font-black text-ink"><RussianText text={lesson.questions[questionIndex].question} /></SpeechButton>
          <MicButton listening={listening} processing={processing} onClick={() => void toggleRecording(() => setTimeout(() => setQuestionIndex((current) => Math.min(current + 1, lesson.questions.length - 1)), 900))} />
        </div>
      )}
      {feedback && <p role="status" className="mt-3 rounded-xl bg-milestone-soft p-3 text-sm text-milestone"><RussianText text={feedback} /></p>}
    </Card>
  )
}

function DialogueLine({ line }: { line: string }) {
  const separator = line.indexOf(':')
  if (separator < 0) return <RussianText text={line} />
  return <><span className="text-ink">{line.slice(0, separator + 1)}</span><RussianText text={line.slice(separator + 1)} /></>
}

function MicButton({ listening, processing, onClick }: { listening: boolean; processing: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={processing} className={cx('mx-auto mt-4 flex size-16 items-center justify-center rounded-full text-2xl text-white shadow-lg disabled:opacity-60', listening ? 'animate-pulse bg-danger' : 'bg-signal')} aria-label={listening ? 'Yozishni to‘xtatish' : 'Mikrofon'}>{processing ? <span className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" /> : listening ? '■' : '🎙️'}</button>
}

function VocabularySection({ words }: { words: Vocab[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Card className="flex items-center gap-4 p-4 sm:p-5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-signal-soft text-4xl">🗂️</div>
        <div className="min-w-0 flex-1"><p className="text-xs font-black tracking-[.12em] text-signal-ink uppercase">{words.length} ta karta</p><h3 className="mt-1 text-xl font-black text-ink">Yangi so‘zlar kolodasi</h3></div>
        <Button onClick={() => setOpen(true)}>Ochish</Button>
      </Card>
      {open && <VocabularyDeck words={words} onClose={() => setOpen(false)} />}
    </>
  )
}

function VocabularyDeck({ words, onClose }: { words: Vocab[]; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const word = words[index]
  function rate(sound: UiSound) {
    playUiSound(sound)
    if (index === words.length - 1) { onClose(); return }
    setIndex((current) => current + 1)
    setFlipped(false)
  }
  return createPortal(
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-ground p-3 sm:p-6" role="dialog" aria-modal="true">
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
                <><h2 className="text-3xl font-black text-ink"><RussianText text={word.ru} /></h2><p className="mt-4 rounded-xl bg-ground-sunken p-3 leading-relaxed text-ink"><RussianText text={word.example} /></p><SpeechButton text={word.ru} lang="ru-RU" stopPropagation className="mt-4 inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-sm font-black text-on-signal">Tinglang va takrorlang</SpeechButton></>
              ) : (
                <><h2 className="text-3xl font-black text-ink">{word.uz}</h2><p className="mt-4 rounded-xl bg-ground-sunken p-3 leading-relaxed text-ink"><RussianText text={word.example} /></p><span className="mt-4 block text-sm font-bold text-ink-muted">Old tomon uchun kartani bosing</span></>
              )}
            </div>
          </div>
        </div>
        {flipped && <div className="grid grid-cols-3 gap-2 py-3"><button type="button" onClick={() => rate('coin')} className="rounded-xl bg-signal py-3 text-xs font-black text-white">выучил</button><button type="button" onClick={() => rate('wrong')} className="rounded-xl border border-danger py-3 text-xs font-black text-danger">не знаю</button><button type="button" onClick={() => rate('select')} className="rounded-xl border border-hairline py-3 text-xs font-black text-ink">повторю</button></div>}
      </div>
    </div>, document.body,
  )
}

function ExerciseSection({ lesson }: { lesson: LessonData }) {
  const [answer, setAnswer] = useState('')
  if (lesson.exercise.kind === 'remove-clutter') return <RemoveClutterExercise lesson={lesson} />
  return (
    <Card className="p-4 sm:p-5">
      {lesson.day === 1 && <NeighborScene />}
      {lesson.sceneImage && <img src={lesson.sceneImage} alt="Oila surati" className="mb-4 aspect-square w-full rounded-2xl object-cover sm:aspect-[16/10]" />}
      {lesson.game.kind === 'room-builder' && <div className="mb-4"><RoomScene /></div>}
      <div className="flex items-start gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-2xl">🖼️</span><p className="text-sm leading-relaxed text-ink-muted">{lesson.exercise.instruction}</p></div>
      <p className="mt-3 rounded-xl bg-ground-sunken p-3 text-sm leading-relaxed text-ink"><RussianText text={lesson.exercise.starter} /></p>
      <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={lesson.exercise.starter} className="mt-4 min-h-32 w-full rounded-2xl border border-hairline bg-ground p-3 text-ink outline-none focus:border-signal" />
      <SpeechButton text={answer || lesson.exercise.starter} lang="ru-RU" className="mt-3 inline-flex items-center gap-2 rounded-full bg-signal-soft px-4 py-2 text-sm font-black text-signal-ink">Matnni tinglash</SpeechButton>
      {lesson.exercise.example && (
        <div className="mt-4 rounded-xl border border-hairline bg-ground-sunken p-3">
          <p className="text-xs font-black tracking-[.12em] text-ink-muted uppercase">Namuna</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink"><RussianText text={lesson.exercise.example} /></p>
        </div>
      )}
    </Card>
  )
}

function NeighborScene() {
  return (
    <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#dff1ff_0_62%,#d7c4a7_62%)]">
      <div className="absolute top-5 left-1/2 h-24 w-28 -translate-x-1/2 rounded-t-full border-[10px] border-[#a66b43] bg-[#fff4d7] sm:h-36 sm:w-40" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-5 sm:gap-10">
        <MascotImage mascot="penguin" className="h-32 w-28 sm:h-48 sm:w-40" />
        <MascotImage mascot="panda" className="h-28 w-28 sm:h-44 sm:w-40" />
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-signal-ink">Ikki qo‘shni suhbati</span>
    </div>
  )
}

function RemoveClutterExercise({ lesson }: { lesson: LessonData }) {
  const items = lesson.exercise.items ?? []
  const [removed, setRemoved] = useState<string[]>([])
  const [message, setMessage] = useState('')

  function remove(item: (typeof items)[number]) {
    if (removed.includes(item.item)) return
    setRemoved((current) => [...current, item.item])
    setMessage(item.phrase)
    celebrate([20, 25, 35], removed.length + 1 === items.length ? 'win' : 'coin')
    void speak(item.phrase, 'ru-RU')
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-2xl">🧹</span><div><h3 className="font-black text-ink">{lesson.exercise.title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.exercise.instruction}</p></div></div>
      </Card>
      <Card className="overflow-hidden p-3 sm:p-5">
        <div className="relative mx-auto aspect-[4/3] max-w-2xl overflow-hidden rounded-2xl border border-signal/25 bg-[linear-gradient(to_bottom,#e4f3ff_0_62%,#d8bd98_62%_100%)] p-3">
          <div className="absolute top-3 right-4 h-16 w-24 rounded-lg border-4 border-white bg-[#bfe6ff] shadow-inner sm:h-24 sm:w-36"><span className="absolute inset-x-0 top-1/2 border-t-2 border-white" /><span className="absolute inset-y-0 left-1/2 border-l-2 border-white" /></div>
          <div className="absolute right-6 bottom-5 h-20 w-40 rounded-t-3xl bg-[#8f6b50] sm:h-28 sm:w-64" />
          <div className="absolute bottom-4 left-4 h-14 w-28 rounded-lg bg-[#a77a55] sm:h-20 sm:w-44" />
          <div className="relative z-10 grid h-full grid-cols-4 grid-rows-2 gap-2 pt-10 sm:gap-4 sm:pt-16">
            {items.map((item) => {
              const isRemoved = removed.includes(item.item)
              return <button key={item.item} type="button" disabled={isRemoved} onClick={() => remove(item)} className={cx('flex min-h-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/90 bg-white/80 p-1 shadow-sm transition duration-300 hover:border-signal hover:bg-white sm:p-2', isRemoved && 'pointer-events-none scale-50 opacity-0')}><span className="text-2xl sm:text-4xl">{item.icon}</span><span className="mt-1 text-[9px] font-black text-ink sm:text-xs"><RussianText text={item.item} /></span></button>
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-ground-sunken px-3 py-2 text-sm"><span className="font-bold text-ink-muted">Olib tashlandi: {removed.length}/{items.length}</span>{message && <span role="status" className="font-black text-signal-ink"><RussianText text={message} /></span>}</div>
      </Card>
    </div>
  )
}

function CompleteSection({ lesson }: { lesson: LessonData }) {
  useEffect(() => { celebrate([45, 45, 80], 'win') }, [])
  return (
    <Card className="relative overflow-hidden border-milestone bg-milestone-soft/35 p-5 text-center sm:p-8">
      <Celebration />
      <MascotImage mascot="penguin" className="mx-auto h-28 w-28 object-contain" />
      <span className="mt-2 inline-flex rounded-full bg-milestone-soft px-3 py-1.5 text-sm font-black text-milestone">{lesson.day}-dars muvaffaqiyatli tugadi</span>
      <h3 className="mt-3 text-3xl font-black text-ink">Ajoyib!</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{lesson.completionMessage ?? 'Bugungi iboralar, qoida, o‘yin va ovozli mashqlar yakunlandi. Yangi bilimlarni keyingi suhbatda ishlating.'}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {lesson.outcomes.map((outcome) => <div key={outcome.title} className="rounded-2xl bg-ground-raised p-3"><h4 className={cx('font-black', outcome.tone === 'yellow' ? 'text-[#e5b600]' : outcome.tone === 'red' ? 'text-[#ff2400]' : 'text-[#0000ff]')}><RussianText text={outcome.title} /></h4><p className="text-sm text-ink-muted">{outcome.translation}</p></div>)}
      </div>
      {lesson.reflection && <ReflectionQuestions reflection={lesson.reflection} />}
      {lesson.completionAction && <a href={lesson.completionAction.href} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-signal px-5 py-2.5 text-sm font-black text-on-signal shadow-sm">{lesson.completionAction.label} ↗</a>}
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
  children: ReactNode
  className?: string
  stopPropagation?: boolean
  autoPlayToken?: string
  rate?: number
}) {
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
    <button type="button" onClick={toggle} className={cx('inline-flex items-center justify-center gap-2', className)} aria-label={status === 'playing' ? 'Pauza' : 'Tinglash'}>
      {status === 'loading' ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : status === 'playing' ? <PauseGlyph /> : <PlayGlyph />}
      <span>{children}</span>
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
    const parsed = JSON.parse(raw) as Partial<StoredState>
    const completed = Array.isArray(parsed.completed) ? parsed.completed.filter((id): id is SectionId => sections.some((section) => section.id === id)) : []
    return {
      ...emptyState,
      ...parsed,
      completed,
      sectionIndex: Math.min(Math.max(parsed.sectionIndex ?? 0, 0), sections.length - 1),
      answers: Array.isArray(parsed.answers) ? parsed.answers : [null, null],
      phraseRatings: parsed.phraseRatings ?? {},
      gameMatches: parsed.gameMatches ?? {},
    }
  } catch { return emptyState }
}

const celebrationColors = ['#5b9bf5', '#ff2400', '#f4c84d', '#44944a', '#ed3cca']
function Celebration() {
  return createPortal(<span className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">{Array.from({ length: 52 }, (_, index) => {
    const style = { '--fall-x': `${3 + ((index * 37) % 94)}vw`, '--fall-drift': `${(index % 2 ? -1 : 1) * (16 + (index % 5) * 8)}px`, '--fall-rotate': `${360 + index * 29}deg`, '--fall-delay': `${(index % 12) * 45}ms`, '--fall-duration': `${1900 + (index % 7) * 130}ms`, '--fall-color': celebrationColors[index % celebrationColors.length] } as CSSProperties
    return <span key={index} className={cx('answer-celebration__piece', index % 3 === 0 ? 'answer-celebration__ball' : 'answer-celebration__ribbon')} style={style} />
  })}{Array.from({ length: 12 }, (_, index) => <span key={`balloon-${index}`} className="answer-celebration__balloon" style={{ '--balloon-x': `${5 + ((index * 41) % 90)}vw`, '--balloon-delay': `${index * 90}ms`, '--fall-color': celebrationColors[index % celebrationColors.length] } as CSSProperties} />)}</span>, document.body)
}

function celebrate(pattern: number | number[] = 35, sound: UiSound = 'correct') {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(pattern)
  playUiSound(sound)
}
