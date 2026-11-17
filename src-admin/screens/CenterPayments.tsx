import { useState } from 'react'
import { CalendarClock, CreditCard, Plus, Tag, Users } from 'lucide-react'
import { adminFetch, formatDate, formatDayLong, useAdminQuery } from '../lib/api'
import {
  centerPlanIds,
  centerPlans,
  type CenterInvoice,
  type CenterOverview,
  type CenterPayView,
  type CenterPlan,
} from '../lib/center-types'
import { copyText, formatPeriod, formatSom, payLink, planFrame, todayIso } from '../lib/center-format'
import {
  Badge,
  Button,
  Card,
  Cell,
  ConfirmDialog,
  ErrorNote,
  LoadingRows,
  Row,
  Screen,
  SectionHeading,
  Table,
} from '../components/ui'
import { InvoiceBadge, InvoiceLines, PayButtons, PlanBadge, PlanFacts } from '../components/center'
import { CardTitle } from '../components/center-ui'
import { toast } from '../lib/toast'

/*
 * Everything a center has to know about money, on one page: what it owes this month and how
 * that was counted, the plan it is on and the other one it could be on, and what it has paid
 * before. The other pages only point here.
 */

const BASE = '/api/center-portal'

export function CenterPaymentsScreen({ onAddStudents }: { onAddStudents: () => void }) {
  const overview = useAdminQuery<CenterOverview>(`${BASE}/overview`)
  const invoices = useAdminQuery<CenterInvoice[]>(`${BASE}/invoices`)

  // A plan change recounts the unpaid invoice, so the list is asked for again with the overview.
  const refresh = () => {
    overview.refresh()
    invoices.refresh()
  }

  return (
    <Screen className="space-y-6">
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">To'lovlar</h1>
          <p className="mt-1 text-sm text-ink-muted">Bu oy to'lovi, tarif va hisob-fakturalar</p>
        </header>

        {overview.error && <ErrorNote onRetry={overview.refresh}>{overview.error}</ErrorNote>}
        {!overview.data && !overview.error && <LoadingRows />}

        {/*
          What is owed beside the plan it is owed on, in equal halves; the invoices under both,
          at full width. A narrower money column cut the Payme button off and made the invoice
          table scroll sideways.
        */}
        {overview.data && (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <ThisMonthCard overview={overview.data} onAddStudents={onAddStudents} />
            <PlanCard overview={overview.data} onChanged={refresh} />
          </div>
        )}

        <section>
          <SectionHeading>Hisob-fakturalar</SectionHeading>
          {invoices.error && <ErrorNote onRetry={invoices.refresh}>{invoices.error}</ErrorNote>}
          {!invoices.data && !invoices.error && <LoadingRows rows={3} />}
          {invoices.data && invoices.data.length === 0 && (
            <Card as="div" className="text-sm text-ink-muted">
              Hali hisob-faktura yo'q. Birinchisi birinchi o'quvchilar qo'shilganda paydo bo'ladi.
            </Card>
          )}
          {invoices.data && invoices.data.length > 0 && <InvoicesTable invoices={invoices.data} />}
        </section>
      </div>
    </Screen>
  )
}

/**
 * What is owed now. An open invoice shows its sum, the lines it is made of and Click / Payme
 * right beside them; the same pay link works for whoever at the center holds the money, without
 * a login. With nothing open it says until when the center has paid and what the next month
 * will cost at today's head count.
 */
