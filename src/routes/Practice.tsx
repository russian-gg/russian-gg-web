import { useMemo, useState } from 'react'
import type { Variants } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownUp,
  CircleCheck,
  CircleDashed,
  FileText,
  Lock,
  Play,
  RotateCcw,
  Timer,
} from 'lucide-react'
import { api } from '../lib/api'
import { pickContent } from '../lib/content'
import { cx } from '../lib/cx'
import { TOPIC_ORDER } from '../lib/format'
import { fill, useLocale, useT } from '../lib/i18n'
import { missionPath } from '../lib/mission-path'
import type { EntitlementView, MissionSummary, MissionTopic } from '../lib/types'
import { FilterPills, SearchField, StatTile } from '../components/Catalog'
import { Select } from '../components/forms/Select'
import { MissionPreviewDialog } from '../components/MissionCard'
import { Badge, Button, Card, EmptyState, LinkButton, QueryError, Spinner } from '../components/ui'
import { CountUp, Meter, Reveal, Sequence, SequenceInView } from '../components/motion'
import { pop, rise, spring, stagger } from '../lib/motion'
import clipboardArt from '../assets/images/missions_main_card.webp'

// The illustration lands rather than fades: it is the one object on the page's header, and it
// arrives on the same spring the product's other physical things settle on.
const artLanding: Variants = {
  hidden: { opacity: 0, scale: 0.85, x: 20 },
  shown: { opacity: 1, scale: 1, x: 0, transition: { ...spring, duration: 0.7 } },
}

type MissionStatus = 'done' | 'inProgress' | 'notStarted'
type StatusFilter = 'all' | MissionStatus
type SortOrder = 'default' | 'score' | 'short'

/** A mission as its card shows it. */
type MissionRow = {
  mission: MissionSummary
  /** Its number on the shelf: its place in the usual order, whatever is filtered or sorted. */
  number: number
  title: string
  status: MissionStatus
  percent: number
}

/**
 * How each state is painted — the tile, the badge, the number, the bar and the card's own tint
 * read from one table, so they cannot disagree.
 *
 * "In progress" has an orange of its own for fills: the theme's caution colour is a dark amber
 * meant for text, and as a fill it reads as brown.
 */
const STATUS_STYLE: Record<MissionStatus, { text: string; soft: string; fill: string; card: string }> = {
  done: {
    text: 'text-milestone',
    soft: 'bg-milestone-soft',
    fill: 'bg-milestone',
    card: 'border-milestone/20 bg-linear-to-br from-milestone-soft/70 to-ground-raised',
  },
  inProgress: {
    text: 'text-caution',
    soft: 'bg-caution-soft',
    fill: 'bg-signal',
    card: 'border-hairline bg-linear-to-bl from-caution-soft/60 to-ground-raised to-45%',
  },
  notStarted: {
    text: 'text-ink-muted',
    soft: 'bg-ground-sunken',
    fill: 'bg-signal',
    card: 'border-hairline bg-ground-raised',
  },
}

const STATUS_ICON = { done: CircleCheck, inProgress: Timer, notStarted: CircleDashed } as const

/**
 * The Missions tab: the whole practice library on one shelf.
 *
 * It opens with the shelf counted — how many missions there are and how many are behind the
 * learner — and then the missions themselves, each saying where the learner stands with it and
 * offering the one thing to do next. A mission tried but not yet passed counts as in progress:
 * that is the only "under way" the server records, since a conversation is not resumed half
 * way through.
 */
