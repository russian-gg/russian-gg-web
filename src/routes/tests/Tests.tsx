import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowDownUp,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  FileText,
  Timer,
} from 'lucide-react'
import { Badge, Button, Card, ErrorNote, QueryError, Spinner } from '../../components/ui'
import { FilterPills, SearchField, StatTile } from '../../components/Catalog'
import { Select } from '../../components/forms/Select'
import { CountUp, Meter, Reveal, Sequence, SequenceInView } from '../../components/motion'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { pop, rise, stagger } from '../../lib/motion'
import { testQueryKeys, testsApi, type TestBlock, type TestDifficulty, type TestListItem } from '../../lib/tests'

type TestStatus = 'completed' | 'inProgress' | 'notTaken'
type StatusFilter = 'all' | TestStatus
type SortOrder = 'newest' | 'oldest' | 'score'

/** A test as its card shows it: where the learner stands with it, and the score that says so. */
type TestRow = {
  test: TestListItem
  /** Its place in the server's list, which is the order the tests were made in. */
  index: number
  status: TestStatus
  correct: number
  total: number
  percent: number
}

/**
 * How each state is painted. One table, because the tile, the legend dot, the card's score box,
 * its bar and its status dot all have to agree, and five places that each pick their own green
 * are five places that drift.
 *
 * "In progress" has an orange of its own for the bar and the dots: the theme's caution colour
 * is a dark amber meant for text, and as a fill it reads as brown.
 */
const STATUS_STYLE: Record<TestStatus, { text: string; soft: string; fill: string; dot: string }> = {
  completed: { text: 'text-milestone', soft: 'bg-milestone-soft', fill: 'bg-milestone', dot: 'bg-milestone' },
  inProgress: { text: 'text-caution', soft: 'bg-caution-soft', fill: 'bg-[#f5a623]', dot: 'bg-[#f5a623]' },
  notTaken: { text: 'text-ink-muted', soft: 'bg-ground-sunken', fill: 'bg-signal', dot: 'bg-ink-faint' },
}

const STATUS_ICON = { completed: CircleCheck, inProgress: Timer, notTaken: CircleDashed } as const

const DIFFICULTY_TONE: Record<TestDifficulty, 'milestone' | 'signal' | 'caution'> = {
  Easy: 'milestone',
  Medium: 'signal',
  Hard: 'caution',
}

/**
 * The Tests tab: every test the learner can sit. Each one is sat on its own — its questions
 * only, shuffled every time — and as often as the learner likes, so a card shows where the
 * learner stands with it and one button that starts a sitting, picks an unfinished one back
 * up, or starts it over. The server decides which of the first two it is, so a second tab or a
 * second tap never leaves two sittings of one test open.
 *
 * Above the cards the same list is counted: how many tests there are, how many are behind the
 * learner, and what share of all their questions has been answered correctly.
 */
