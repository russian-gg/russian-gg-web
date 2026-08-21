import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Card, PauseGlyph, PlayGlyph, ProgressBar } from '../components/ui'
import { readAudioPreferences } from '../lib/audio-preferences'
import { useAuth } from '../lib/auth-context'
import { cx } from '../lib/cx'
import { foundationLessons, type LessonData, type Mascot, type Phrase, type Quiz, type Vocab } from '../lib/foundation-lessons'
import { lessonOneStorageKey } from '../lib/demo-lesson-one'
import { syncLessonOneCompletion } from '../lib/lesson-one-sync'
import { playUiSound, type UiSound } from '../lib/ui-sounds'

const sections = [
  { id: 'tests', title: 'Yengil test' },
  { id: 'phonetics', title: 'Fonetik qoida' },
  { id: 'grammar', title: 'Grammatik qoida' },
  { id: 'phrases', title: '15 ta asosiy ibora' },
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
    ? day === 1
      ? lessonOneStorageKey(user.id)
      : `rgg.demostage.foundation-lesson.v1.${user.id}.${day}`
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

  if (!lesson || day < 1 || day > 5) return <Navigate to="/path" replace />

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
      <LessonHero lesson={lesson} progress={progress} />

      <section aria-labelledby={`section-${active.id}`}>
        <div className="mb-3 flex items-baseline gap-2 sm:mb-4">
          <span className="text-sm font-black text-signal-ink">{state.sectionIndex + 1}</span>
          <h2 id={`section-${active.id}`} className="text-xl font-black tracking-tight text-ink sm:text-3xl">
            {active.id === 'grammar' && day === 1 ? 'Rodlar haqida ertak' : active.title}
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
        {active.id === 'grammar' && <RuleSection rule={lesson.grammar} />}
        {active.id === 'phrases' && (
          <PhrasesSection phrases={lesson.phrases} ratings={state.phraseRatings} onRate={(index, rating) => {
            setState((current) => ({ ...current, phraseRatings: { ...current.phraseRatings, [index]: rating } }))
          }} />
        )}
        {active.id === 'game' && (
          <MatchingGame lesson={lesson} matches={state.gameMatches} onChange={(gameMatches) => {
            setState((current) => ({ ...current, gameMatches }))
          }} />
        )}
        {active.id === 'missions' && <MissionModes lesson={lesson} />}
        {active.id === 'vocabulary' && <VocabularySection words={lesson.vocabulary} />}
        {active.id === 'picture' && <ExerciseSection lesson={lesson} />}
        {active.id === 'complete' && <CompleteSection lesson={lesson} />}
      </section>

      <div className="flex items-center gap-2 border-t border-hairline pt-4">
        {state.sectionIndex > 0 && <Button variant="ghost" onClick={goBack}>← Orqaga</Button>}
        <Button className="ml-auto" onClick={() => void finishCurrent()}>
          {active.id === 'complete' ? 'Darsni yakunlash' : 'Davom etish →'}
        </Button>
      </div>
    </div>
  )
}

function LessonHero({ lesson, progress }: { lesson: LessonData; progress: number }) {
  return (
    <Card className="lesson-hero p-4 sm:p-6">
      <p className="text-xs font-black tracking-[.16em] text-signal-ink uppercase">{lesson.day}-dars · A1</p>
      <h1 className="mt-1 text-2xl font-black leading-tight text-ink sm:text-4xl">{lesson.titleRu}</h1>
      <p className="mt-1 text-sm text-ink-muted sm:text-base">{lesson.titleUz}</p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold sm:text-sm">
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
        <p className={cx('mt-3 rounded-xl p-3 text-sm', correct ? 'bg-milestone-soft text-milestone' : 'bg-danger-soft text-danger')}>
          {correct ? quiz.feedback : 'Yana urinib ko‘ring.'}
        </p>
      )}
    </Card>
  )
}

