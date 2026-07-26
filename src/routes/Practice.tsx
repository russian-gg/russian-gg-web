import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, track } from '../lib/api'
import type { MissionCategory, MissionSummary } from '../lib/types'
import { MissionCard } from '../components/MissionCard'
import { EmptyState, LinkButton, Spinner } from '../components/ui'

const FILTERS: Array<{ value: MissionCategory | null; label: string }> = [
  { value: null, label: 'Barchasi' },
  { value: 'Work', label: 'Ish' },
  { value: 'DailyLife', label: 'Kundalik' },
  { value: 'Social', label: 'Muloqot' },
  { value: 'StreetRussian', label: 'Jonli nutq' },
  { value: 'Repair', label: 'Mustahkamlash' },
]

/** The "practice for today" library, for a situation the learner is facing right now. */
export function Practice() {
  const [category, setCategory] = useState<MissionCategory | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['practice', category],
    queryFn: () =>
      api.get<MissionSummary[]>(`/course/practice${category ? `?category=${category}` : ''}`),
  })

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Bugun mashq</h1>
        <p className="text-support mt-1">
          Shoshilinch vaziyat uchun qisqa mashqlar — 90 kunlik yo’ldan tashqari.
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
              if (filter.value) track('practice_opened', { category: filter.value })
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

      {data && data.length === 0 && (
        <EmptyState
          title="Bu toifada hozircha mashq yo’q"
          body="Boshqa toifani tanlang yoki 90 kunlik yo’ldan davom eting."
          action={<LinkButton to="/path">90 kunlik yo’l</LinkButton>}
        />
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      )}
    </div>
  )
}
