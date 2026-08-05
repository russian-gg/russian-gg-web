import { useState } from 'react'
import { formatMoney, formatNumber, formatPercent, useAdminQuery } from '../lib/api'
import type { Dashboard as DashboardData } from '../lib/types'
import { Card, ErrorNote, Loading, PageHeader, PeriodToggle, SectionHeading, Stat } from '../components/ui'
import { ColumnChart, Donut, LineChart, Sparkline } from '../components/charts'

export function Dashboard() {
  const [days, setDays] = useState(30)
  const { data, error, isLoading } = useAdminQuery<DashboardData>(`/api/admin-portal/dashboard?days=${days}`)

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const period = `${days} kunlik davr`

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Boshqaruv paneli" subtitle="O'sish, tranzaksiyalar va auditoriya sharhi" />
        <PeriodToggle value={days} onChange={setDays} />
      </div>

      <section>
        <SectionHeading>Auditoriya va faollik</SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            label="Foydalanuvchilar"
            value={formatNumber(data.audience.totalUsers)}
            note={`+${formatNumber(data.audience.newUsers)} · ${period}`}
          />

          <Card>
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">
              Faol foydalanuvchilar
            </span>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Figure label="DAU" value={data.audience.dau} note="24 soatda" />
              <Figure label="WAU" value={data.audience.wau} note="7 kunda" />
              <Figure label="MAU" value={data.audience.mau} note="30 kunda" />
            </div>
            {/*
              Said once, plainly. "Active" is a definition, not a fact, and an operator
              comparing this with another panel needs to know which one is being used here.
            */}
            <p className="mt-3 text-xs text-ink-faint">Faollik = qayd etilgan hodisalar</p>
          </Card>

          <Card>
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">
              Ushlab qolish
            </span>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Figure label="Kun" value={data.retention.day} percent note="1 kun" />
              <Figure label="Hafta" value={data.retention.week} percent note="7 kun" />
              <Figure label="Oy" value={data.retention.month} percent note="30 kun" />
            </div>
            <p className="mt-3 text-xs text-ink-faint">Oldingi davrda faol bo'lganlarning qaytgan ulushi</p>
          </Card>
        </div>
      </section>

      <section>
        <SectionHeading>Foydalanuvchilar o'sishi</SectionHeading>
        <Card>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tabular-nums text-ink">
              {formatNumber(data.audience.totalUsers)}
            </span>
            <span className="text-sm text-ink-muted">jami hisob</span>
          </div>
          <LineChart points={data.userGrowth} label="Foydalanuvchilar o'sishi" format={formatNumber} />
        </Card>
      </section>

      <section>
        <SectionHeading>Obunalar va tranzaksiyalar</SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">Daromad</span>
            <div className="mt-1 text-3xl font-extrabold tabular-nums text-ink">
              {formatMoney(data.money.revenue, data.money.currency)}
            </div>
            <div className="text-sm text-ink-muted">
              {formatNumber(data.money.paidTransactions)} ta to'lov · {period}
            </div>
            <Sparkline points={data.transactions} />
          </Card>

          <Stat
            label="Pullik obunalar"
            value={formatNumber(data.plans.find((plan) => plan.label === 'PRO')?.value ?? 0)}
            note="Amaldagi PRO kirish"
          />

          <Stat
            label="Free"
            value={formatNumber(data.plans.find((plan) => plan.label === 'Free')?.value ?? 0)}
            note="To'lovsiz hisoblar"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-base font-extrabold text-ink">Obunalar</h3>
            <Donut slices={data.plans} format={formatNumber} />
          </Card>

          <Card>
            <h3 className="mb-4 text-base font-extrabold text-ink">Tranzaksiyalar</h3>
            <ColumnChart points={data.transactions} label="To'lovlar" format={formatNumber} />
          </Card>
        </div>
      </section>

      <p className="text-xs text-ink-faint">Muhit: {data.environment}</p>
    </div>
  )
}

function Figure({
  label,
  value,
  note,
  percent = false,
}: {
  label: string
  /** Undefined as well as null: an unmeasured retention figure arrives as a missing key. */
  value: number | null | undefined
  note: string
  percent?: boolean
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">{label}</div>
      <div className="text-2xl font-extrabold tabular-nums text-ink">
        {percent ? formatPercent(value) : formatNumber(value ?? 0)}
      </div>
      <div className="text-xs text-ink-muted">{note}</div>
    </div>
  )
}
