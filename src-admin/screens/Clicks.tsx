import { useState } from 'react'
import { formatNumber, useAdminQuery } from '../lib/api'
import type { Clicks as ClicksData } from '../lib/types'
import { Card, ErrorNote, Loading, PageHeader, PeriodToggle } from '../components/ui'
import { BarList } from '../components/charts'

export function Clicks() {
  const [days, setDays] = useState(30)
  const { data, error, isLoading } = useAdminQuery<ClicksData>(`/api/admin-portal/clicks?days=${days}`)

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Tugma bosishlari"
          subtitle="Ilovada kuzatiladigan hodisalar qanchalik tez-tez sodir bo'ladi"
        />
        <PeriodToggle value={days} onChange={setDays} />
      </div>

      <Card>
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold tabular-nums text-ink">{formatNumber(data.totalEvents)}</span>
          <span className="text-sm text-ink-muted">ta hodisa · {days} kun</span>
        </div>

        <BarList items={data.events} format={formatNumber} labelWidth="w-52" />

        {/*
          Named, not guessed at. These are the events the product raises by name — a tap on
          something nobody instrumented is absent here, and reading the list as "everything
          that was pressed" would be reading it wrong.
        */}
        <p className="mt-5 text-xs text-ink-faint">
          Ro'yxat kodda nomlangan hodisalar katalogidan olinadi.
        </p>
      </Card>
    </div>
  )
}