function ThisMonthCard({ overview, onAddStudents }: { overview: CenterOverview; onAddStudents: () => void }) {
  const open = overview.openInvoice
  const pay = useAdminQuery<CenterPayView>(open ? `/api/public/center-pay/${open.payToken}` : null)
  // A plan change that is waiting starts with the next month, so the estimate uses its price.
  const nextPrice = overview.pendingPricePerSeatTiyin ?? overview.pricePerSeatTiyin

  return (
    <Card as="section" aria-labelledby="month-title" className={open ? 'space-y-4 border-signal' : 'space-y-4'}>
      <CardTitle id="month-title" Icon={CreditCard} title="Bu oy" action={open && <InvoiceBadge status={open.status} />} />

      {open ? (
        <div className="space-y-5">
          <div className="grid items-center gap-4 sm:grid-cols-2">
            <div>
              <div className="text-3xl font-extrabold tabular-nums text-ink">{formatSom(open.amountTiyin)}</div>
              <p className="mt-1 text-sm text-ink-muted">{formatPeriod(open.periodStart, open.periodEnd)}</p>
            </div>
            <InvoiceLines seats={open.seats} arrearsSeats={open.arrearsSeats} pricePerSeatTiyin={open.pricePerSeatTiyin} />
          </div>
          <div className="space-y-3 border-t-2 border-hairline pt-5">
            {pay.data ? (
              <PayButtons
                token={open.payToken}
                providers={pay.data.providers}
                returnUrl={payLink(open.payToken)}
                amountTiyin={open.amountTiyin}
              />
            ) : (
              pay.error && <ErrorNote onRetry={pay.refresh}>{pay.error}</ErrorNote>
            )}
            <p className="text-xs text-ink-muted">
              Hisobchi to'lashi kerakmi?{' '}
              <button
                type="button"
                className="font-bold text-signal-ink hover:underline"
                onClick={() => void copyText(payLink(open.payToken), "To'lov havolasi nusxalandi")}
              >
                To'lov havolasini nusxalang
              </button>{' '}
              — login kerak emas. Bank o'tkazmasini Russian.gg jamoasi tasdiqlaydi.
            </p>
          </div>
        </div>
      ) : overview.paidThrough ? (
        <div className="space-y-1 sm:pl-12">
          <p className="text-base font-bold text-ink">{formatDayLong(overview.paidThrough)}gacha to'langan</p>
          {overview.activeStudents > 0 && (
            <p className="text-sm text-ink">
              Keyingi oy: {overview.activeStudents} faol o'quvchi × {formatSom(nextPrice)} ={' '}
              <b className="tabular-nums">{formatSom(overview.activeStudents * nextPrice)}</b>
            </p>
          )}
          <p className="text-sm text-ink-muted">
            Keyingi oy uchun hisob-faktura muddat tugashidan 7 kun oldin shu yerda paydo bo'ladi.
          </p>
        </div>
      ) : overview.activeStudents === 0 ? (
        <div className="space-y-3 rounded-[var(--radius-card)] bg-ground-sunken p-4">
          <div className="flex items-start gap-3">
            <Users aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-ink-faint" strokeWidth={1.6} />
            <div className="min-w-0">
              <p className="text-base font-extrabold text-ink">Hozircha to'lov yo'q</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
                To'lov faol o'quvchilar soniga qarab hisoblanadi: {formatSom(overview.pricePerSeatTiyin)} × o'quvchi, har oy.
                Birinchi o'quvchilar qo'shilganda hisob-faktura shu yerda paydo bo'ladi.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onAddStudents}>
            <span className="flex items-center gap-1.5">
              <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
              O'quvchi qo'shish
            </span>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-muted sm:pl-12">Hozircha to'lanadigan hisob-faktura yo'q.</p>
      )}
    </Card>
  )
}

/**
 * The two plans side by side, the center's own marked. Switching is asked about first, with the
 * two things that change spelled out: the monthly sum for the students it has now, and the day
 * the new plan starts — at once when nothing is paid ahead, otherwise after the paid month, so
 * nobody loses what they already paid for.
 */
