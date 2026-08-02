import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, track } from '../lib/api'
import { TOPIC_ORDER, topicLabelUz } from '../lib/format'
import type { MissionSummary, MissionTopic } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { Badge, EmptyState, LinkButton, Spinner } from '../components/ui'

type Filter = 'all' | Exclude<MissionTopic, 'Unset'>

export function Practice() {
  const [filter, setFilter] = useState<Filter>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['practice'],
    queryFn: () => api.get<MissionSummary[]>('/course/practice'),
  })

  /*
   * Chips are derived from the missions that actually came back, never from a hardcoded
   * list. A filter that leads to an empty shelf is a promise the library cannot keep, and
   * that is exactly what the previous mapping did — it filed every Street Russian mission
   * under "Taksi" and every repair drill under "Do'kon".
   */
  const topics = useMemo(() => {
    if (!data) return []

    const present = new Set(
      data
        .map((mission) => mission.topic)
        .filter((topic): topic is Exclude<MissionTopic, 'Unset'> => topic !== 'Unset'),
    )

    return TOPIC_ORDER.filter((topic) => present.has(topic))
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data
    return data.filter((mission) => mission.topic === filter)
  }, [data, filter])

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Topshiriqlarni bajarishga tayyormisiz?
        </h1>
        <p className="text-support mt-1">
          Kun davomida kerak bo'ladigan suhbat va iboralarni topshiriqlarni bajarish orqali
          oson va tez o'rganing.
        </p>
      </header>

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Vaziyat">
          <TopicChip
            label="Barchasi"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          {topics.map((topic) => (
            <TopicChip
              key={topic}
              label={topicLabelUz[topic]}
              active={filter === topic}
              onClick={() => {
                setFilter(topic)
                track('practice_opened', { topic })
              }}
            />
          ))}
        </div>
      )}

      {isLoading && <Spinner />}

      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">Tezkor dialoglar</Badge>
          <Badge tone="milestone">Bajarilgan topshiriq belgilanadi</Badge>
        </div>
      )}

      {data && filtered.length === 0 && (
        <EmptyState
          title="Bu bo'limda hozircha topshiriq yo'q"
          body="Boshqa bo'limni tanlang yoki 90 kunlik yo'ldan davom eting."
          action={<LinkButton to="/path">90 kunlik yo'l</LinkButton>}
        />
      )}

      {filtered.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          {filtered.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      )}
    </div>
  )
}

function TopicChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? 'bg-signal text-on-signal'
          : 'border border-hairline text-ink-muted hover:border-ink-faint hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}
