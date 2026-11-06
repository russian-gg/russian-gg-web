import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Crown, FileText, Gift } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { fill, useLocale, useT } from '../lib/i18n'
import type { EntitlementView, MissionSummary } from '../lib/types'
import { MissionDetailsSheet } from '../components/missions/MissionDetailsSheet'
import { MissionMap } from '../components/missions/MissionMap'
import { buildMissionRows, currentMissionId } from '../components/missions/mission-row'
import { EmptyState, LinkButton, QueryError, Spinner } from '../components/ui'
import { Meter, Reveal, Sequence } from '../components/motion'
import { pop, stagger } from '../lib/motion'

/**
 * The Missions tab: the whole practice library as one road.
 *
 * The road is the missions in their usual order, climbing up through an illustrated town, each
 * saying where the learner stands with it. Nothing is chosen when the page opens; choosing a mission raises its
 * details from the bottom of the page, with the one thing to do next. Every state shown — finished,
 * tried, locked — is the server's: the order on the road never opens or closes anything.
 */
export function Practice() {
  const t = useT()
  const copy = t.practice
  const { locale } = useLocale()
  // Kept after the panel closes, so its content stays put while it animates away.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const chosenNode = useRef<HTMLElement | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['practice'],
    queryFn: () => api.get<MissionSummary[]>('/course/practice'),
  })
  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  const rows = useMemo(() => (data ? buildMissionRows(data, locale) : []), [data, locale])
  const currentId = currentMissionId(rows)
  const selected = rows.find((row) => row.mission.id === selectedId)
  const doneCount = rows.filter((row) => row.status === 'done').length
  const proCount = rows.filter((row) => row.locked && row.isProLock).length

  const openMission = useCallback((id: string, node: HTMLElement) => {
    chosenNode.current = node
    setSelectedId(id)
    setOpen(true)
  }, [])
  const dismiss = useCallback(() => {
    setOpen(false)
    // The close button goes with the panel; focus goes back to the mission it was about.
    chosenNode.current?.focus({ preventScroll: true })
  }, [])


  return (
    <>
      <Sequence className="relative space-y-4 sm:space-y-5" gap={stagger.base}>
        <Reveal className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-center gap-4">
            <Reveal as="span" variants={pop} className="hidden shrink-0 sm:block">
              <span className="flex size-14 items-center justify-center rounded-2xl border-2 border-signal/30 bg-signal-soft text-signal-ink shadow-[0_8px_24px_rgb(31_111_224/0.12)]">
                <FileText aria-hidden="true" strokeWidth={2} className="size-7" />
              </span>
            </Reveal>
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{copy.title}</h1>
              <p className="mt-0.5 max-w-3xl text-sm text-ink-muted sm:text-base">{copy.subtitle}</p>
            </div>
          </div>

          {/* How far along, and on the free plan how many missions are open and how many Pro opens. */}
          {rows.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-hairline bg-ground-raised px-4 py-3 shadow-[0_4px_16px_rgb(22_24_29/0.05)] sm:w-auto">
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
                <span className="shrink-0 text-sm font-extrabold text-ink tabular-nums">
                  {fill(copy.progress, { done: doneCount, total: rows.length })}
                </span>
                <Meter
                  value={doneCount}
                  max={rows.length}
                  label={copy.mapLabel}
                  className="h-2.5 w-full min-w-24 overflow-hidden rounded-full bg-hairline sm:w-44"
                  fillClassName="rounded-full bg-milestone"
                />
                <span className="shrink-0 text-xs font-extrabold text-milestone tabular-nums">
                  {Math.round((doneCount / rows.length) * 100)}%
                </span>
              </div>
              {entitlement?.hasProAccess === false && proCount > 0 && (
                <>
                  <span aria-hidden="true" className="hidden h-8 w-px bg-hairline sm:block" />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-milestone-soft px-3 py-1.5 text-xs font-extrabold text-milestone">
                    <Gift aria-hidden="true" strokeWidth={2.2} className="size-3.5" />
                    {fill(copy.freeMissions, { count: rows.length - proCount })}
                  </span>
                  <Link
                    to="/paywall"
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-coin-border bg-coin-soft pr-4 pl-1.5 text-sm font-extrabold text-coin-ink shadow-[0_2px_0_var(--color-coin-border)] transition hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal active:translate-y-px"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-coin">
                      <Crown aria-hidden="true" strokeWidth={2.4} className="size-3.5 text-coin-ink" />
                    </span>
                    {fill(copy.proMissions, { count: proCount })}
                  </Link>
                </>
              )}
            </div>
          )}
        </Reveal>

        {isLoading && <Spinner />}

        {/* Without this the heading sits over nothing at all: `data` is undefined on a failed
            request, so neither the path nor the empty state below is reached. */}
        {isError && <QueryError onRetry={() => void refetch()} />}

        {data && rows.length === 0 && (
          <EmptyState
            title={copy.empty}
            body={copy.emptyBody}
            action={<LinkButton to="/path">{t.nav.path}</LinkButton>}
          />
        )}

        {rows.length > 0 && (
          // The panel floats over the bottom of the map box, inside the same frame.
          <Reveal className="relative min-w-0">
            <MissionMap
              rows={rows}
              openId={open ? selectedId : null}
              currentId={currentId}
              onOpen={openMission}
              panelRef={panel}
            />
            <MissionDetailsSheet
              ref={panel}
              row={selected}
              open={open}
              showFreeLabel={entitlement?.hasProAccess === false}
              onDismiss={dismiss}
            />
          </Reveal>
        )}
      </Sequence>
    </>
  )
}
