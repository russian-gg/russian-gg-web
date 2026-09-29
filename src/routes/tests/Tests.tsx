import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorNote, ProgressBar, QueryError, Spinner } from '../../components/ui'
import { Reveal, Sequence } from '../../components/motion'
import { RequestError } from '../../lib/api'
import { fill, useT } from '../../lib/i18n'
import { stagger } from '../../lib/motion'
import { testQueryKeys, testsApi } from '../../lib/tests'

/**
 * The Tests tab: how much of the bank the learner has learned, and one button that starts a
 * block or picks the unfinished one back up. The server decides which it is, so a second tab
 * or a second tap never leaves two blocks open.
 */
export function Tests() {
  const dictionary = useT()
  const t = dictionary.tests
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: testQueryKeys.summary,
    queryFn: testsApi.summary,
  })

  const start = useMutation({
    mutationFn: testsApi.start,
    onSuccess: (block) => {
      queryClient.setQueryData(testQueryKeys.block(block.id), block)
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.summary })
      navigate(`/tests/blocks/${block.id}`)
    },
  })

  return (
    <Sequence className="space-y-8" gap={stagger.base}>
      <Reveal>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.title}</h1>
        <p className="text-support mt-1">{t.subtitle}</p>
      </Reveal>

      {isLoading && <Spinner />}
      {isError && <QueryError onRetry={() => void refetch()} />}

      {data && data.availableQuestions === 0 && <EmptyState title={t.emptyTitle} body={t.emptyBody} />}

      {data && data.availableQuestions > 0 && (
        <Reveal>
          <Card className="space-y-5">
            <div>
              <h2 className="text-lg font-extrabold text-ink">{t.blockTitle}</h2>
              <p className="text-support mt-1">{t.blockBody}</p>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3 text-sm font-bold">
                <span className="text-ink">
                  {fill(t.learned, { learned: data.learnedQuestions, total: data.availableQuestions })}
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar value={data.learnedQuestions} max={data.availableQuestions} label={t.title} />
              </div>
              <p className="mt-2 text-xs text-ink-muted">{t.learnedHint}</p>
              <p className="mt-1 text-xs text-ink-muted">{data.maxDay === 1 ? t.daysNoteFirst : fill(t.daysNote, { day: data.maxDay })}</p>
            </div>

            {start.isError && (
              <ErrorNote>
                {start.error instanceof RequestError && start.error.code === 'tests_unavailable'
                  ? t.unavailable
                  : dictionary.common.loadFailed}
              </ErrorNote>
            )}

            <Button size="lg" block onClick={() => start.mutate()} disabled={start.isPending}>
              {data.openBlockId ? t.continue : t.start}
            </Button>
          </Card>
        </Reveal>
      )}
    </Sequence>
  )
}