export function Practice() {
  const t = useT()
  const copy = t.practice
  const { locale } = useLocale()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('default')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['practice'],
    queryFn: () => api.get<MissionSummary[]>('/course/practice'),
  })
  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  /*
   * One list, in situation order, without a heading per situation: every card carries its own
   * title, and most situations held a single card under a heading that only repeated it.
   * Untagged missions go last. The sort is stable, so the server's order holds inside a
   * situation.
   */
  const rows = useMemo<MissionRow[]>(() => {
    if (!data) return []

    const rank = (topic: MissionTopic) => {
      const index = topic === 'Unset' ? -1 : TOPIC_ORDER.indexOf(topic)
      return index < 0 ? TOPIC_ORDER.length : index
    }

    return [...data]
      .sort((a, b) => rank(a.topic) - rank(b.topic))
      .map((mission, index) => {
        const best = mission.bestScore ?? null
        const status: MissionStatus = mission.isCompleted ? 'done' : best !== null ? 'inProgress' : 'notStarted'

        return {
          mission,
          number: index + 1,
          title: pickContent(locale, { uz: mission.titleUz, ru: mission.titleRu, en: mission.titleEn }),
          status,
          // A mission finished before scores were kept still reads as full.
          percent: Math.min(100, Math.max(0, best ?? (mission.isCompleted ? 100 : 0))),
        }
      })
  }, [data, locale])

  const counts = {
    all: rows.length,
    done: rows.filter((row) => row.status === 'done').length,
    inProgress: rows.filter((row) => row.status === 'inProgress').length,
    notStarted: rows.filter((row) => row.status === 'notStarted').length,
  }
  const statusLabel: Record<MissionStatus, string> = {
    done: copy.statDone,
    inProgress: copy.statInProgress,
    notStarted: copy.statNotStarted,
  }

  const needle = search.trim().toLocaleLowerCase()
  const visible = rows
    .filter((row) => (filter === 'all' || row.status === filter) && (!needle || row.title.toLocaleLowerCase().includes(needle)))
    .sort((a, b) =>
      sort === 'score'
        ? b.percent - a.percent || a.number - b.number
        : sort === 'short'
          ? a.mission.estimatedMinutes - b.mission.estimatedMinutes || a.number - b.number
          : a.number - b.number,
    )

  return (
    <Sequence className="relative isolate space-y-6" gap={stagger.base}>
      {/*
        The picture sits behind the top of the page, in the corner the heading and the counts
        leave free on a wide screen. Two layers, because two things move it: the wrapper places
        and lands it, the image inside drifts — both are transforms, and on one element the
        second would overwrite the first. On narrower screens there is no free corner, so it is
        not shown.
      */}
      <Reveal
        variants={artLanding}
        className="pointer-events-none absolute -top-6 right-0 -z-10 hidden w-[23rem] xl:block 2xl:w-[26rem]"
      >
        <img
          src={clipboardArt}
          alt=""
          width={640}
          height={444}
          decoding="async"
          className="h-auto w-full animate-[gameBob_6s_ease-in-out_infinite] select-none"
        />
      </Reveal>

      <Reveal className="flex items-start gap-4 xl:pr-[24rem] 2xl:pr-[27rem]">
        <Reveal as="span" variants={pop} className="hidden shrink-0 sm:block">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-signal-soft text-signal-ink shadow-[0_8px_24px_rgb(31_111_224/0.12)]">
            <FileText aria-hidden="true" strokeWidth={1.8} className="size-8" />
          </span>
        </Reveal>
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-base text-ink-muted">{copy.subtitle}</p>
        </div>
      </Reveal>

      {isLoading && <Spinner />}

      {/* Without this the heading sits over nothing at all: `data` is undefined on a failed
          request, so neither the list nor the empty state below is reached. */}
      {isError && <QueryError onRetry={() => void refetch()} />}

      {data && rows.length === 0 && (
        <EmptyState
          title={copy.empty}
          body={copy.emptyBody}
          action={<LinkButton to="/path">{t.nav.path}</LinkButton>}
        />
      )}

      {rows.length > 0 && (
        <>
          <Sequence className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-2 xl:pr-[24rem] 2xl:grid-cols-4 2xl:pr-[27rem]" gap={stagger.base}>
            <StatTile icon={FileText} label={copy.statTotal} value={counts.all} markClassName="bg-signal-soft text-signal-ink" />
            {(['done', 'inProgress', 'notStarted'] as const).map((status) => (
              <StatTile
                key={status}
                icon={STATUS_ICON[status]}
                label={statusLabel[status]}
                value={counts[status]}
                markClassName={cx(STATUS_STYLE[status].soft, STATUS_STYLE[status].text)}
              />
            ))}
          </Sequence>

          <Reveal className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
            <SearchField value={search} onChange={setSearch} placeholder={copy.search} />
            <FilterPills
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: copy.filterAll, count: counts.all },
                { value: 'done', label: statusLabel.done, count: counts.done },
                { value: 'inProgress', label: statusLabel.inProgress, count: counts.inProgress },
                { value: 'notStarted', label: statusLabel.notStarted, count: counts.notStarted },
              ]}
            />
            <div className="flex items-center gap-2">
              <ArrowDownUp aria-hidden="true" strokeWidth={1.9} className="size-4.5 shrink-0 text-ink-muted" />
              <Select
                value={sort}
                onChange={(value) => setSort(value as SortOrder)}
                label={copy.sortLabel}
                options={[
                  { value: 'default', label: copy.sortDefault },
                  { value: 'score', label: copy.sortScore },
                  { value: 'short', label: copy.sortShort },
                ]}
              />
            </div>
          </Reveal>

          {visible.length === 0 && (
            <Card className="py-10 text-center text-sm font-semibold text-ink-muted">{copy.noResults}</Card>
          )}

          {/*
            A shelf of cards, left to right, top to bottom, arriving as the learner reaches them.
            Keyed by what is being shown, so a new filter or order is a new shelf arriving rather
            than the old one silently reshuffled.
          */}
          {visible.length > 0 && (
            <SequenceInView key={`${filter}-${sort}`} className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" gap={stagger.base}>
              {visible.map((row) => (
                <Reveal key={row.mission.id} variants={rise} className="h-full">
                  <PracticeCard
                    row={row}
                    statusLabel={statusLabel[row.status]}
                    showFreeLabel={entitlement?.hasProAccess === false}
                  />
                </Reveal>
              ))}
            </SequenceInView>
          )}
        </>
      )}
    </Sequence>
  )
}

/**
 * One mission on the shelf: its number and name, where the learner stands with it, the best
 * score so far against the mark that passes it, and one button.
 *
 * The button opens the same preview the cards elsewhere open — what the mission is, how long it
 * runs, how it is scored — so the learner reads one paragraph before committing. A locked
 * mission has no preview to open: its button leads to what unlocks it.
 */
