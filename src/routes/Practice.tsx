import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { TOPIC_ORDER, topicLabelUz } from '../lib/format'
import type { MissionSummary, MissionTopic } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { EmptyState, LinkButton, SectionHeading, Spinner } from '../components/ui'

type Situation = Exclude<MissionTopic, 'Unset'>

export function Practice() {
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
      label: topicLabelUz[topic],
      missions: byTopic.get(topic)!,
    }))

    return untagged.length > 0
      ? [...ordered, { key: 'other', label: 'Boshqa mashqlar', missions: untagged }]
      : ordered
  }, [data])

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Topshiriqlarni bajarishga tayyormisiz?
        </h1>
        <p className="text-support mt-1">
          Kun davomida kerak bo'ladigan suhbat va iboralarni topshiriqlarni bajarish orqali
          oson va tez o'rganing.
        </p>
      </header>

      {isLoading && <Spinner />}

      {data && groups.length === 0 && (
        <EmptyState
          title="Hozircha topshiriq yo'q"
          body="90 kunlik yo'ldan davom eting — mashqlar tayyorlanmoqda."
          action={<LinkButton to="/path">90 kunlik yo'l</LinkButton>}
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
