import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Headphones, RotateCcw, Timer as TimerIcon, Trophy } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button, Card } from '../../../components/ui'
import { RussianText } from '../../../components/RussianText'
import { readAudioPreferences } from '../../../lib/audio-preferences'
import { cx } from '../../../lib/cx'
import { foundationLessons, type Phrase, type Vocab } from '../../../lib/foundation-lessons'
import { fill, useT } from '../../../lib/i18n'
import { cleanSpeechText } from '../../../lib/lesson-speech'
import { playPromptAudio, stopPromptAudio } from '../../../lib/liveVoice'
import { playUiSound } from '../../../lib/ui-sounds'
import { useUsageToday } from '../../../lib/usage'

/*
  The games with one right answer: hear a phrase and find it, build a sentence from its words,
  pair a word with its meaning. No model judges anything, so they are the shelf of a learner
  whose plan has no AI — and open to everybody else the panel switches them on for.

  They are made of the lessons the learner has reached: the phrases and words are the course's
  own, and the sound is the lesson audio already stored. Nothing is written for a game.
*/

export type ClassroomGameSlug = 'eshitib-top' | 'soz-tartibi' | 'xotira'

const ROUND_SECONDS = 60
const POINTS = 10

/** The phrases and words of every lesson up to the day the learner is on. */
function useLessonContent() {
  const { data: usage } = useUsageToday()
  const day = Math.max(usage?.courseDay ?? 1, 1)
  return useMemo(() => {
    const lessons = Object.values(foundationLessons).filter((lesson) => lesson.day <= day)
    const reached = lessons.length > 0 ? lessons : Object.values(foundationLessons).slice(0, 1)
    return {
      phrases: reached.flatMap((lesson) => lesson.phrases),
      words: reached.flatMap((lesson) => lesson.vocabulary),
    }
  }, [day])
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

function bestKey(slug: string) {
  return `rgg.game.best.${slug}`
}

function readBest(slug: string) {
  try {
    return Number(localStorage.getItem(bestKey(slug))) || 0
  } catch {
    return 0
  }
}

const SLUGS: ClassroomGameSlug[] = ['eshitib-top', 'soz-tartibi', 'xotira']

/** The route for all three: which game it is comes from the address. */
export function ClassroomGame() {
  const slug = useLocation().pathname.split('/').filter(Boolean).pop() as ClassroomGameSlug
  // A new address is a new game, not the last one's score under another title.
  return SLUGS.includes(slug) ? <Game key={slug} slug={slug} /> : <Navigate to="/games" replace />
}

function Game({ slug }: { slug: ClassroomGameSlug }) {
  const arcade = useT().arcade
  const t = arcade.classroom
  const content = useLessonContent()
  const [phase, setPhase] = useState<'intro' | 'play' | 'over'>('intro')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => readBest(slug))
  /** A new round is a new game: the play screen is built again from scratch. */
  const [round, setRound] = useState(0)
  const title = (arcade.games as Record<string, { title: string; body: string }>)[slug]

  useEffect(() => stopPromptAudio, [])

  function start() {
    setScore(0)
    setRound((current) => current + 1)
    setPhase('play')
  }

  function finish(final: number) {
    setScore(final)
    if (final > best) {
      setBest(final)
      try {
        localStorage.setItem(bestKey(slug), String(final))
      } catch {
        // A full or blocked store only costs the record; the game is unaffected.
      }
      playUiSound('win')
    }
    stopPromptAudio()
    setPhase('over')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <header className="flex items-center gap-3">
        <Link to="/games" aria-label={t.back} className="raised raised-sm flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-ground-raised text-ink-muted">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-black tracking-tight text-ink">{title.title}</h1>
        <span className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-ground-sunken px-3 py-1 text-sm font-black tabular-nums text-ink-muted">
          <Trophy aria-hidden="true" className="size-4" /> {best}
        </span>
      </header>

      {phase === 'intro' && (
        <Card className="p-5 text-center sm:p-6">
          <p className="text-base leading-relaxed text-ink-muted">{t.how[slug]}</p>
          <Button size="lg" className="mt-5" onClick={start}>{t.start}</Button>
        </Card>
      )}

      {phase === 'play' && slug === 'eshitib-top' && <HearAndFind key={round} phrases={content.phrases} onOver={finish} />}
      {phase === 'play' && slug === 'soz-tartibi' && <BuildSentence key={round} phrases={content.phrases} onOver={finish} />}
      {phase === 'play' && slug === 'xotira' && <MemoryPairs key={round} words={content.words} onOver={finish} />}

      {phase === 'over' && (
        <Card className="p-5 text-center sm:p-6">
          <p role="status" className="text-sm font-black tracking-[0.12em] text-ink-faint uppercase">{t.score}</p>
          <p className="mt-1 text-5xl font-black tabular-nums text-ink">{score}</p>
          {score > 0 && score >= best && <p className="mt-2 text-sm font-black text-milestone">{t.newRecord}</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={start}><RotateCcw aria-hidden="true" className="size-4" /> {t.again}</Button>
            <Link to="/games" className="inline-flex items-center rounded-[var(--radius-control)] px-4 text-sm font-extrabold text-ink-muted hover:text-ink">{t.back}</Link>
          </div>
        </Card>
      )}
    </div>
  )
}

/** Sixty seconds, counted down; calls `onEnd` once when they run out. */
function useCountdown(onEnd: () => void) {
  const [left, setLeft] = useState(ROUND_SECONDS)
  const ended = useRef(onEnd)
  ended.current = onEnd
  useEffect(() => {
    const timer = window.setInterval(() => setLeft((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (left === 0) ended.current()
  }, [left])
  return left
}

function Hud({ left, score }: { left?: number; score: number }) {
  const t = useT().arcade.classroom
  return (
    <div className="mb-4 flex items-center justify-between gap-3 text-sm font-black tabular-nums">
      {left !== undefined
        ? (
          <span className={cx('flex items-center gap-1.5', left <= 10 ? 'text-danger' : 'text-ink-muted')}>
            <TimerIcon aria-hidden="true" className="size-4" /> {left}
          </span>
        )
        : <span />}
      <span className="text-ink">{t.score}: {score}</span>
    </div>
  )
}

function OptionButton({ state, onClick, children, center = false }: {
  state: 'idle' | 'right' | 'wrong'
  onClick: () => void
  children: ReactNode
  center?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state !== 'idle'}
      className={cx(
        'raised raised-sm rounded-2xl border-2 px-3.5 py-3 text-sm leading-relaxed sm:text-base',
        center ? 'text-center font-black' : 'text-left',
        state === 'right' && 'border-milestone bg-milestone-soft text-milestone',
        state === 'wrong' && 'border-danger bg-danger-soft text-danger',
        state === 'idle' && 'border-hairline bg-ground-raised text-ink hover:border-signal',
      )}
    >
      {children}
    </button>
  )
}

/** Hear a phrase, pick it out of three. Without sound the meaning is shown instead. */
function HearAndFind({ phrases, onOver }: { phrases: Phrase[]; onOver: (score: number) => void }) {
  const t = useT().arcade.classroom
  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
  const left = useCountdown(() => onOver(scoreRef.current))
  const [question, setQuestion] = useState(() => nextQuestion(phrases))
  const [picked, setPicked] = useState<number | null>(null)
  /** The clip is missing or sound is off: the phrase's meaning stands in for hearing it. */
  const [silent, setSilent] = useState(() => readAudioPreferences().muted)

  function play() {
    if (readAudioPreferences().muted) {
      setSilent(true)
      return
    }
    void playPromptAudio(cleanSpeechText(question.answer.ru)).then(() => setSilent(false), () => setSilent(true))
  }

  useEffect(() => {
    play()
    // Each new question is read once, when it comes up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  function pick(index: number) {
    if (picked !== null) return
    setPicked(index)
    const right = index === question.correct
    playUiSound(right ? 'correct' : 'wrong')
    if (right) {
      scoreRef.current += POINTS
      setScore(scoreRef.current)
    }
    window.setTimeout(() => {
      setPicked(null)
      setQuestion(nextQuestion(phrases))
    }, right ? 600 : 1200)
  }

  return (
    <Card className="p-4 sm:p-5">
      <Hud left={left} score={score} />
      <div className="text-center">
        <button
          type="button"
          onClick={play}
          aria-label={t.listen}
          className="raised raised-signal-soft mx-auto flex size-20 items-center justify-center rounded-full bg-signal-soft text-signal-ink"
        >
          <Headphones aria-hidden="true" strokeWidth={1.9} className="size-8" />
        </button>
        <p className="mt-3 text-sm text-ink-muted">{silent ? t.meaningPrompt : t.listenPrompt}</p>
        {(silent || picked !== null) && <p className="mt-1 text-base font-black text-ink">{question.answer.uz}</p>}
      </div>
      <div className="mt-4 grid gap-2">
        {question.options.map((option, index) => (
          <OptionButton
            key={`${option.ru}-${index}`}
            state={picked === null ? 'idle' : index === question.correct ? 'right' : index === picked ? 'wrong' : 'idle'}
            onClick={() => pick(index)}
          >
            <RussianText text={option.ru} />
          </OptionButton>
        ))}
      </div>
    </Card>
  )
}

function nextQuestion(phrases: Phrase[]) {
  const options = shuffle(phrases).filter((phrase, index, all) => all.findIndex((other) => other.ru === phrase.ru) === index).slice(0, 3)
  const correct = Math.floor(Math.random() * options.length)
  return { options, correct, answer: options[correct] }
}

/** The meaning is given; the sentence is put together from its own words. */
function BuildSentence({ phrases, onOver }: { phrases: Phrase[]; onOver: (score: number) => void }) {
  const t = useT().arcade.classroom
  const pool = useMemo(() => phrases.filter((phrase) => {
    const words = phrase.ru.trim().split(/\s+/u).length
    return words >= 3 && words <= 7
  }), [phrases])
  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
  const left = useCountdown(() => onOver(scoreRef.current))
  const [task, setTask] = useState(() => nextTask(pool.length > 0 ? pool : phrases))
  /** Tile positions, in the order the learner has tapped them. */
  const [placed, setPlaced] = useState<number[]>([])
  const [result, setResult] = useState<'right' | 'wrong' | null>(null)

  function tap(tile: number) {
    if (result || placed.includes(tile)) return
    const next = [...placed, tile]
    setPlaced(next)
    if (next.length < task.tiles.length) return

    const right = next.map((index) => task.tiles[index]).join(' ') === task.words.join(' ')
    setResult(right ? 'right' : 'wrong')
    playUiSound(right ? 'correct' : 'wrong')
    if (right) {
      scoreRef.current += POINTS
      setScore(scoreRef.current)
    }
    window.setTimeout(() => {
      setResult(null)
      setPlaced([])
      // A wrong order is tried again; a right one brings the next sentence.
      if (right) setTask(nextTask(pool.length > 0 ? pool : phrases))
    }, right ? 700 : 900)
  }

  return (
    <Card className="p-4 sm:p-5">
      <Hud left={left} score={score} />
      <p className="text-center text-sm text-ink-muted">{t.buildPrompt}</p>
      <p className="mt-1 text-center text-lg font-black text-ink">{task.phrase.uz}</p>

      <div
        className={cx(
          'mt-4 flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3',
          result === 'right' ? 'border-milestone bg-milestone-soft' : result === 'wrong' ? 'border-danger bg-danger-soft' : 'border-hairline bg-ground-sunken',
        )}
      >
        {placed.map((tile, position) => (
          <button
            key={`${tile}-${position}`}
            type="button"
            disabled={result !== null}
            onClick={() => setPlaced((current) => current.filter((_, index) => index !== position))}
            className="raised raised-sm rounded-xl border border-hairline bg-ground-raised px-3 py-2 text-base font-black text-ink"
          >
            <RussianText text={task.tiles[tile]} />
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {task.tiles.map((word, tile) => (
          <button
            key={`${word}-${tile}`}
            type="button"
            disabled={placed.includes(tile) || result !== null}
            onClick={() => tap(tile)}
            className="raised raised-sm rounded-xl border-2 border-hairline bg-ground-raised px-3 py-2 text-base font-black text-ink hover:border-signal disabled:opacity-30"
          >
            <RussianText text={word} />
          </button>
        ))}
      </div>
    </Card>
  )
}

function nextTask(phrases: Phrase[]) {
  const phrase = phrases[Math.floor(Math.random() * phrases.length)]
  const words = phrase.ru.trim().split(/\s+/u)
  let tiles = shuffle(words)
  // Handed back already in order, there would be nothing to build.
  if (words.length > 1 && tiles.join(' ') === words.join(' ')) tiles = [...words].reverse()
  return { phrase, words, tiles }
}

const PAIRS = 6

/** Twelve cards face down: a word and its meaning make a pair. Fewer turns, more points. */
function MemoryPairs({ words, onOver }: { words: Vocab[]; onOver: (score: number) => void }) {
  const t = useT().arcade.classroom
  const cards = useMemo(() => {
    const chosen = shuffle(words.filter((word, index, all) => all.findIndex((other) => other.ru === word.ru) === index)).slice(0, PAIRS)
    return shuffle(chosen.flatMap((word, pair) => [
      { pair, text: word.ru, russian: true },
      { pair, text: word.uz, russian: false },
    ]))
  }, [words])
  const [open, setOpen] = useState<number[]>([])
  const [found, setFound] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const pairs = cards.length / 2

  function flip(index: number) {
    if (open.length === 2 || open.includes(index) || found.includes(cards[index].pair)) return
    const next = [...open, index]
    setOpen(next)
    if (next.length < 2) return

    const turn = moves + 1
    setMoves(turn)
    const match = cards[next[0]].pair === cards[next[1]].pair
    playUiSound(match ? 'correct' : 'wrong')
    window.setTimeout(() => {
      setOpen([])
      if (!match) return
      const all = [...found, cards[next[0]].pair]
      setFound(all)
      // Every pair in as many turns as there are pairs is the full score; each extra turn costs.
      if (all.length === pairs) onOver(Math.max(POINTS, pairs * POINTS * 2 - (turn - pairs) * 5))
    }, match ? 500 : 900)
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm font-black">
        <span className="text-ink-muted">{t.memoryPrompt}</span>
        <span className="shrink-0 tabular-nums text-ink">{fill(t.moves, { count: moves })}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cards.map((card, index) => {
          const matched = found.includes(card.pair)
          const shown = matched || open.includes(index)
          return (
            <button
              key={index}
              type="button"
              onClick={() => flip(index)}
              disabled={matched}
              aria-label={shown ? card.text : t.card}
              className={cx(
                'raised raised-sm flex min-h-20 items-center justify-center rounded-2xl border-2 p-2 text-center text-sm font-black leading-tight',
                matched
                  ? 'border-milestone bg-milestone-soft text-milestone'
                  : shown
                    ? 'border-signal bg-signal-soft text-ink'
                    : 'border-hairline bg-ground-sunken text-transparent',
              )}
            >
              {shown ? (card.russian ? <RussianText text={card.text} /> : card.text) : '?'}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
