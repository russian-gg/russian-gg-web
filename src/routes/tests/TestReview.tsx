import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronLeft, CircleCheck, CircleDashed, CircleX, RotateCcw } from 'lucide-react'
import { FilterPills, StatTile } from '../../components/Catalog'
import { ColorScopeProvider, RussianText } from '../../components/RussianText'
import { Badge, Button, Card, LinkButton, QueryError, Spinner } from '../../components/ui'
import { Reveal, Sequence, SequenceInView } from '../../components/motion'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { rise, stagger } from '../../lib/motion'
import {
  testOptionState,
  testQueryKeys,
  testsApi,
  useLearnerDay,
  type TestDifficulty,
  type TestReviewItem,
} from '../../lib/tests'
import { ResultRing } from './ResultRing'
import { StartTestDialog, type StartTestTarget } from './StartTestDialog'
import { TestOption } from './TestOption'

type Outcome = 'correct' | 'wrong' | 'skipped'
type OutcomeFilter = 'all' | Outcome

const DIFFICULTY_TONE: Record<TestDifficulty, 'milestone' | 'signal' | 'caution'> = {
  Easy: 'milestone',
  Medium: 'signal',
  Hard: 'caution',
}

/** How a question went: answered right, answered wrong, or closed by the clock with no answer. */
function outcomeOf(item: TestReviewItem): Outcome {
  if (item.chosenOptionIndex === undefined) return 'skipped'
  return item.isCorrect ? 'correct' : 'wrong'
}

/**
 * The "Itoglar" screen after the last answer of a sitting. On top, the result as a ring and
 * three counts — right, wrong, unanswered. Below, every question as the learner left it: all
 * of its options, with the one they chose and the right one marked, and the rule. Wrong
 * answers are the point of the screen, so the pills can narrow the list down to just those.
 */
export function TestReview() {
  const { blockId = '' } = useParams()
  const t = useT().tests
  const [retaking, setRetaking] = useState<StartTestTarget | null>(null)
  const [filter, setFilter] = useState<OutcomeFilter>('all')
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: testQueryKeys.review(blockId),
    queryFn: () => testsApi.review(blockId),
    enabled: blockId !== '',
  })

  if (!blockId) return <Navigate to="/tests" replace />
  if (isLoading) return <Spinner />
  if (isError || !data) return <QueryError onRetry={() => void refetch()} />

  const counts = {
    all: data.items.length,
    correct: data.items.filter((item) => outcomeOf(item) === 'correct').length,
    wrong: data.items.filter((item) => outcomeOf(item) === 'wrong').length,
    skipped: data.items.filter((item) => outcomeOf(item) === 'skipped').length,
  }
  const percent = data.totalCount > 0 ? Math.round((data.correctCount / data.totalCount) * 100) : 0
  const difficulty = data.items[0]?.difficulty
  const visible = data.items.filter((item) => filter === 'all' || outcomeOf(item) === filter)

  return (
    <Sequence className="mx-auto max-w-3xl space-y-6" gap={stagger.base}>
      <Reveal>
        <Link
          to="/tests"
          className="inline-flex items-center gap-1 text-sm font-bold text-ink-muted transition-colors hover:text-ink"
        >
          <ChevronLeft aria-hidden="true" strokeWidth={2.4} className="size-4" />
          {t.backToTests}
        </Link>
      </Reveal>

      <Reveal variants={rise}>
        <Card className="flex flex-col items-center gap-6 sm:flex-row">
          <ResultRing percent={percent} label={t.reviewTitle} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-black tracking-[.12em] text-signal-ink uppercase">{t.reviewTitle}</p>
            <h1 className="mt-1 text-2xl leading-snug font-extrabold tracking-tight wrap-break-word text-ink">
              {data.testTitle || t.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {difficulty && <Badge tone={DIFFICULTY_TONE[difficulty]}>{t.difficulties[difficulty]}</Badge>}
              <span className="text-base font-bold text-ink-muted">
                {fill(t.score, { correct: data.correctCount, total: data.totalCount })}
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              {/* A sitting from before tests were sat one at a time has no single test to retake. */}
              {data.testId && (
                <Button
                  onClick={() =>
                    // The same test again, through the same dialog: a new sitting, shuffled afresh.
                    setRetaking({
                      id: data.testId!,
                      title: data.testTitle,
                      difficulty: difficulty ?? 'Easy',
                      questionCount: data.totalCount,
                    })
                  }
                >
                  <RotateCcw aria-hidden="true" strokeWidth={2.4} className="size-4" />
                  {t.retake}
                </Button>
              )}
              <LinkButton to="/tests" variant="secondary" size="md">
                {t.backToTests}
              </LinkButton>
            </div>
          </div>
        </Card>
      </Reveal>

      <Sequence className="grid grid-cols-1 gap-3 sm:grid-cols-3" gap={stagger.base}>
        <StatTile
          icon={CircleCheck}
          label={t.resultCorrect}
          value={counts.correct}
          markClassName="bg-milestone-soft text-milestone"
          valueClassName="text-milestone"
        />
        <StatTile
          icon={CircleX}
          label={t.resultWrong}
          value={counts.wrong}
          markClassName="bg-danger-soft text-danger"
          valueClassName="text-danger"
        />
        <StatTile
          icon={CircleDashed}
          label={t.resultSkipped}
          value={counts.skipped}
          markClassName="bg-ground-sunken text-ink-muted"
          valueClassName="text-ink-muted"
        />
      </Sequence>

      <Reveal>
        <FilterPills
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t.filterAll, count: counts.all },
            { value: 'wrong', label: t.resultWrong, count: counts.wrong },
            { value: 'correct', label: t.resultCorrect, count: counts.correct },
            // Only worth a pill when the clock actually closed something.
            ...(counts.skipped > 0 ? [{ value: 'skipped' as const, label: t.resultSkipped, count: counts.skipped }] : []),
          ]}
        />
      </Reveal>

      {visible.length === 0 && (
        <Card className="py-10 text-center text-sm font-semibold text-ink-muted">{t.noResults}</Card>
      )}

      {/* Keyed by the filter, so narrowing the list replays the arrival of what is left. */}
      {visible.length > 0 && (
        <SequenceInView key={filter} className="space-y-4" gap={stagger.base}>
          {visible.map((item) => (
            <Reveal key={item.id} variants={rise}>
              <ReviewCard item={item} />
            </Reveal>
          ))}
        </SequenceInView>
      )}

      <StartTestDialog test={retaking} onDismiss={() => setRetaking(null)} />
    </Sequence>
  )
}

