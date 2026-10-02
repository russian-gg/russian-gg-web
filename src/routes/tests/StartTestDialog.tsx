import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PreviewDialog, PreviewFact } from '../../components/PreviewDialog'
import { ErrorNote, Switch } from '../../components/ui'
import { fill, useT } from '../../lib/i18n'
import { SECONDS_PER_QUESTION, testQueryKeys, testsApi, type TestBlock, type TestDifficulty } from '../../lib/tests'

/** What the dialog needs to know about the test it is about to start. */
export type StartTestTarget = {
  id: string
  title: string
  difficulty: TestDifficulty
  questionCount: number
  /** The learner's unfinished sitting of this test, when there is one and it has been loaded. */
  openBlock?: TestBlock
  /** True when there is an unfinished sitting, loaded or not. */
  hasOpenBlock?: boolean
}

/**
 * What stands between a test card and the first question: what the test is, how long each
 * question gets, and the one choice the learner makes — whether to see the right answer after
 * each question or only at the end. The choice belongs to the sitting, so a sitting that is
 * being resumed shows the one it was started with instead of asking again.
 */
export function StartTestDialog({ test, onDismiss }: { test: StartTestTarget | null; onDismiss: () => void }) {
  const dictionary = useT()
  const t = dictionary.tests
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [answerAfterEach, setAnswerAfterEach] = useState(true)

  const start = useMutation({
    mutationFn: (target: StartTestTarget) => testsApi.start(target.id, !answerAfterEach),
    onSuccess: (block) => {
      queryClient.setQueryData(testQueryKeys.block(block.id), block)
      void queryClient.invalidateQueries({ queryKey: testQueryKeys.list })
      navigate(`/tests/blocks/${block.id}`)
    },
    // The test was switched off or emptied since the list was loaded: show what is there now.
    onError: () => void queryClient.invalidateQueries({ queryKey: testQueryKeys.list }),
  })

  const resuming = Boolean(test?.hasOpenBlock || test?.openBlock)
  const open = test?.openBlock
  // A resumed sitting keeps the mode it was started with; the switch shows it but cannot change it.
  const afterEach = open ? !open.showAnswersAtEnd : answerAfterEach
  const seconds = open?.secondsPerQuestion ?? SECONDS_PER_QUESTION

  function dismiss() {
    start.reset()
    onDismiss()
  }

  return (
    <PreviewDialog
      open={test !== null}
      eyebrow={t.title}
      title={test?.title ?? ''}
      closeLabel={dictionary.common.close}
      primaryLabel={resuming ? t.continue : t.start}
      primaryDisabled={start.isPending}
      onPrimary={() => test && start.mutate(test)}
      onDismiss={dismiss}
    >
      {test && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <PreviewFact label={t.factQuestions} value={String(test.questionCount)} />
            <PreviewFact label={t.factLevel} value={t.difficulties[test.difficulty]} />
            <PreviewFact label={t.factTime} value={fill(t.secondsValue, { seconds })} />
          </div>

          <p className="text-sm text-ink-muted">{t.timeoutNote}</p>

          {resuming && open && (
            <p className="rounded-2xl bg-caution-soft px-4 py-3 text-sm font-semibold text-caution">
              {fill(t.resumeNote, {
                answered: open.items.filter((item) => item.answer).length,
                total: open.items.length,
              })}
            </p>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={afterEach}
            disabled={resuming}
            onClick={() => setAnswerAfterEach((value) => !value)}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-hairline px-4 py-3 text-left transition-colors hover:border-signal/50 disabled:cursor-default disabled:opacity-70 disabled:hover:border-hairline"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-ink">{t.answerModeTitle}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">{afterEach ? t.answerModeEach : t.answerModeEnd}</span>
            </span>
            <Switch checked={afterEach} />
          </button>

          {start.isError && <ErrorNote>{t.unavailable}</ErrorNote>}
        </>
      )}
    </PreviewDialog>
  )
}
