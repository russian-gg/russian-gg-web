import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { api } from '../lib/api'
import { useLocale, useT } from '../lib/i18n'
import type { EntitlementView, MissionSummary } from '../lib/types'
import { MissionDetailsSheet } from '../components/missions/MissionDetailsSheet'
import { MissionMap } from '../components/missions/MissionMap'
import { TownBackdrop } from '../components/missions/TownBackdrop'
import { buildMissionRows, currentMissionId } from '../components/missions/mission-row'
import { EmptyState, LinkButton, QueryError, Spinner } from '../components/ui'
import { Reveal, Sequence } from '../components/motion'
import { pop, stagger } from '../lib/motion'

/**
 * The Missions tab: the whole practice library as one road.
 *
 * The road is the missions in their usual order, all of them on screen, each saying where the
 * learner stands with it. Nothing is chosen when the page opens; choosing a mission raises its
 * details from the bottom of the page, with the one thing to do next. Every state shown — finished,
 * tried, locked — is the server's: the order on the road never opens or closes anything.
 */
export function Practice() {
  const t = useT()
  const copy = t.practice
  const { locale } = useLocale()
  const reduced = useReducedMotion()
  // Kept after the panel closes, so its content stays put while it animates away.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const chosenNode = useRef<HTMLElement | null>(null)
  const roadStart = useRef<HTMLDivElement>(null)
  const [backdropTop, setBackdropTop] = useState<number | null>(null)

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

  /*
   * The town picture starts where the road does, below the heading. The heading's height
   * depends on the width and the language, so it is measured, and again whenever the page
   * changes size — and once more after the entrance, which arrives slightly lower than it
   * settles.
   */
  const hasRoad = rows.length > 0
  useLayoutEffect(() => {
    const el = roadStart.current
    if (!el) return
    const measure = () => setBackdropTop(Math.max(0, el.getBoundingClientRect().top + window.scrollY - 48))
    measure()
    const settled = window.setTimeout(measure, 700)
    const observer = new ResizeObserver(measure)
    observer.observe(document.documentElement)
    return () => {
      window.clearTimeout(settled)
      observer.disconnect()
    }
  }, [hasRoad])

  /*
   * The panel sits on the bottom of the screen, so a mission chosen low on the road would end
   * up underneath it. Once the panel has its size, the page moves just enough to keep the
   * chosen node in view above it.
   */
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const sheet = panel.current
      const node = chosenNode.current
      if (!sheet || !node) return
      const sheetTop = window.innerHeight - (parseFloat(getComputedStyle(sheet).bottom) || 0) - sheet.offsetHeight
      const overlap = node.getBoundingClientRect().bottom + 16 - sheetTop
      if (overlap > 0) window.scrollBy({ top: overlap, behavior: reduced ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, selectedId, reduced])

  return (
    <>
      {/* The town fills the screen behind the road; the page is `relative` to paint over it. */}
      <TownBackdrop top={hasRoad ? backdropTop : null} />
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
          <Reveal className="min-w-0">
            <div ref={roadStart} />
            <MissionMap
              rows={rows}
              openId={open ? selectedId : null}
              currentId={currentId}
              onOpen={openMission}
            />
          </Reveal>
        )}

        <MissionDetailsSheet
          ref={panel}
          row={selected}
          open={open}
          showFreeLabel={entitlement?.hasProAccess === false}
          onDismiss={dismiss}
        />
      </Sequence>
    </>
  )
}
