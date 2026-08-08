import { useState } from 'react'
import { formatDate, formatMoney, formatNumber, formatPercent, useAdminQuery } from '../lib/api'
import type { Dashboard as DashboardData } from '../lib/types'
import { Card, ErrorNote, Loading, PageHeader, PeriodToggle, SectionHeading, Stat } from '../components/ui'
import { BarList, ColumnChart, Donut, LineChart, Sparkline } from '../components/charts'

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
        <SectionHeading>Sayt tashriflari</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Tashrifchilar"
            value={formatNumber(data.visits.uniqueVisitors)}
            note={`${formatNumber(data.visits.visits)} ta sahifa ochilishi · ${period}`}
          />
          <Stat
            label="Ro'yxatga aylanish"
            value={formatPercent(data.visits.signupRate)}
            note={
              data.visits.signupRate === null || data.visits.signupRate === undefined
                ? // Said rather than shown as a number: dividing a month of signups by a week
                  // of traffic is not a conversion rate, however confident it looks.
                  data.visits.countingSince
                  ? `Tashrif hisobi ${formatDate(data.visits.countingSince)} dan boshlangan — bu davrni hali qamramaydi`
                  : 'Hali tashrif yozilmagan'
                : `${formatNumber(data.audience.newUsers)} ta yangi hisob`
            }
          />
          <Card>
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">
              Qayerdan kelgan
            </span>
            <div className="mt-3">
              {data.trafficSources.length === 0 ? (
                <p className="text-sm text-ink-muted">Hali tashrif yozilmagan</p>
              ) : (
                <BarList items={data.trafficSources} format={formatNumber} labelWidth="w-24 sm:w-32" />
              )}
            </div>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-base font-extrabold text-ink">Platforma</h3>
            {data.platforms.length === 0 ? (
              <p className="text-sm text-ink-muted">Hali tashrif yozilmagan</p>
            ) : (
              <BarList items={data.platforms} format={formatNumber} labelWidth="w-20 sm:w-28" />
            )}
          </Card>

          <Card>
            <h3 className="mb-4 text-base font-extrabold text-ink">Brauzer</h3>
            {data.browsers.length === 0 ? (
              <p className="text-sm text-ink-muted">Hali tashrif yozilmagan</p>
            ) : (
              <BarList items={data.browsers} format={formatNumber} labelWidth="w-20 sm:w-28" />
            )}
            {/*
              Named because it changes what the product can do, not because it is trivia: a
              microphone prompt inside these behaves differently or never appears, and this
              app's whole proposition is speaking.
            */}
            <p className="mt-4 text-xs text-ink-faint">
              Telegram va Instagram — ilova ichidagi brauzerlar. Ularda mikrofon ruxsati
              ishonchsiz, ya'ni ovozli mashq umuman ishlamasligi mumkin.
            </p>
          </Card>
        </div>

        <Card className="mt-4">
          <h3 className="mb-3 text-base font-extrabold text-ink">Kunlik tashrifchilar</h3>
          <ColumnChart points={data.visitorSeries} label="Tashrifchilar" format={formatNumber} />
          {/*
            Said plainly, because the number invites a stronger claim than it can carry: this
            counts browsers, and one person with two of them is two.
          */}
          <p className="mt-3 text-xs text-ink-faint">
            Har bir brauzer alohida sanaladi — xotira tozalansa yoki boshqa brauzer ochilsa,
            yangi tashrifchi bo'lib ko'rinadi.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading>Darajalar</SectionHeading>
        <Card>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-sm text-ink-muted">
              Diagnostikada aniqlangan gapirish darajasi bo'yicha
            </span>
          </div>
          {/*
            Rendered in the order the server sends — A0 to B2, then the unmeasured. Sorting a
            level scale by size would put B1 above A1 and turn a scale into a ranking.
          */}
          <BarList items={data.levels} format={formatNumber} labelWidth="w-24 sm:w-32" />
          <p className="mt-4 text-xs text-ink-faint">
            "Aniqlanmagan" — diagnostikadan o'tmagan va hali baholanmagan hisoblar.
          </p>
        </Card>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">Daromad</span>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">
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
      {/* Three of these share a card, so on a narrow screen they step down rather than clip. */}
      <div className="text-xl font-extrabold tabular-nums text-ink sm:text-2xl">
        {percent ? formatPercent(value) : formatNumber(value ?? 0)}
      </div>
      <div className="text-xs text-ink-muted">{note}</div>
    </div>
  )
}
