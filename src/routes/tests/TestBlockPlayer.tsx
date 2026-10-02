import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Celebration } from '../../components/Celebration'
import { ColorScopeProvider, RussianText } from '../../components/RussianText'
import { Badge, Button, Card, ErrorNote, ProgressBar, QueryError, Spinner } from '../../components/ui'
import { RequestError } from '../../lib/api'
import { celebrate } from '../../lib/celebrate'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { playUiSound } from '../../lib/ui-sounds'
import {
  LEARNED_STREAK,
  testQueryKeys,
  testsApi,
  type TestAnswerResult,
  type TestBlock,
  type TestBlockItem,
  useLearnerDay,
} from '../../lib/tests'

/**
 * One block, one question at a time. The answer is scored on the server, so the right option
 * is only known — and only lit green — after the learner commits. A refresh lands on the first
 * unanswered question, because the block and its answers live on the server.
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

  // Which question is on screen. Null until the block arrives, then the first unanswered one.
  const [index, setIndex] = useState<number | null>(null)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    if (!block || index !== null) return
    const first = block.items.findIndex((item) => !item.answer)
    setIndex(first === -1 ? block.items.length - 1 : first)
  }, [block, index])

  const answer = useMutation({
    mutationFn: ({ item, option }: { item: TestBlockItem; option: number }) =>
      testsApi.answer(blockId, item.id, option),
    onSuccess: (result, { item }) => {
      // Written into the cached block so going back and forth, or a remount, keeps the answer.
      queryClient.setQueryData<TestBlock>(testQueryKeys.block(blockId), (current) =>
        current && {
          ...current,
          completedAt: result.blockCompleted ? new Date().toISOString() : current.completedAt,
          items: current.items.map((candidate) => (candidate.id === item.id ? { ...candidate, answer: result } : candidate)),
        },
      )
      if (result.isCorrect) {
        celebrate()
        setBurst((value) => value + 1)
      } else {
        playUiSound('wrong')
      }
      if (result.blockCompleted) void queryClient.invalidateQueries({ queryKey: testQueryKeys.summary })
    },
    onError: (error) => {
      // Answered in another tab: the server has the answer, so show that instead.
      if (error instanceof RequestError && error.code === 'test_item_already_answered') void refetch()
    },
  })

  if (!blockId) return <Navigate to="/tests" replace />
  if (isLoading) return <Spinner />
  if (isError || !block) return <QueryError onRetry={() => void refetch()} />
  if (index === null) return <Spinner />

  const item = block.items[index]
  const result = item.answer
  const answered = block.items.filter((candidate) => candidate.answer).length
  const isLast = index === block.items.length - 1
  const completed = block.items.every((candidate) => candidate.answer)

  function goNext() {
    // The last question's confetti belongs to it; the next one starts on a clear screen.
    setBurst(0)
    if (completed) {
      navigate(`/tests/blocks/${blockId}/review`)
      return
    }
    // The next unanswered question after this one, wrapping round to any skipped earlier.
    const after = block!.items.findIndex((candidate, i) => i > index! && !candidate.answer)
    const any = block!.items.findIndex((candidate) => !candidate.answer)
    setIndex(after !== -1 ? after : any)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {burst > 0 && <Celebration key={burst} />}

      <div>
        <div className="flex items-baseline justify-between gap-3 text-sm font-bold">
          <span className="text-ink">{fill(t.questionOf, { current: index + 1, total: block.items.length })}</span>
          <span className="text-ink-faint tabular-nums">
            {answered}/{block.items.length}
          </span>
        </div>
        <div className="mt-2">
          <ProgressBar value={answered} max={block.items.length} label={t.title} />
        </div>
      </div>

      <Card className={cx('space-y-5', result && (result.isCorrect ? 'border-milestone' : 'border-danger'))}>
        <div className="flex flex-wrap gap-2">
          <Badge tone="signal">{t.categories[item.category]}</Badge>
          <Badge>{t.difficulties[item.difficulty]}</Badge>
        </div>

        {/*
          Coloured only as far as the learner's own day has taught — the same rule the lesson
          player follows, so a test never paints a case the learner has not met yet.
        */}
        <ColorScopeProvider day={learnerDay}>
          <h1 className="text-xl leading-snug font-black text-ink sm:text-2xl" lang="ru">
            <RussianText text={item.text} />
          </h1>

          <div className="grid gap-2" role="group" aria-label={item.text}>
            {item.options.map((option, optionIndex) => (
              <OptionButton
                key={optionIndex}
                option={option}
                state={optionState(result, optionIndex)}
                disabled={Boolean(result) || answer.isPending}
                onClick={() => answer.mutate({ item, option: optionIndex })}
              />
            ))}
          </div>
        </ColorScopeProvider>

        {answer.isError && !(answer.error instanceof RequestError && answer.error.code === 'test_item_already_answered') && (
          <ErrorNote>{dictionary.common.loadFailed}</ErrorNote>
        )}

        {result && <AnswerNote result={result} />}
      </Card>

      {result && (
        <Button size="lg" block onClick={goNext}>
          {completed || isLast ? t.seeResults : t.next}
        </Button>
      )}
    </div>
  )
}

type OptionState = 'idle' | 'correct' | 'wrong' | 'missed'

function optionState(result: TestAnswerResult | undefined, optionIndex: number): OptionState {
  if (!result) return 'idle'
  if (optionIndex === result.correctOptionIndex) return result.chosenOptionIndex === optionIndex ? 'correct' : 'missed'
  return optionIndex === result.chosenOptionIndex ? 'wrong' : 'idle'
}

function OptionButton({
  option,
  state,
  disabled,
  onClick,
}: {
  option: string
  state: OptionState
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      lang="ru"
      className={cx(
        'rounded-xl border-2 px-4 py-3 text-left text-base font-bold transition',
        state === 'correct' && 'border-milestone bg-milestone-soft',
        // The right answer the learner did not pick is outlined, not filled: it is information, not praise.
        state === 'missed' && 'border-milestone',
        state === 'wrong' && 'border-danger bg-danger-soft',
        state === 'idle' && 'border-hairline bg-ground-raised',
        !disabled && 'hover:border-signal',
      )}
    >
      <RussianText text={option} />
    </button>
  )
}

function AnswerNote({ result }: { result: TestAnswerResult }) {
  const t = useT().tests
  const streak = result.correctStreak ?? 0
  const learned = streak >= LEARNED_STREAK

  return (
    <div
      role="status"
      className={cx('space-y-2 rounded-xl p-4 text-sm', result.isCorrect ? 'bg-milestone-soft' : 'bg-danger-soft')}
    >
      <p className={cx('font-extrabold', result.isCorrect ? 'text-milestone' : 'text-danger')}>
        {result.isCorrect ? t.correct : t.wrong}
        {result.isCorrect && streak > 1 && (
          <span className="ml-2 font-bold">
            · {learned ? t.learnedNow : fill(t.streak, { count: streak })}
          </span>
        )}
      </p>
      <p className="text-ink">
        <span className="font-bold">{t.rule}: </span>
        {result.explanation}
      </p>
    </div>
  )
}