const OUTCOME_STYLE: Record<Outcome, { border: string; mark: string }> = {
  correct: { border: 'border-milestone/50', mark: 'bg-milestone-soft text-milestone' },
  wrong: { border: 'border-danger/50', mark: 'bg-danger-soft text-danger' },
  skipped: { border: 'border-hairline', mark: 'bg-ground-sunken text-ink-muted' },
}

function ReviewCard({ item }: { item: TestReviewItem }) {
  const t = useT().tests
  const learnerDay = useLearnerDay()
  const outcome = outcomeOf(item)
  const style = OUTCOME_STYLE[outcome]
  const outcomeLabel = { correct: t.resultCorrect, wrong: t.resultWrong, skipped: t.notAnswered }[outcome]

  return (
    <Card className={cx('space-y-4', style.border)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx('flex size-9 items-center justify-center rounded-xl text-sm font-black tabular-nums', style.mark)}>
          {item.order + 1}
        </span>
        <Badge tone="signal">{t.categories[item.category]}</Badge>
        <span className={cx('ml-auto rounded-full px-3 py-1 text-xs font-extrabold', style.mark)}>{outcomeLabel}</span>
      </div>

      <ColorScopeProvider day={learnerDay}>
        <h2 className="text-lg leading-snug font-black text-ink" lang="ru">
          <RussianText text={item.text} />
        </h2>

        {/* Every option as the sitting showed them, so the wrong choice is seen beside the right one. */}
        <div className="grid gap-2">
          {item.options.map((option, optionIndex) => (
            <TestOption key={optionIndex} index={optionIndex} text={option} state={testOptionState(item, optionIndex)} />
          ))}
        </div>
      </ColorScopeProvider>

      <p className="rounded-2xl bg-ground-sunken px-4 py-3 text-sm text-ink">
        <span className="font-bold">{t.rule}: </span>
        {item.explanation}
      </p>
    </Card>
  )
}
