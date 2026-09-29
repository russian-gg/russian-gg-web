import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ColorScopeProvider, RussianText } from '../../components/RussianText'
import { Badge, Button, Card, LinkButton, QueryError, Spinner } from '../../components/ui'
import { Reveal, Sequence } from '../../components/motion'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { stagger } from '../../lib/motion'
import { testQueryKeys, testsApi, type TestReviewItem } from '../../lib/tests'

/**
 * The "Itoglar" screen after the ninth answer: the score, then every question with what the
 * learner chose, the right answer and the rule. Wrong answers are the point of the screen, so
 * each one shows both options side by side rather than only the correct one.
 */
export function TestReview() {
  const { blockId = '' } = useParams()
  const t = useT().tests
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: testQueryKeys.review(blockId),
    queryFn: () => testsApi.review(blockId),
    enabled: blockId !== '',
  })

  const again = useMutation({
    mutationFn: testsApi.start,
    onSuccess: (block) => {
      queryClient.setQueryData(testQueryKeys.block(block.id), block)
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.summary })
      navigate(`/tests/blocks/${block.id}`)
    },
  })

  if (!blockId) return <Navigate to="/tests" replace />
  if (isLoading) return <Spinner />
  if (isError || !data) return <QueryError onRetry={() => void refetch()} />

  return (
    <Sequence className="mx-auto max-w-2xl space-y-6" gap={stagger.base}>
      <Reveal>
        <Card className="text-center">
          <p className="text-sm font-bold text-ink-muted">{t.reviewTitle}</p>
          <p className="mt-2 text-5xl font-black text-ink tabular-nums">
            {data.correctCount}/{data.totalCount}
          </p>
          <p className="text-support mt-1">{fill(t.score, { correct: data.correctCount, total: data.totalCount })}</p>
        </Card>
      </Reveal>

      {data.items.map((item) => (
        <Reveal key={item.id}>
          <ReviewCard item={item} />
        </Reveal>
      ))}

      <Reveal className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" block onClick={() => again.mutate()} disabled={again.isPending}>
          {t.newBlock}
        </Button>
        <LinkButton to="/tests" variant="secondary" block>
          {t.backToTests}
        </LinkButton>
      </Reveal>
    </Sequence>
  )
}

function ReviewCard({ item }: { item: TestReviewItem }) {
  const t = useT().tests
  const chosen = item.chosenOptionIndex

  return (
    <Card className={cx('space-y-4', item.isCorrect ? 'border-milestone' : 'border-danger')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-ground-sunken text-sm font-black text-ink-muted">
          {item.order + 1}
        </span>
        <Badge tone="signal">{t.categories[item.category]}</Badge>
        <Badge>{t.difficulties[item.difficulty]}</Badge>
      </div>

      <ColorScopeProvider day={item.courseDay}>
        <h2 className="text-lg leading-snug font-black text-ink" lang="ru">
          <RussianText text={item.text} />
        </h2>
      </ColorScopeProvider>

      <dl className="grid gap-2 text-sm">
        <div
          className={cx(
            'rounded-xl border-2 px-4 py-3',
            item.isCorrect ? 'border-milestone bg-milestone-soft' : 'border-danger bg-danger-soft',
          )}
        >
          <dt className="text-xs font-bold text-ink-muted">{t.yourAnswer}</dt>
          <dd className="mt-0.5 font-bold text-ink" lang={chosen === undefined ? undefined : 'ru'}>
            {chosen === undefined ? t.notAnswered : item.options[chosen]}
          </dd>
        </div>
        {!item.isCorrect && (
          <div className="rounded-xl border-2 border-milestone px-4 py-3">
            <dt className="text-xs font-bold text-ink-muted">{t.correctAnswer}</dt>
            <dd className="mt-0.5 font-bold text-ink" lang="ru">
              {item.options[item.correctOptionIndex]}
            </dd>
          </div>
        )}
      </dl>

      <p className="text-sm text-ink">
        <span className="font-bold">{t.rule}: </span>
        {item.explanation}
      </p>
    </Card>
  )
}