function RuleSection({ rule }: { rule: LessonData['phonetics'] }) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-5">
        <MascotImage mascot={rule.mascot} className="size-16 shrink-0 sm:size-24" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black leading-tight text-ink sm:text-2xl">{rule.title}</h3>
          <p className="mt-2 font-semibold leading-relaxed text-ink-muted">{rule.lead}</p>
          <SpeechButton text={`${rule.title}. ${rule.lead} ${rule.body.join(' ')}`} lang="uz-UZ" className="mt-3 inline-flex items-center gap-2 rounded-full bg-signal-soft px-3 py-2 text-sm font-black text-signal-ink">Qoidani tinglash</SpeechButton>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm leading-relaxed text-ink-muted sm:text-base">
        {rule.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {rule.examples.map((example) => (
          <SpeechButton key={example} text={example} lang="ru-RU" className={cx('rounded-full border border-hairline bg-ground-raised px-3 py-2 font-black text-ink shadow-sm', /^[АИУ]$/u.test(example) && 'text-3xl text-[#FF2400]')}>
            <RussianText text={example} />
          </SpeechButton>
        ))}
      </div>
    </Card>
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
      {open !== null && <StudyCard phrase={phrases[open]} onClose={() => setOpen(null)} onRate={(rating) => { onRate(open, rating); setOpen(null) }} />}
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
          {phrase.pronunciation && <p className="mt-1 text-sm font-semibold text-ink-muted">{phrase.pronunciation}</p>}
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

function MatchingGame({ lesson, matches, onChange }: { lesson: LessonData; matches: Record<string, string>; onChange: (matches: Record<string, string>) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const shuffledRight = useMemo(() => [...lesson.game.pairs].sort((a, b) => a.right.localeCompare(b.right)), [lesson])
  const matchedCount = Object.keys(matches).length
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
                } else {
                  navigator.vibrate?.([30, 30, 30])
                  playUiSound('wrong')
                }
              }} className={cx('min-h-11 rounded-xl border-2 px-2 py-2 text-sm font-black', used ? 'border-milestone bg-milestone-soft text-milestone' : 'border-hairline bg-ground-raised text-ink hover:border-signal')}><RussianText text={pair.right} /></button>
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}

function MissionModes({ lesson }: { lesson: LessonData }) {
  const [mode, setMode] = useState<'dialogue' | 'ai' | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [listening, setListening] = useState(false)

  function listen(onDone?: () => void) {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setFeedback('Brauzer ovozni matnga aylantirishni qo‘llamaydi. Gapni ovoz chiqarib o‘qing va keyingi bosqichga o‘ting.')
      speak('Gapni ovoz chiqarib o‘qing. Ajoyib mashq!', 'uz-UZ')
      onDone?.()
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.interimResults = false
    recognition.onstart = () => { setListening(true); setFeedback('') }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setFeedback('Ovoz aniqlanmadi. Mikrofonni qayta bosing.')
    recognition.onresult = () => {
      const message = 'Yaxshi! Talaffuzingiz eshitildi. Ruscha urg‘uga e’tibor berib yana bir marta takrorlang.'
      setFeedback(message)
      speak(message, 'uz-UZ')
      onDone?.()
    }
    recognition.start()
  }

  if (!mode) {
    return (
      <Card className="p-4 sm:p-5">
        <p className="mb-4 text-sm leading-relaxed text-ink-muted">Mashq turini tanlang. Har ikkala rejimda ham chat yo‘q — faqat matn, audio va mikrofon.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" block onClick={() => setMode('dialogue')}>🎭 Dialogni mashq qilish</Button>
          <Button size="lg" block variant="secondary" onClick={() => setMode('ai')}>🎙️ AI bilan suhbat</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-5">
      <button type="button" className="mb-3 text-sm font-black text-ink-muted" onClick={() => { setMode(null); setFeedback('') }}>← Rejimlarni tanlash</button>
      {mode === 'dialogue' ? (
        <div>
          <div className="grid gap-2">
            {lesson.dialogue.map((line, index) => (
              <div key={`${line}-${index}`} className={cx('rounded-2xl p-3 text-sm leading-relaxed sm:text-base', index % 2 === 0 ? 'mr-6 bg-ground-sunken' : 'ml-6 bg-signal-soft')}><RussianText text={line} /></div>
            ))}
          </div>
          <MicButton listening={listening} onClick={() => listen()} />
        </div>
      ) : (
        <div className="text-center">
          <p className="text-xs font-black tracking-[.14em] text-signal-ink uppercase">{questionIndex + 1} / {lesson.questions.length}</p>
          <SpeechButton text={lesson.questions[questionIndex].question} lang="ru-RU" autoPlayToken={`${mode}-${questionIndex}`} className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-signal-soft p-5 text-xl font-black text-ink"><RussianText text={lesson.questions[questionIndex].question} /></SpeechButton>
          <MicButton listening={listening} onClick={() => listen(() => setTimeout(() => setQuestionIndex((current) => Math.min(current + 1, lesson.questions.length - 1)), 900))} />
        </div>
      )}
      {feedback && <p role="status" className="mt-3 rounded-xl bg-milestone-soft p-3 text-sm text-milestone">{feedback}</p>}
    </Card>
  )
}

function MicButton({ listening, onClick }: { listening: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cx('mx-auto mt-4 flex size-16 items-center justify-center rounded-full text-2xl text-white shadow-lg', listening ? 'animate-pulse bg-danger' : 'bg-signal')} aria-label="Mikrofon">{listening ? '■' : '🎙️'}</button>
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
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-2xl">🖼️</span><div><h3 className="font-black text-ink">{lesson.exercise.title}</h3><p className="mt-1 text-sm leading-relaxed text-ink-muted">{lesson.exercise.instruction}</p></div></div>
      <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={lesson.exercise.starter} className="mt-4 min-h-32 w-full rounded-2xl border border-hairline bg-ground p-3 text-ink outline-none focus:border-signal" />
      <SpeechButton text={answer || lesson.exercise.starter} lang="ru-RU" className="mt-3 inline-flex items-center gap-2 rounded-full bg-signal-soft px-4 py-2 text-sm font-black text-signal-ink">Matnni tinglash</SpeechButton>
    </Card>
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
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">Bugungi iboralar, qoida, o‘yin va ovozli mashqlar yakunlandi. Yangi bilimlarni keyingi suhbatda ishlating.</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {lesson.outcomes.map((outcome) => <div key={outcome.title} className="rounded-2xl bg-ground-raised p-3"><h4 className={cx('font-black', outcome.tone === 'yellow' ? 'text-[#e5b600]' : 'text-[#0000ff]')}>{outcome.title}</h4><p className="text-sm text-ink-muted">{outcome.translation}</p></div>)}
      </div>
    </Card>
  )
}

