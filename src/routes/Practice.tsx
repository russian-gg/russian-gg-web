import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { TOPIC_ORDER } from '../lib/format'
import { useT } from '../lib/i18n'
import type { MissionSummary, MissionTopic } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { EmptyState, LinkButton, SectionHeading, Spinner } from '../components/ui'

type Situation = Exclude<MissionTopic, 'Unset'>

export function Practice() {
  const t = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['practice'],
    queryFn: () => api.get<MissionSummary[]>('/course/practice'),
  })

  /*
   * Grouped, not filtered. Most situations hold one or two missions, so a filter row costs a
   * tap and a decision to reveal a single card — the whole library fits on one screen, and
   * seeing every situation at once is what tells the learner what the product covers.
   */
  const groups = useMemo(() => {
    if (!data) return []

    const byTopic = new Map<Situation, MissionSummary[]>()
    const untagged: MissionSummary[] = []

    for (const mission of data) {
      if (mission.topic === 'Unset') {
        untagged.push(mission)
        continue
      }

      const bucket = byTopic.get(mission.topic)
      if (bucket) bucket.push(mission)
      else byTopic.set(mission.topic, [mission])
    }

    const ordered = TOPIC_ORDER.filter((topic) => byTopic.has(topic)).map((topic) => ({
      key: topic as string,
      label: t.labels.topic[topic],
      missions: byTopic.get(topic)!,
    }))

    return untagged.length > 0
      ? [...ordered, { key: 'other', label: t.practice.other, missions: untagged }]
      : ordered
  }, [data, t])

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

      {data && groups.length === 0 && (
        <EmptyState
          title={t.practice.empty}
          body={t.practice.emptyBody}
          action={<LinkButton to="/path">{t.nav.path}</LinkButton>}
        />
      )}

      {groups.map((group) => (
        <section key={group.key}>
          <SectionHeading>{group.label}</SectionHeading>
          <div className="grid gap-3 lg:grid-cols-3">
            {group.missions.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
