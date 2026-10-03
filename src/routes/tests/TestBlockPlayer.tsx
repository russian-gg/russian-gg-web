import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Timer, X } from 'lucide-react'
import { Celebration } from '../../components/Celebration'
import { Meter, Reveal } from '../../components/motion'
import { ColorScopeProvider, RussianText } from '../../components/RussianText'
import { Badge, Button, Card, ErrorNote, QueryError, Spinner } from '../../components/ui'
import { RequestError } from '../../lib/api'
import { celebrate } from '../../lib/celebrate'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { rise } from '../../lib/motion'
import { playUiSound } from '../../lib/ui-sounds'
import {
  testOptionState,
  testQueryKeys,
  testsApi,
  type TestAnswerResult,
  type TestBlock,
  type TestBlockItem,
  type TestDifficulty,
  useLearnerDay,
} from '../../lib/tests'
import { TestOption } from './TestOption'

/** How often the countdown redraws. Short enough for the bar to glide, long enough to be cheap. */
const TICK_MS = 100

/**
 * One sitting of one test, a question at a time, in the order the server shuffled for this
 * sitting. Back and Next move freely between questions; a question is closed once it is
 * answered or its time runs out, and cannot be answered again.
 *
 * The card at the top carries the test, how far along the sitting is, and a strip of numbered
 * dots — one per question, coloured by how it stands — that is also a way straight to any of
 * them.
 *
 * Each question has its own clock (the sitting says how long — a minute). It only runs while
 * that question is on screen and open, so stepping back to look at an earlier question does
 * not cost the next one its time. The time left is kept in session storage, so a refresh does
 * not hand out a fresh minute. When it runs out the question is closed unanswered.
 *
 * The answer is scored on the server. In a sitting that shows answers after each question the
 * right option lights up and the rule appears as soon as the learner commits; in one that
 * shows them at the end, the learner only sees what they chose until the last question closes.
 */