function MascotImage({ mascot, className }: { mascot: Mascot; className?: string }) {
  return <img src={`/lesson-mascots/${mascot}.png`} alt={mascot === 'penguin' ? 'Pingvin ustoz' : mascot === 'panda' ? 'Panda murabbiy' : 'Pero yordamchi'} className={cx('object-contain', className)} />
}

const nounColors = {
  masculine: '#0000FF', feminine: '#FF2400', neuter: '#FFFF00',
}
const caseColors: Record<string, string> = { genitive: '#8B00FF', dative: '#964B00', accusative: '#00BFFF', instrumental: '#44944A', prepositional: '#480607' }
const nounStems = [
  ...'учител,инженер,студент,рабоч,начальник,директор,телефон,звонок,сосед,ключ,этаж,офис,друг,голос,вопрос,ответ,язык,текст,диалог,фильм,хлеб,диван,телевизор,порт,стол,стул,муж,дом,пап,врач,номер,чай,парк,мёд,мяч,мир,мост'.split(',').map((stem) => ({ stem, color: nounColors.masculine })),
  ...'професси,квартир,лестниц,комнат,зарплат,больниц,компани,грамматик,музык,стать,гитар,ошибк,дорог,работ,школ,книг,газет,правд,фраз,двер,мам,панд'.split(',').map((stem) => ({ stem, color: nounColors.feminine })),
  ...'упражнен,письм,радио,мюсл,окн,мор,слов,мыл'.split(',').map((stem) => ({ stem, color: nounColors.neuter })),
].sort((a, b) => b.stem.length - a.stem.length)

function RussianText({ text }: { text: string }) {
  const pieces = text.split(/([А-Яа-яЁё]+)/g)
  let previousWord = ''
  return <>{pieces.map((piece, index) => {
    if (!/[А-Яа-яЁё]/.test(piece)) return <span key={index}>{piece}</span>
    const lower = piece.toLocaleLowerCase('ru-RU')
    const rendered = colorRussianWord(piece, lower, previousWord)
    previousWord = lower
    return <span key={index}>{rendered}</span>
  })}</>
}