export function Tests() {
  const dictionary = useT()
  const t = dictionary.tests
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('newest')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: testQueryKeys.list,
    queryFn: testsApi.list,
  })

  /*
   * The list says a test has an unfinished sitting, but not how far into it the learner is.
   * The sitting itself does, and it is the same cached query the player reads, so opening the
   * test afterwards costs nothing more. There is at most one open sitting per test.
   */
  const openBlockIds = useMemo(
    () => (data ?? []).flatMap((test) => (test.openBlockId ? [test.openBlockId] : [])),
    [data],
  )
  const openBlocks = useQueries({
    queries: openBlockIds.map((blockId) => ({
      queryKey: testQueryKeys.block(blockId),
      queryFn: () => testsApi.block(blockId),
      staleTime: 30_000,
    })),
  })
  const blockById = new Map<string, TestBlock>()
  openBlocks.forEach((query) => {
    if (query.data) blockById.set(query.data.id, query.data)
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

  const rows: TestRow[] = (data ?? []).map((test, index) => {
    const open = test.openBlockId ? blockById.get(test.openBlockId) : undefined
    const status: TestStatus = test.openBlockId ? 'inProgress' : test.last ? 'completed' : 'notTaken'
    /*
     * The score a card stands on: the sitting under way while there is one, otherwise the best
     * finished one. A retake that goes worse does not take a result away from the learner.
     */
    const correct = test.openBlockId
      ? (open?.items.filter((item) => item.answer?.isCorrect).length ?? 0)
      : (test.best?.correctCount ?? 0)
    const total = test.openBlockId
      ? (open?.items.length ?? test.questionCount)
      : (test.best?.totalCount ?? test.questionCount)

    return { test, index, status, correct, total, percent: total > 0 ? Math.round((correct / total) * 100) : 0 }
  })

  const counts = {
    all: rows.length,
    completed: rows.filter((row) => row.status === 'completed').length,
    inProgress: rows.filter((row) => row.status === 'inProgress').length,
    notTaken: rows.filter((row) => row.status === 'notTaken').length,
  }
  const questions = rows.reduce((sum, row) => sum + row.total, 0)
  const overall = questions > 0 ? Math.round((rows.reduce((sum, row) => sum + row.correct, 0) / questions) * 100) : 0

  const needle = search.trim().toLocaleLowerCase()
  const visible = rows
    .filter((row) => (filter === 'all' || row.status === filter) && (!needle || row.test.title.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => (sort === 'oldest' ? a.index - b.index : sort === 'score' ? b.percent - a.percent || b.index - a.index : b.index - a.index))

  const statusLabel: Record<TestStatus, string> = {
    completed: t.statCompleted,
    inProgress: t.statInProgress,
    notTaken: t.notTaken,
  }

  return (
    <Sequence className="space-y-6" gap={stagger.base}>
      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-5">
          <Reveal>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t.title}</h1>
            <p className="mt-1 text-base text-ink-muted">{t.subtitle}</p>
          </Reveal>

          {data && (
            <Sequence className="mt-auto grid grid-cols-2 gap-3 lg:grid-cols-4" gap={stagger.base}>
              <StatTile icon={ClipboardList} label={t.statTotal} value={counts.all} markClassName="bg-signal-soft text-signal-ink" valueClassName="text-signal-ink" />
              {(['completed', 'inProgress', 'notTaken'] as const).map((status) => (
                <StatTile
                  key={status}
                  icon={STATUS_ICON[status]}
                  label={statusLabel[status]}
                  value={counts[status]}
                  markClassName={cx(STATUS_STYLE[status].soft, STATUS_STYLE[status].text)}
                  valueClassName={STATUS_STYLE[status].text}
                />
              ))}
            </Sequence>
          )}
        </div>

        {data && (
          <Reveal variants={rise}>
            <Card className="flex h-full flex-wrap items-center justify-center gap-x-8 gap-y-4">
              <ResultRing percent={overall} label={t.overall} />
              <ul className="space-y-2.5">
                <LegendRow dot="bg-signal" count={counts.all} label={t.statTotal} />
                <LegendRow dot={STATUS_STYLE.completed.dot} count={counts.completed} label={t.statCompleted} />
                <LegendRow dot={STATUS_STYLE.inProgress.dot} count={counts.inProgress} label={t.statInProgress} />
                <LegendRow dot={STATUS_STYLE.notTaken.dot} count={counts.notTaken} label={t.notTaken} />
              </ul>
            </Card>
          </Reveal>
        )}
      </div>

      {isLoading && <Spinner />}
      {isError && <QueryError onRetry={() => void refetch()} />}
      {start.isError && <ErrorNote>{t.unavailable}</ErrorNote>}

      {data && (
        <Reveal className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField value={search} onChange={setSearch} placeholder={t.search} />
          <FilterPills
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t.filterAll, count: counts.all },
              { value: 'completed', label: statusLabel.completed, count: counts.completed },
              { value: 'inProgress', label: statusLabel.inProgress, count: counts.inProgress },
              { value: 'notTaken', label: statusLabel.notTaken, count: counts.notTaken },
            ]}
          />

          <div className="flex items-center gap-2">
            <ArrowDownUp aria-hidden="true" strokeWidth={1.9} className="size-4.5 shrink-0 text-ink-muted" />
            <Select
              value={sort}
              onChange={(value) => setSort(value as SortOrder)}
              label={t.sortLabel}
              options={[
                { value: 'newest', label: t.sortNewest },
                { value: 'oldest', label: t.sortOldest },
                { value: 'score', label: t.sortScore },
              ]}
            />
          </div>
        </Reveal>
      )}

      {data && visible.length === 0 && (
        <Card className="py-10 text-center text-sm font-semibold text-ink-muted">{t.noResults}</Card>
      )}

      {/*
        Keyed by what is being shown, so changing the filter or the order replays the arrival:
        the cards that answer a new question are a new shelf, not the old one reshuffled.
      */}
      {visible.length > 0 && (
        <SequenceInView key={`${filter}-${sort}`} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" gap={stagger.base}>
          {visible.map((row) => (
            <Reveal key={row.test.id} variants={rise} className="h-full">
              <TestCard
                row={row}
                statusLabel={statusLabel[row.status]}
                busy={start.isPending}
                onStart={() => start.mutate(row.test)}
              />
            </Reveal>
          ))}
        </SequenceInView>
      )}
    </Sequence>
  )
}