function PlanCard({ overview, onChanged }: { overview: CenterOverview; onChanged: () => void }) {
  const [asking, setAsking] = useState<CenterPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  const pending = overview.pendingPlan ?? null
  const paidAhead = Boolean(overview.paidThrough && overview.paidThrough >= todayIso())

  /** Posting the plan the center is on withdraws a change that is waiting. */
  async function choose(plan: CenterPlan) {
    setBusy(true)
    setFailure('')
    try {
      const next = await adminFetch<CenterOverview>(`${BASE}/plan`, { method: 'POST', body: JSON.stringify({ plan }) })
      const label = centerPlans[plan].label
      toast(
        plan === overview.plan
          ? "Tarif o'zgarishi bekor qilindi"
          : next.pendingPlan === plan && next.pendingPlanFrom
            ? `“${label}” tarifi ${formatDayLong(next.pendingPlanFrom)}dan boshlanadi`
            : `Tarif almashtirildi: ${label}`,
      )
      setAsking(null)
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Tarifni o'zgartirib bo'lmadi.")
      setAsking(null)
    } finally {
      setBusy(false)
    }
  }

  const askingPrice = asking ? centerPlans[asking].listPriceSom * 100 : 0

  return (
    <Card as="section" aria-labelledby="plan-title" className="space-y-4">
      <CardTitle id="plan-title" Icon={Tag} title="Tarif" subtitle="Narx bitta faol o'quvchi uchun, bir oyga" />

      {pending && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border-2 border-signal bg-signal-soft px-4 py-3"
        >
          <CalendarClock aria-hidden="true" className="size-5 shrink-0 text-signal-ink" strokeWidth={1.8} />
          <span className="min-w-0 flex-1 text-sm font-bold text-ink">
            {formatDayLong(overview.pendingPlanFrom)}dan boshlab: {centerPlans[pending].label}
            {overview.pendingPricePerSeatTiyin != null && ` · ${formatSom(overview.pendingPricePerSeatTiyin)} / o'quvchi / oy`}
          </span>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void choose(overview.plan)}>
            Bekor qilish
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {centerPlanIds.map((plan) => {
          const current = plan === overview.plan
          const waiting = plan === pending
          return (
            <div key={plan} className={planFrame(current)}>
              <PlanFacts
                plan={plan}
                // The center's own price can differ from the list; a switch always uses the list.
                priceTiyin={current ? overview.pricePerSeatTiyin : waiting ? (overview.pendingPricePerSeatTiyin ?? undefined) : undefined}
                mark={
                  current ? (
                    <Badge tone="milestone">Hozirgi tarif</Badge>
                  ) : waiting ? (
                    <Badge tone="signal">{formatDayLong(overview.pendingPlanFrom)}dan</Badge>
                  ) : undefined
                }
              />
              {!current && !waiting && (
                <div className="mt-auto pt-1">
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => setAsking(plan)}>
                    Tarifni almashtirish
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {failure && <ErrorNote>{failure}</ErrorNote>}

      {asking && (
        <ConfirmDialog
          title={`“${centerPlans[asking].label}” tarifiga o'tish`}
          body={
            <span className="block space-y-2">
              <span className="block">
                Yangi oylik to'lov:{' '}
                {overview.activeStudents > 0 ? (
                  <>
                    {overview.activeStudents} faol o'quvchi × {formatSom(askingPrice)} ={' '}
                    <b className="text-ink">{formatSom(overview.activeStudents * askingPrice)}</b>
                  </>
                ) : (
                  <b className="text-ink">{formatSom(askingPrice)} / o'quvchi</b>
                )}
              </span>
              <span className="block">
                Boshlanishi:{' '}
                <b className="text-ink">
                  {paidAhead ? `to'langan oy tugagach (${formatDayLong(overview.paidThrough)}dan keyin)` : 'darhol'}
                </b>
                {!paidAhead && overview.openInvoice && '. Ochiq hisob-faktura yangi narx bo\'yicha qayta hisoblanadi'}
              </span>
            </span>
          }
          confirmLabel="Almashtirish"
          confirmVariant="primary"
          busy={busy}
          onConfirm={() => void choose(asking)}
          onCancel={() => setAsking(null)}
        />
      )}
    </Card>
  )
}

/** A center is not shown which of the team marked a bank transfer — only that it was one. */
const paidHow = (via: string | null) => (!via ? '' : via === 'click' ? 'Click' : via === 'payme' ? 'Payme' : "Bank o'tkazmasi")

function InvoicesTable({ invoices }: { invoices: CenterInvoice[] }) {
  return (
    <Table head={['Davr', "O'quvchilar", 'Tarif', 'Summa', 'Holat', "To'langan"]}>
      {invoices.map((invoice) => (
        <Row key={invoice.id}>
          <Cell>{formatPeriod(invoice.periodStart, invoice.periodEnd)}</Cell>
          <Cell>
            <span className="tabular-nums">{invoice.seats}</span>
            {invoice.arrearsSeats > 0 && (
              <span className="ml-1 text-ink-muted tabular-nums" title="O'tgan oy qo'shilgan o'quvchilar">
                +{invoice.arrearsSeats}
              </span>
            )}
          </Cell>
          <Cell>
            <PlanBadge plan={invoice.plan} />
          </Cell>
          <Cell strong>{formatSom(invoice.amountTiyin)}</Cell>
          <Cell>
            <InvoiceBadge status={invoice.status} />
          </Cell>
          <Cell muted>
            {invoice.paidAt ? (
              <>
                {formatDate(invoice.paidAt)}
                <span className="block text-xs">{paidHow(invoice.paidVia)}</span>
              </>
            ) : (
              '—'
            )}
          </Cell>
        </Row>
      ))}
    </Table>
  )
}