function colorRussianWord(original: string, lower: string, previousWord: string): ReactNode {
  if (/^[аиу]$/u.test(lower)) return <span style={{ color: '#FF2400' }}>{original}</span>
  const noun = nounStems.find(({ stem }) => lower.startsWith(stem))
  if (noun) {
    const rootLength = noun.stem.length
    const root = original.slice(0, rootLength)
    const ending = original.slice(rootLength)
    const caseName = previousWord === 'к' ? 'dative'
      : ['с', 'со'].includes(previousWord) ? 'instrumental'
        : ['о', 'об', 'на', 'в'].includes(previousWord) ? 'prepositional'
          : ['у', 'без', 'для', 'до', 'от'].includes(previousWord) ? 'genitive'
            : null
    const rootStyle = noun.color === '#FFFF00' ? { color: noun.color, textShadow: '0 0 1px #7a6500' } : { color: noun.color }
    const endingColor = caseName ? caseColors[caseName] : noun.color
    const endingStyle = endingColor === '#FFFF00' ? { color: endingColor, textShadow: '0 0 1px #7a6500' } : { color: endingColor }
    return <><span style={rootStyle}>{root}</span>{ending && <span style={endingStyle}>{ending}</span>}</>
  }
  const past = lower.match(/л[аои]?$/u)
  if (past && lower.length > past[0].length + 1) {
    return <><span>{original.slice(0, -past[0].length)}</span><span style={{ color: '#F984E5' }}>{original.slice(-past[0].length)}</span></>
  }
  const personalEndings = ['аетесь', 'яетесь', 'итесь', 'аешь', 'яешь', 'аьют', 'яют', 'уют', 'аете', 'яете', 'аете', 'ишь', 'ешь', 'ете', 'ите', 'ает', 'яет', 'уют', 'ют', 'ут', 'ят', 'ат', 'ем', 'им', 'ю', 'у']
  const ending = personalEndings.find((candidate) => lower.endsWith(candidate) && lower.length > candidate.length + 1)
  if (ending) return <><span>{original.slice(0, -ending.length)}</span><span style={{ color: '#ED3CCA' }}>{original.slice(-ending.length)}</span></>
  return original
}

type RecognitionLike = {
  lang: string
  interimResults: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: (() => void) | null
  start: () => void
}
type RecognitionConstructor = new () => RecognitionLike

function getSpeechRecognition(): RecognitionConstructor | null {
  const speechWindow = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

function speak(text: string, lang: string) {
  if (!('speechSynthesis' in window)) return
  if (readAudioPreferences().muted) return
  window.dispatchEvent(new CustomEvent('rgg-speech-start', { detail: { id: null } }))
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.replace(/🐧|🐼|🪶|🎭|🎙️/gu, ''))
  utterance.lang = lang
  utterance.rate = (lang === 'ru-RU' ? 0.84 : 0.92) * readAudioPreferences().speed
  window.speechSynthesis.speak(utterance)
}

function SpeechButton({ text, lang, children, className, stopPropagation = false, autoPlayToken }: {
  text: string
  lang: string
  children: ReactNode
  className?: string
  stopPropagation?: boolean
  autoPlayToken?: string
}) {
  const id = useId()
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused'>('idle')

  function start() {
    if (!('speechSynthesis' in window) || readAudioPreferences().muted) return
    window.speechSynthesis.cancel()
    window.dispatchEvent(new CustomEvent('rgg-speech-start', { detail: { id } }))
    const utterance = new SpeechSynthesisUtterance(text.replace(/🐧|🐼|🪶|🎭|🎙️/gu, ''))
    utterance.lang = lang
    utterance.rate = (lang === 'ru-RU' ? 0.84 : 0.92) * readAudioPreferences().speed
    utterance.onend = () => setStatus('idle')
    utterance.onerror = () => setStatus('idle')
    setStatus('playing')
    window.speechSynthesis.speak(utterance)
  }

  function toggle(event: React.MouseEvent) {
    if (stopPropagation) event.stopPropagation()
    if (!('speechSynthesis' in window)) return
    if (status === 'playing') {
      window.speechSynthesis.pause()
      setStatus('paused')
      return
    }
    if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('playing')
      return
    }
    start()
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
    if (autoPlayToken) start()
    // A token is emitted only when a new AI prompt becomes active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayToken])

  return (
    <button type="button" onClick={toggle} className={className} aria-label={status === 'playing' ? 'Pauza' : 'Tinglash'}>
      {status === 'playing' ? <PauseGlyph /> : <PlayGlyph />}
      {children}
    </button>
  )
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
  return createPortal(<span className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">{Array.from({ length: 34 }, (_, index) => {
    const style = { '--fall-x': `${3 + ((index * 37) % 94)}vw`, '--fall-drift': `${(index % 2 ? -1 : 1) * (16 + (index % 5) * 8)}px`, '--fall-rotate': `${360 + index * 29}deg`, '--fall-delay': `${(index % 12) * 45}ms`, '--fall-duration': `${1900 + (index % 7) * 130}ms`, '--fall-color': celebrationColors[index % celebrationColors.length] } as CSSProperties
    return <span key={index} className={cx('answer-celebration__piece', index % 3 === 0 ? 'answer-celebration__ball' : 'answer-celebration__ribbon')} style={style} />
  })}</span>, document.body)
}

function celebrate(pattern: number | number[] = 35, sound: UiSound = 'correct') {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(pattern)
  playUiSound(sound)
}