function PracticeCard({
  row,
  statusLabel,
  showFreeLabel,
}: {
  row: MissionRow
  statusLabel: string
  showFreeLabel: boolean
}) {
  const t = useT()
  const copy = t.practice
  const navigate = useNavigate()
  const [previewOpen, setPreviewOpen] = useState(false)
  const { mission, number, title, status, percent } = row
  const style = STATUS_STYLE[status]
  const StatusIcon = STATUS_ICON[status]
  const best = mission.bestScore ?? null
  const pass = mission.passScore ?? null
  const isProLock = mission.isLocked && (mission.lockReason?.toLowerCase().includes('pro') ?? false)
  const needsRegisterLabel =
    mission.category === 'StreetRussian' ||
    mission.formality === 'Informal' ||
    mission.formality === 'Slang' ||
    mission.workplaceUse !== 'Safe'

  return (
    <article
      className={cx(
        'group flex h-full flex-col rounded-[var(--radius-card)] border p-5',
        'transition-[transform,border-color,box-shadow] duration-150',
        mission.isLocked
          ? 'opacity-80'
          : 'hover:-translate-y-0.5 hover:border-signal/45 hover:shadow-[0_8px_24px_rgb(22_24_29/0.06)]',
        style.card,
      )}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span
          className={cx(
            'flex size-12 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold tabular-nums',
            'transition-transform duration-150 group-hover:scale-105',
            status === 'done'
              ? 'bg-milestone-soft text-milestone'
              : status === 'inProgress'
                ? 'bg-signal-soft text-signal-ink'
                : 'bg-ground-sunken text-ink-muted',
          )}
        >
          {number}
        </span>

        <div className="min-w-0 grow basis-32">
          <h2 className="text-base leading-snug font-extrabold wrap-break-word text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {t.labels.category[mission.category]}
            {` · ${fill(t.common.minutes, { count: mission.estimatedMinutes })}`}
          </p>
        </div>

        <Reveal as="span" variants={pop} className="ml-auto shrink-0">
          {mission.isLocked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-caution-soft px-3 py-1.5 text-xs font-bold text-caution">
              <Lock aria-hidden="true" strokeWidth={2} className="size-3.5" />
              {isProLock ? t.path.needsPro : t.path.locked}
            </span>
          ) : (
            <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold', style.soft, style.text)}>
              {status !== 'notStarted' && <StatusIcon aria-hidden="true" strokeWidth={2.2} className="size-3.5" />}
              {statusLabel}
            </span>
          )}
        </Reveal>
      </div>

      {(needsRegisterLabel || (showFreeLabel && !mission.isLocked)) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {showFreeLabel && !mission.isLocked && <Badge>{t.account.plan.free}</Badge>}
          {needsRegisterLabel && (
            <>
              <Badge tone="caution">{t.labels.formality[mission.formality]}</Badge>
              <Badge tone={mission.workplaceUse === 'Safe' ? 'neutral' : 'caution'}>
                {t.labels.workplace[mission.workplaceUse]}
              </Badge>
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Meter
          value={percent}
          label={title}
          delay={0.15}
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-ground-sunken"
          fillClassName={cx('rounded-full', style.fill)}
        />
        <span className={cx('min-w-10 text-right text-sm font-bold tabular-nums', status === 'done' ? 'text-milestone' : 'text-ink-muted')}>
          <CountUp value={percent} />%
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-ink-muted">
        <span className={best !== null && status === 'done' ? 'font-semibold text-ink' : undefined}>
          {best !== null ? fill(copy.bestScore, { score: best }) : mission.isCompleted ? t.path.done : copy.notTried}
        </span>
        {pass !== null && <span>{fill(copy.passMark, { score: pass })}</span>}
      </div>

      <div className="mt-auto flex justify-end pt-4 pb-1">
        {mission.isLocked ? (
          <LinkButton to={isProLock ? '/paywall' : '/path'} variant="secondary" size="md">
            <Lock aria-hidden="true" strokeWidth={2} className="size-4" />
            {isProLock ? t.path.buyPro : t.nav.path}
          </LinkButton>
        ) : (
          // A finished mission offers its repeat on the quieter button; the others lead with
          // the action.
          <Button
            variant={status === 'done' ? 'secondary' : 'primary'}
            onClick={() => setPreviewOpen(true)}
            data-ui-sound="select"
            aria-haspopup="dialog"
          >
            {status === 'done' ? (
              <RotateCcw aria-hidden="true" strokeWidth={2.2} className="size-4" />
            ) : (
              <Play aria-hidden="true" strokeWidth={2.2} className="size-4 fill-current" />
            )}
            {status === 'done' ? copy.repeat : status === 'inProgress' ? copy.continue : copy.start}
          </Button>
        )}
      </div>

      {!mission.isLocked && (
        <MissionPreviewDialog
          open={previewOpen}
          mission={mission}
          title={title}
          featured={false}
          onDismiss={() => setPreviewOpen(false)}
          onStart={() => navigate(missionPath(mission))}
        />
      )}
    </article>
  )
}