function LegendRow({ dot, count, label }: { dot: string; count: number; label: string }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span aria-hidden="true" className={cx('size-2.5 shrink-0 rounded-full', dot)} />
      <span className="w-5 font-extrabold text-ink tabular-nums">{count}</span>
      <span className="text-ink-muted">{label}</span>
    </li>
  )
}

/**
 * The share of all questions answered correctly, as a ring. The arc draws itself in and the
 * figure counts up beside it — a CSS transition rather than Motion, so the stylesheet's
 * reduced-motion rule stills it with everything else.
 */
function ResultRing({ percent, label }: { percent: number; label: string }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const arc = (Math.min(100, Math.max(0, percent)) / 100) * circumference
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div role="img" aria-label={`${label}: ${percent}%`} className="relative grid size-36 shrink-0 place-items-center">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <defs>
          <linearGradient id="testsRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-signal-depth)" />
            <stop offset="100%" stopColor="var(--color-signal)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-signal-soft)" strokeWidth="11" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="url(#testsRing)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${drawn ? arc : 0} ${circumference}`}
          className="transition-[stroke-dasharray] delay-200 duration-1000 ease-out"
        />
      </svg>
      <span className="absolute grid place-items-center text-center">
        <span className="text-2xl leading-none font-extrabold text-ink tabular-nums">
          <CountUp value={percent} />%
        </span>
        <span className="mt-1 max-w-16 text-xs leading-tight text-ink-muted">{label}</span>
      </span>
    </div>
  )
}

function TestCard({
  row,
  statusLabel,
  busy,
  onStart,
}: {
  row: TestRow
  statusLabel: string
  busy: boolean
  onStart: () => void
}) {
  const t = useT().tests
  const { test, status, correct, total, percent } = row
  const style = STATUS_STYLE[status]

  return (
    <Card className="group flex h-full flex-col transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-signal/40 hover:shadow-[0_8px_24px_rgb(22_24_29/0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg leading-snug font-extrabold wrap-break-word text-ink">{test.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={DIFFICULTY_TONE[test.difficulty]}>{t.difficulties[test.difficulty]}</Badge>
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
              <FileText aria-hidden="true" strokeWidth={1.8} className="size-4" />
              {fill(t.questionCount, { count: test.questionCount })}
            </span>
          </div>
        </div>

        <Reveal variants={pop} className="shrink-0">
          <div className={cx('rounded-2xl px-3.5 py-2.5 text-center', style.soft)}>
            <p className={cx('text-lg leading-none font-extrabold tabular-nums', style.text)}>
              {correct}/{total}
            </p>
            <p className={cx('mt-1.5 text-xs leading-none', style.text)}>{t.correctAnswer}</p>
          </div>
        </Reveal>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Meter
          value={correct}
          max={total}
          label={test.title}
          delay={0.15}
          className="h-3 flex-1 overflow-hidden rounded-full bg-ground-sunken"
          fillClassName={cx('rounded-full', style.fill)}
        />
        <span className="min-w-10 text-right text-sm font-semibold text-ink-muted tabular-nums">
          <CountUp value={percent} />%
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 text-sm text-ink-muted">
          <span aria-hidden="true" className={cx('size-2.5 shrink-0 rounded-full', style.dot)} />
          {statusLabel}
        </p>
        {/* The last sitting, question by question. Kept beside the status so one button stays the action. */}
        {test.last && (
          <Link
            to={`/tests/blocks/${test.last.blockId}/review`}
            className="text-sm font-bold text-signal-ink underline-offset-4 hover:underline"
          >
            {t.lastResults}
          </Link>
        )}
      </div>

      <div className="mt-auto pt-4">
        {status === 'completed' ? (
          // A retake is offered, not urged: the test is done, so its button steps back.
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="h-11 w-full rounded-[var(--radius-control)] bg-signal-soft text-sm font-extrabold text-signal-ink transition-[background-color,transform] duration-150 hover:bg-signal/20 active:translate-y-px disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2"
          >
            {t.retake}
          </button>
        ) : (
          <Button block onClick={onStart} disabled={busy}>
            {status === 'inProgress' ? t.continue : t.start}
          </Button>
        )}
      </div>
    </Card>
  )
}
