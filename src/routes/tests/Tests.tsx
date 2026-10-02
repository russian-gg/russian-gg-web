import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, ErrorNote, LinkButton, QueryError, Spinner } from '../../components/ui'
import { Reveal, Sequence } from '../../components/motion'
import { fill, useT } from '../../lib/i18n'
import { stagger } from '../../lib/motion'
import { testQueryKeys, testsApi, type TestListItem } from '../../lib/tests'

/**
 * The Tests tab: every test the learner can sit, in the order they were made. Each one is sat
 * on its own — its questions only, shuffled every time — and as often as the learner likes, so
 * a card shows the last and the best result and one button that starts a sitting, picks an
 * unfinished one back up, or starts it over. The server decides which of the first two it is,
 * so a second tab or a second tap never leaves two sittings of one test open.
 */
export function Tests() {
  const dictionary = useT()
  const t = dictionary.tests
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: testQueryKeys.list,
    queryFn: testsApi.list,
  })

  const start = useMutation({
    mutationFn: (test: TestListItem) => testsApi.start(test.id),
    onSuccess: (block) => {
      queryClient.setQueryData(testQueryKeys.block(block.id), block)
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.list })
      navigate(`/tests/blocks/${block.id}`)
    },
    // The test was switched off or emptied since the list was loaded: show what is there now.
    onError: () => void refetch(),
  })

  // Nothing to take: the menu shows the tab as "coming soon", and a typed or bookmarked address
  // lands back on the home screen instead of an empty one.
  if (data && data.length === 0) return <Navigate to="/home" replace />

  return (
    <Sequence className="space-y-8" gap={stagger.base}>
      <Reveal>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.title}</h1>
        <p className="text-support mt-1">{t.subtitle}</p>
      </Reveal>

      {isLoading && <Spinner />}
      {isError && <QueryError onRetry={() => void refetch()} />}
      {start.isError && <ErrorNote>{t.unavailable}</ErrorNote>}

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((test, index) => (
            <Reveal key={test.id}>
              <TestCard
                test={test}
                number={index + 1}
                busy={start.isPending}
                onStart={() => start.mutate(test)}
              />
            </Reveal>
          ))}
        </div>
      )}
    </Sequence>
  )
}

function TestCard({
  test,
  number,
  busy,
  onStart,
}: {
  test: TestListItem
  number: number
  busy: boolean
  onStart: () => void
}) {
  const t = useT().tests

  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ground-sunken text-sm font-black text-ink-muted tabular-nums">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-snug font-extrabold text-ink">{test.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{t.difficulties[test.difficulty]}</Badge>
            <span className="text-sm text-ink-muted">{fill(t.questionCount, { count: test.questionCount })}</span>
          </div>
        </div>
      </div>

      <p className="text-sm font-bold text-ink-muted">
        {test.openBlockId ? (
          <span className="text-signal-ink">{t.inProgress}</span>
        ) : test.last && test.best ? (
          <>
            <span className="text-ink">
              {fill(t.lastScore, { correct: test.last.correctCount, total: test.last.totalCount })}
            </span>
            <span aria-hidden="true"> · </span>
            {fill(t.bestScore, { correct: test.best.correctCount, total: test.best.totalCount })}
          </>
        ) : (
          t.notTaken
        )}
      </p>

      <div className="mt-auto flex flex-col gap-2 sm:flex-row">
        <Button block onClick={onStart} disabled={busy}>
          {test.openBlockId ? t.continue : test.last ? t.retake : t.start}
        </Button>
        {test.last && (
          <LinkButton to={`/tests/blocks/${test.last.blockId}/review`} variant="secondary" block>
            {t.lastResults}
          </LinkButton>
        )}
      </div>
    </Card>
  )
}
