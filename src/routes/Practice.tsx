import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, track } from '../lib/api'
import type { MissionSummary } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { Badge, EmptyState, LinkButton, Spinner } from '../components/ui'

const FILTERS = [
  { value: 'all', label: 'Barchasi' },
  { value: 'work', label: 'Ish' },
  { value: 'daily', label: 'Kundalik' },
  { value: 'social', label: 'Muloqot' },
  { value: 'taxi', label: 'Taksi' },
  { value: 'dokon', label: "Do'kon" },
] as const

type ScenarioFilter = (typeof FILTERS)[number]['value']

const CATEGORY_BY_MISSION: Record<string, Exclude<ScenarioFilter, 'all'>> = {
  Work: 'work',
  DailyLife: 'daily',
  Social: 'social',
  StreetRussian: 'taxi',
  Repair: 'dokon',
}

export function Practice() {
  const [category, setCategory] = useState<ScenarioFilter>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['practice'],
    queryFn: () => api.get<MissionSummary[]>('/course/practice'),
  })

  const filtered = useMemo(() => {
    if (!data) return []
    const visible = data.filter((mission) => mission.category in CATEGORY_BY_MISSION)
    if (category === 'all') return visible
    return visible.filter((mission) => CATEGORY_BY_MISSION[mission.category] === category)
  }, [category, data])

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

      <div className="flex flex-wrap gap-2" role="group" aria-label="Toifa">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            aria-pressed={category === filter.value}
            onClick={() => {
              setCategory(filter.value)
              if (filter.value !== 'all') track('practice_opened', { category: filter.value })
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              category === filter.value
                ? 'bg-signal text-on-signal'
                : 'border border-hairline text-ink-muted hover:text-ink'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

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
