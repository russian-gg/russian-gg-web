import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { TOPIC_ORDER } from '../lib/format'
import { useT } from '../lib/i18n'
import type { EntitlementView, MissionSummary, MissionTopic } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { EmptyState, LinkButton, Spinner } from '../components/ui'

export function Practice() {
  const t = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['practice'],
    queryFn: () => api.get<MissionSummary[]>('/course/practice'),
  })
  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  /*
   * One list, still in situation order, but without a heading per situation: every card
   * carries its own title, and most situations held a single card under a heading that only
   * repeated it. Untagged missions go last. The sort is stable, so the server's order holds
   * inside a situation.
   */
  const missions = useMemo(() => {
    if (!data) return []

    const rank = (topic: MissionTopic) => {
      const index = topic === 'Unset' ? -1 : TOPIC_ORDER.indexOf(topic)
      return index < 0 ? TOPIC_ORDER.length : index
    }

    return [...data].sort((a, b) => rank(a.topic) - rank(b.topic))
  }, [data])

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {t.practice.title}
        </h1>
        <p className="text-support mt-1">
          {t.practice.subtitle}
        </p>
      </header>

      {isLoading && <Spinner />}

      {data && missions.length === 0 && (
        <EmptyState
          title={t.practice.empty}
          body={t.practice.emptyBody}
          action={<LinkButton to="/path">{t.nav.path}</LinkButton>}
        />
      )}

      {missions.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          {missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              showFreeLabel={entitlement?.hasProAccess === false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
