import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { api } from '../lib/api'
import { useLocale, useT } from '../lib/i18n'
import type { EntitlementView, MissionSummary } from '../lib/types'
import { MissionDetailsSheet } from '../components/missions/MissionDetailsSheet'
import { MissionMap } from '../components/missions/MissionMap'
import { buildMissionRows, currentMissionId } from '../components/missions/mission-row'
import { EmptyState, LinkButton, QueryError, Spinner } from '../components/ui'
import { Reveal, Sequence } from '../components/motion'
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
      <Sequence className="relative space-y-6" gap={stagger.base}>
        <Reveal className="flex items-start gap-4">
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
