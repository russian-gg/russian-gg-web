import { useState } from 'react'
import { useStickyTab } from '../lib/sticky-tab'
import { formatDate, formatMoney, formatNumber, formatPercent, useAdminQuery } from '../lib/api'
import type { Dashboard as DashboardData } from '../lib/types'
import { Card, EmptyNote, ErrorNote, LoadingStats, PageHeader, PeriodToggle, Screen, Stat, Tabs } from '../components/ui'
import { BarList, ColumnChart, Donut, LineChart } from '../components/charts'

/*
 * One tab per question the panel is opened to answer: who is here, how they arrive, who put
 * it on a phone, and what was paid. Module-level so `useStickyTab` sees a stable list.
 */
const DASHBOARD_TABS = ['audience', 'visits', 'app', 'revenue'] as const

export function Dashboard() {
  const [days, setDays] = useState(30)
  const [tab, setTab] = useStickyTab('dashboard', DASHBOARD_TABS)
  const { data, error, isLoading } = useAdminQuery<DashboardData>(`/api/admin-portal/dashboard?days=${days}`)

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <LoadingStats />
  if (!data) return null

  const period = `${days} kunlik davr`

  return (
    <Screen className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Boshqaruv paneli" subtitle="O'sish, tranzaksiyalar va auditoriya sharhi" />
        <PeriodToggle value={days} onChange={setDays} />
      </div>

      {/*
        The four figures every visit starts with, whichever tab is open. Each is shown here and
        nowhere below: the tabs carry the detail behind a figure, not a second copy of it.
      */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Foydalanuvchilar"
          value={formatNumber(data.audience.totalUsers)}
          note={`+${formatNumber(data.audience.newUsers)} · ${period}`}
        />
        <Stat label="Bugun faol (DAU)" value={formatNumber(data.audience.dau)} note="24 soatda" />
        <Stat
          label="Pullik obunalar"
          value={formatNumber(data.plans.find((plan) => plan.label === 'PRO')?.value ?? 0)}
          note="Amaldagi PRO kirish"
        />
        <Stat
          label="Daromad"
          value={formatMoney(data.money.revenue, data.money.currency)}
          note={`${formatNumber(data.money.paidTransactions)} ta to'lov · ${period}`}
        />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: 'audience', label: 'Auditoriya' },
          { id: 'visits', label: 'Tashriflar' },
          { id: 'app', label: 'Ilova' },
          { id: 'revenue', label: 'Daromad' },
        ]}
      />

      {tab === 'audience' && <AudienceTab data={data} />}
      {tab === 'visits' && <VisitsTab data={data} period={period} />}
      {tab === 'app' && <AppTab data={data} period={period} />}
      {tab === 'revenue' && <RevenueTab data={data} />}

      <p className="text-xs text-ink-faint">Muhit: {data.environment}</p>
    </Screen>
  )
}

function AudienceTab({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">
            Faol foydalanuvchilar
          </span>
          {/* DAU is the headline figure above; the two longer windows sit here beside retention. */}
          <div className="mt-3 grid grid-cols-2 gap-3">
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

      <Card>
        <h3 className="mb-3 text-base font-extrabold text-ink">Foydalanuvchilar o'sishi</h3>
        <LineChart points={data.userGrowth} label="Foydalanuvchilar o'sishi" format={formatNumber} />
      </Card>

      <Card>
        <h3 className="mb-1 text-base font-extrabold text-ink">Darajalar</h3>
        <p className="mb-4 text-sm text-ink-muted">Diagnostikada aniqlangan gapirish darajasi bo'yicha</p>
        {/*
          Rendered in the order the server sends — A0 to B2, then the unmeasured. Sorting a
          level scale by size would put B1 above A1 and turn a scale into a ranking.
        */}
        <BarList items={data.levels} format={formatNumber} labelWidth="w-24 sm:w-32" />
        <p className="mt-4 text-xs text-ink-faint">
          "Aniqlanmagan" — diagnostikadan o'tmagan va hali baholanmagan hisoblar.
        </p>
      </Card>
    </div>
  )
}

function VisitsTab({ data, period }: { data: DashboardData; period: string }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
    </div>
  )
}

/*
 * Kept apart from site traffic rather than folded into it. Somebody who puts a web page on
 * their home screen has said something a page view cannot: they intend to come back, and they
 * want it on the phone. That is the demand for a mobile app, measurable without having built
 * one.
 */
function AppTab({ data, period }: { data: DashboardData; period: string }) {
  /*
    Only when the API sends it. The panel and the API deploy separately, so one of them is
    older than the other on every release — and a whole dashboard that white-screens because
    one block is missing costs more than the block ever gave. The tab itself stays, so the row
    of tabs does not change shape between two deploys.
  */
  if (!data.installs) return <EmptyNote>Server hali o'rnatishlar hisobini yubormayapti.</EmptyNote>

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="O'rnatilgan qurilmalar"
          value={formatNumber(data.installs.devices)}
          note="Jami — bu davr emas"
        />
        <Stat
          label="Yangi o'rnatganlar"
          value={formatNumber(data.installs.newDevices)}
          note={
            data.installs.shareOfVisitors === null || data.installs.shareOfVisitors === undefined
              ? `Hali tashrif yozilmagan · ${period}`
              : `Tashrifchilarning ${formatPercent(data.installs.shareOfVisitors)} qismi · ${period}`
          }
        />
        <Stat
          label="Ilovadan ochilishlar"
          value={formatNumber(data.installs.launches)}
          note={`Bosh ekrandan ochilgan · ${period}`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-base font-extrabold text-ink">Qaysi telefonlarda</h3>
          {(data.installPlatforms ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">Hali hech kim o'rnatmagan</p>
          ) : (
            <BarList items={data.installPlatforms ?? []} format={formatNumber} labelWidth="w-20 sm:w-28" />
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-base font-extrabold text-ink">Kunlik yangi o'rnatishlar</h3>
          <ColumnChart points={data.installSeries ?? []} label="Qurilmalar" format={formatNumber} />
        </Card>
      </div>

      {/*
        Said because the number is easy to read as more than it is: it counts devices that
        have *opened* the app, not every install. An iPhone in particular is invisible until
        somebody opens it, because iOS sends no install event at all.
      */}
      <p className="mt-3 text-xs text-ink-faint">
        Bosh ekrandan kamida bir marta ochilgan qurilmalar sanaladi. O'rnatib, hech ochmagan
        qurilma bu yerda ko'rinmaydi — iOS o'rnatish haqida hech qanday signal yubormaydi.
      </p>
    </div>
  )
}

function RevenueTab({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-4 text-base font-extrabold text-ink">Obunalar</h3>
        {/* The legend carries the Free and PRO counts, so neither needs a card of its own. */}
        <Donut slices={data.plans} format={formatNumber} />
      </Card>

      <Card>
        <h3 className="mb-4 text-base font-extrabold text-ink">Tranzaksiyalar</h3>
        <ColumnChart points={data.transactions} label="To'lovlar" format={formatNumber} />
      </Card>
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