export function TestBlockPlayer() {
  const { blockId = '' } = useParams()
  const dictionary = useT()
  const t = dictionary.tests
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const learnerDay = useLearnerDay()
  const { data: block, isLoading, isError, refetch } = useQuery({
    queryKey: testQueryKeys.block(blockId),
    queryFn: () => testsApi.block(blockId),
    enabled: blockId !== '',
  })

  // Which question is on screen. Null until the block arrives, then the first open one.
  const [index, setIndex] = useState<number | null>(null)
  const [burst, setBurst] = useState(0)
  const [timeLeft, setTimeLeft] = useState<Record<string, number>>(() => readTimers(blockId))

  useEffect(() => {
    if (!block || index !== null) return
    const first = block.items.findIndex((item) => !item.answer)
    setIndex(first === -1 ? block.items.length - 1 : first)
  }, [block, index])

  const answer = useMutation({
    mutationFn: ({ item, option }: { item: TestBlockItem; option: number | null }) =>
      testsApi.answer(blockId, item.id, option),
    onSuccess: (result, { item, option }) => {
      // Written into the cached block so going back and forth, or a remount, keeps the answer.
      queryClient.setQueryData<TestBlock>(testQueryKeys.block(blockId), (current) =>
        current && {
          ...current,
          completedAt: result.blockCompleted ? new Date().toISOString() : current.completedAt,
          items: current.items.map((candidate) => (candidate.id === item.id ? { ...candidate, answer: result } : candidate)),
        },
      )
      // Only celebrate or commiserate what the learner is allowed to know yet.
      if (result.isCorrect === true) {
        celebrate()
        setBurst((value) => value + 1)
      } else if (result.isCorrect === false && option !== null) {
        playUiSound('wrong')
      }
      if (result.blockCompleted) {
        clearTimers(blockId)
        void queryClient.invalidateQueries({ queryKey: testQueryKeys.list })
        // Answers kept back until now are told by the server once the sitting is finished.
        if (block?.showAnswersAtEnd) void refetch()
      }
    },
    onError: (error) => {
      // Closed in another tab: the server has the answer, so show that instead.
      if (error instanceof RequestError && error.code === 'test_item_already_answered') void refetch()
    },
  })

  const item = block && index !== null ? block.items[index] : undefined
  const limitMs = (block?.secondsPerQuestion ?? 60) * 1000
  const left = item ? (timeLeft[item.id] ?? limitMs) : limitMs
  const running = Boolean(item && !item.answer && !answer.isPending && left > 0)

  // The countdown: measured against the wall clock rather than counted in ticks, so a slow or
  // throttled tab still loses real time rather than getting it back.
  useEffect(() => {
    if (!running || !item) return
    let last = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const spent = now - last
      last = now
      setTimeLeft((state) => ({ ...state, [item.id]: Math.max(0, (state[item.id] ?? limitMs) - spent) }))
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [running, item, limitMs])

  // Kept once a second rather than every tick: enough that a refresh cannot buy time back.
  const leftSeconds = Math.ceil(left / 1000)
  useEffect(() => {
    if (blockId) writeTimers(blockId, timeLeft)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- written per second, not per tick
  }, [blockId, leftSeconds])

  // Out of time: the question is closed unanswered, once. A failed request is offered again by hand.
  const closedForTime = useRef(new Set<string>())
  useEffect(() => {
    if (!item || item.answer || left > 0 || answer.isPending) return
    if (closedForTime.current.has(item.id)) return
    closedForTime.current.add(item.id)
    answer.mutate({ item, option: null })
  }, [item, left, answer])

  if (!blockId) return <Navigate to="/tests" replace />
  if (isLoading) return <Spinner />
  if (isError || !block) return <QueryError onRetry={() => void refetch()} />
  if (index === null || !item) return <Spinner />

  const result = item.answer
  const answered = block.items.filter((candidate) => candidate.answer).length
  const completed = block.items.every((candidate) => candidate.answer)
  const isFirst = index === 0
  const isLast = index === block.items.length - 1
  // From the last question, Next goes back to whatever was skipped on the way.
  const firstOpen = block.items.findIndex((candidate) => !candidate.answer)
  const nextIndex = !isLast ? index + 1 : firstOpen !== -1 && firstOpen !== index ? firstOpen : null
  const outOfTime = !result && left <= 0

  function goTo(target: number) {
    // The last question's confetti belongs to it; the next one starts on a clear screen.
    setBurst(0)
    setIndex(target)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {burst > 0 && <Celebration key={burst} />}

      <Link
        to="/tests"
        className="inline-flex items-center gap-1 text-sm font-bold text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={2.4} className="size-4" />
        {t.backToTests}
      </Link>

      {/* The sitting at a glance: which test, how far along, and every question one tap away. */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl leading-snug font-extrabold tracking-tight wrap-break-word text-ink">
              {block.testTitle || t.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={DIFFICULTY_TONE[item.difficulty]}>{t.difficulties[item.difficulty]}</Badge>
              <span className="text-sm text-ink-muted">{block.showAnswersAtEnd ? t.answerModeEnd : t.answerModeEach}</span>
            </div>
          </div>
          <div className="shrink-0 rounded-2xl bg-signal-soft px-3.5 py-2.5 text-center">
            <p className="text-lg leading-none font-extrabold text-signal-ink tabular-nums">
              {answered}/{block.items.length}
            </p>
          </div>
        </div>

        <Meter
          value={answered}
          max={block.items.length}
          label={t.title}
          className="h-2.5 overflow-hidden rounded-full bg-ground-sunken"
          fillClassName="rounded-full bg-signal"
        />

        <nav aria-label={t.questionMap} className="flex flex-wrap gap-2">
          {block.items.map((candidate, candidateIndex) => (
            <QuestionDot
              key={candidate.id}
              number={candidateIndex + 1}
              label={fill(t.questionNumber, { number: candidateIndex + 1 })}
              state={dotState(candidate)}
              current={candidateIndex === index}
              onClick={() => goTo(candidateIndex)}
            />
          ))}
        </nav>
      </Card>

      {/* Keyed by the question, so stepping to another one arrives rather than swaps in place. */}
      <Reveal key={item.id} drive variants={rise}>
        <Card
          className={cx(
            'space-y-5 transition-colors duration-300',
            result?.isCorrect === true && 'border-milestone',
            result?.isCorrect === false && 'border-danger',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-extrabold tracking-wide text-ink-muted uppercase">
              {fill(t.questionOf, { current: index + 1, total: block.items.length })}
            </p>
            <Badge tone="signal">{t.categories[item.category]}</Badge>
          </div>

          {!result && <Countdown leftMs={left} limitMs={limitMs} label={t.timeLeft} />}

          {/*
            Coloured only as far as the learner's own day has taught — the same rule the lesson
            player follows, so a test never paints a case the learner has not met yet.
          */}
          <ColorScopeProvider day={learnerDay}>
            <h2 className="text-xl leading-snug font-black text-ink sm:text-2xl" lang="ru">
              <RussianText text={item.text} />
            </h2>

            <div className="grid gap-2.5" role="group" aria-label={item.text}>
              {item.options.map((option, optionIndex) => (
                <TestOption
                  key={optionIndex}
                  index={optionIndex}
                  text={option}
                  state={testOptionState(result, optionIndex)}
                  disabled={Boolean(result) || outOfTime || answer.isPending}
                  onClick={() => answer.mutate({ item, option: optionIndex })}
                />
              ))}
            </div>
          </ColorScopeProvider>

          {answer.isError && !(answer.error instanceof RequestError && answer.error.code === 'test_item_already_answered') && (
            <ErrorNote>
              {dictionary.common.loadFailed}
              {outOfTime && (
                <button
                  type="button"
                  className="ml-2 font-extrabold underline underline-offset-4"
                  onClick={() => answer.mutate({ item, option: null })}
                >
                  {dictionary.common.retry}
                </button>
              )}
            </ErrorNote>
          )}

          {result && <AnswerNote result={result} />}
        </Card>
      </Reveal>

      <div className="flex gap-3 pb-1">
        <Button variant="secondary" size="lg" className="flex-1" disabled={isFirst} onClick={() => goTo(index - 1)}>
          <ChevronLeft aria-hidden="true" strokeWidth={2.4} className="size-5" />
          {dictionary.common.back}
        </Button>
        {completed ? (
          <Button size="lg" className="flex-1" onClick={() => navigate(`/tests/blocks/${blockId}/review`)}>
            {t.seeResults}
            <ChevronRight aria-hidden="true" strokeWidth={2.4} className="size-5" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1"
            variant={result ? 'primary' : 'secondary'}
            disabled={nextIndex === null}
            onClick={() => nextIndex !== null && goTo(nextIndex)}
          >
            {t.next}
            <ChevronRight aria-hidden="true" strokeWidth={2.4} className="size-5" />
          </Button>
        )}
      </div>
    </div>
  )
}

const DIFFICULTY_TONE: Record<TestDifficulty, 'milestone' | 'signal' | 'caution'> = {
  Easy: 'milestone',
  Medium: 'signal',
  Hard: 'caution',
}

type DotState = 'open' | 'closed' | 'correct' | 'wrong'

/** A closed question shows how it went only once the sitting is allowed to say. */
function dotState(item: TestBlockItem): DotState {
  if (!item.answer) return 'open'
  if (item.answer.isCorrect === undefined) return 'closed'
  return item.answer.isCorrect ? 'correct' : 'wrong'
}

/**
 * One question in the strip under the title: its number, coloured by how it stands, and a
 * way straight to it. The one on screen wears a ring so the strip also says where you are.
 */
function QuestionDot({
  number,
  label,
  state,
  current,
  onClick,
}: {
  number: number
  label: string
  state: DotState
  current: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={current ? 'step' : undefined}
      className={cx(
        'flex size-9 items-center justify-center rounded-xl text-sm font-extrabold tabular-nums transition-[background-color,color,box-shadow,transform] duration-200',
        state === 'open' && 'bg-ground-sunken text-ink-muted hover:text-ink',
        state === 'closed' && 'bg-signal-soft text-signal-ink',
        state === 'correct' && 'bg-milestone-soft text-milestone',
        state === 'wrong' && 'bg-danger-soft text-danger',
        current && 'scale-110 ring-2 ring-signal ring-offset-2 ring-offset-ground-raised',
      )}
    >
      {number}
    </button>
  )
}

/**
 * The question's clock: a bar that drains as the time goes, green while there is plenty, then
 * orange, then red for the last stretch, with the seconds beside it. The width follows the
 * tick with a linear glide so it drains smoothly instead of stepping; the colour change gets
 * a slower fade of its own. Both are CSS transitions, so reduced motion stills them.
 */
function Countdown({ leftMs, limitMs, label }: { leftMs: number; limitMs: number; label: string }) {
  const share = limitMs > 0 ? Math.max(0, Math.min(1, leftMs / limitMs)) : 0
  const seconds = Math.ceil(leftMs / 1000)
  const tone = share > 0.5 ? 'calm' : share > 0.2 ? 'hurry' : 'urgent'

  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 transition-colors duration-500',
        tone === 'calm' && 'bg-milestone-soft',
        tone === 'hurry' && 'bg-caution-soft',
        tone === 'urgent' && 'bg-danger-soft',
      )}
    >
      <Timer
        aria-hidden="true"
        strokeWidth={2}
        className={cx(
          'size-5 shrink-0 transition-colors duration-500',
          tone === 'calm' && 'text-milestone',
          tone === 'hurry' && 'text-[#d98a0b]',
          tone === 'urgent' && 'text-danger',
          tone === 'urgent' && seconds > 0 && 'animate-pulse',
        )}
      />
      <div
        role="timer"
        aria-label={`${label}: ${seconds}`}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-ground-raised"
      >
        <div
          className={cx(
            'h-full rounded-full transition-[width,background-color] ease-linear',
            tone === 'calm' && 'bg-milestone',
            tone === 'hurry' && 'bg-[#f5a623]',
            tone === 'urgent' && 'bg-danger',
          )}
          style={{ width: `${share * 100}%`, transitionDuration: `${TICK_MS}ms, 500ms` }}
        />
      </div>
      <span
        className={cx(
          'w-10 text-right text-base font-extrabold tabular-nums transition-colors duration-500',
          tone === 'calm' && 'text-milestone',
          tone === 'hurry' && 'text-[#d98a0b]',
          tone === 'urgent' && 'text-danger',
        )}
      >
        {seconds}s
      </span>
    </div>
  )
}

function AnswerNote({ result }: { result: TestAnswerResult }) {
  const t = useT().tests
  const timedOut = result.chosenOptionIndex === undefined

  // Kept back until the end: say the question is closed, and when the answers will come.
  if (result.isCorrect === undefined) {
    return (
      <div role="status" className="flex animate-in items-start gap-3 rounded-2xl bg-ground-sunken p-4 text-sm fade-in-0 slide-in-from-bottom-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ground-raised text-ink-muted">
          {timedOut ? <Timer aria-hidden="true" className="size-5" /> : <Check aria-hidden="true" strokeWidth={2.6} className="size-5" />}
        </span>
        <div>
          <p className="font-extrabold text-ink">{timedOut ? t.timeUp : t.answerSaved}</p>
          <p className="mt-0.5 text-ink-muted">{t.answersAtEndNote}</p>
        </div>
      </div>
    )
  }

  const Icon = timedOut ? Timer : result.isCorrect ? Check : X

  return (
    <div
      role="status"
      className={cx(
        'flex animate-in items-start gap-3 rounded-2xl p-4 text-sm fade-in-0 slide-in-from-bottom-2',
        result.isCorrect ? 'bg-milestone-soft' : 'bg-danger-soft',
      )}
    >
      <span
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-xl text-white',
          result.isCorrect ? 'bg-milestone' : 'bg-danger',
        )}
      >
        <Icon aria-hidden="true" strokeWidth={2.6} className="size-5" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className={cx('font-extrabold', result.isCorrect ? 'text-milestone' : 'text-danger')}>
          {timedOut ? t.timeUp : result.isCorrect ? t.correct : t.wrong}
        </p>
        {result.explanation && (
          <p className="text-ink">
            <span className="font-bold">{t.rule}: </span>
            {result.explanation}
          </p>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- timers in storage */

const timersKey = (blockId: string) => `rgg.tests.timers.${blockId}`

/** Time left per question of a sitting, as last kept. Empty when storage is unavailable or holds nothing usable. */
function readTimers(blockId: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(timersKey(blockId)) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] >= 0),
    )
  } catch {
    return {}
  }
}

function writeTimers(blockId: string, timers: Record<string, number>) {
  try {
    sessionStorage.setItem(timersKey(blockId), JSON.stringify(timers))
  } catch {
    // Without storage a refresh restarts the clock; the sitting itself is unaffected.
  }
}

function clearTimers(blockId: string) {
  try {
    sessionStorage.removeItem(timersKey(blockId))
  } catch {
    // Nothing to clear.
  }
}
