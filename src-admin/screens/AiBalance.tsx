import { useState } from 'react'
import { adminFetch, formatDateTime, formatUsd, useAdminQuery } from '../lib/api'
import type { AdminAiBalance, AdminAiBalanceEntry, AiBalanceEntryKind } from '../lib/types'
import { LineChart } from '../components/charts'
import {
  Badge,
  Button,
  Card,
  Cell,
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  FieldLabel,
  Input,
  LoadingRows,
  PageHeader,
  Row,
  Screen,
  Segmented,
  Stat,
  Table,
} from '../components/ui'

/**
 * The Gemini balance. Google has no API for a key's prepaid balance, so it is kept here from
 * the top-ups and corrections entered below, minus the estimated cost of every call since.
 * Google's own charges show beside it when the billing export is connected.
 */
export function AiBalance() {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminAiBalance>('/api/admin-portal/ai-balance')
  const [removing, setRemoving] = useState<AdminAiBalanceEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function remove(entry: AdminAiBalanceEntry) {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/ai-balance/entries/${entry.id}`, { method: 'DELETE' })
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "O'chirib bo'lmadi.")
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  if (error) return <ErrorNote onRetry={refresh}>{error}</ErrorNote>
  if (!data && isLoading) return <LoadingRows />
  if (!data) return null

  // The API leaves null fields out, so "nothing entered yet" arrives as undefined.
  const balance = data.estimatedBalanceUsd ?? null
  const daysLeft = data.daysLeft ?? null

  return (
    <Screen className="space-y-6">
      <PageHeader
        title="Gemini balansi"
        subtitle="Taxminiy qoldiq, sarf va Google hisobidagi haqiqiy to'lovlar"
      />

      {data.depletion && <DepletionBanner depletion={data.depletion} />}
      {failure && <ErrorNote>{failure}</ErrorNote>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Taxminiy qoldiq"
          value={balance === null ? '—' : formatUsd(balance)}
          badge={balance === null ? undefined : data.low ? <Badge tone="danger">Kam qoldi</Badge> : <Badge tone="milestone">Yetarli</Badge>}
          note={balance === null
            ? "Birinchi to'lovni pastda kiriting"
            : `${formatUsd(data.warnBelowUsd)} dan kam bo'lsa ogohlantiradi`}
        />
        <Stat
          label="Kunlik o'rtacha sarf"
          value={formatUsd(data.dailyAverageUsd)}
          note="Oxirgi 7 kun bo'yicha"
        />
        <Stat
          label="Yetadi"
          value={daysLeft === null ? '—' : `${Math.floor(daysLeft)} kun`}
          note="Hozirgi sarf bilan"
        />
        <Stat
          label="Hisob boshlangandan beri"
          value={formatUsd(data.spentSinceUsd)}
          note={data.countedFrom ? `${formatDateTime(data.countedFrom)} dan` : 'Hali hisob yoʻq'}
        />
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-extrabold text-ink">Kunlik sarf — taxminiy (ilova hisobi)</h2>
          <span className="text-xs text-ink-muted">Har bir AI chaqiruv narxi va jonli ovoz daqiqalari</span>
        </div>
        <LineChart
          points={data.estimatedByDay.map((point) => ({ date: point.date, value: point.costUsd }))}
          label="Taxminiy kunlik sarf"
          format={formatUsd}
        />
      </Card>

      <GoogleCharges google={data.google} estimated={data.estimatedByDay} />

      <AddEntry onAdded={refresh} />

      <Card className="space-y-3">
        <h2 className="text-base font-extrabold text-ink">To'lovlar va tuzatishlar</h2>
        {data.entries.length === 0 ? (
          <EmptyNote>Hali hech narsa kiritilmagan.</EmptyNote>
        ) : (
          <Table head={['Sana', 'Turi', 'Summa', 'Izoh', 'Kim', '']}>
            {data.entries.map((entry) => (
              <Row key={entry.id}>
                <Cell>{formatDateTime(entry.effectiveAt)}</Cell>
                <Cell>
                  <Badge tone={entry.kind === 'TopUp' ? 'signal' : 'neutral'}>
                    {entry.kind === 'TopUp' ? "To'ldirish" : 'Tuzatish'}
                  </Badge>
                </Cell>
                <Cell>{formatUsd(entry.amountUsd)}</Cell>
                <Cell>{entry.note ?? '—'}</Cell>
                <Cell>{entry.createdBy ?? '—'}</Cell>
                <Cell>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(entry)}>
                    O'chirish
                  </Button>
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>

      {removing && (
        <ConfirmDialog
          title="Yozuv o'chirilsinmi?"
          body={`${removing.kind === 'TopUp' ? "To'ldirish" : 'Tuzatish'} · ${formatUsd(removing.amountUsd)} · ${formatDateTime(removing.effectiveAt)}`}
          confirmLabel="O'chirish"
          busy={busy}
          onConfirm={() => void remove(removing)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </Screen>
  )
}

function DepletionBanner({ depletion }: { depletion: NonNullable<AdminAiBalance['depletion']> }) {
  return (
    <div role="alert" className="rounded-[var(--radius-card)] border-2 border-danger bg-danger-soft px-5 py-4">
      <p className="text-base font-extrabold text-danger">
        {depletion.code === 'depleted' ? 'Gemini balansi tugadi' : "Gemini balansi tugagan bo'lishi mumkin"}
      </p>
      <p className="mt-1 text-sm text-ink">
        {depletion.code === 'depleted'
          ? `Google ${depletion.failedCalls} ta chaqiruvni to'lov yo'qligi sababli rad etdi (HTTP 402). `
          : `Oxirgi soatda ${depletion.failedCalls} ta chaqiruv HTTP 429 bilan rad etildi va birortasi o'tmadi. `}
        Oxirgi marta: {formatDateTime(depletion.lastSeenAt)}. AI Studio'da balansni to'ldiring — o'quvchilarda
        baholash va jonli suhbat ishlamayapti. Telegram'dagi ogohlantirish guruhiga ham xabar yuborildi.
      </p>
    </div>
  )
}

function GoogleCharges({
  google,
  estimated,
}: {
  google: AdminAiBalance['google']
  estimated: AdminAiBalance['estimatedByDay']
}) {
  const estimatedTotal = estimated.reduce((sum, point) => sum + point.costUsd, 0)

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-extrabold text-ink">Google hisobi — haqiqiy to'lovlar</h2>
        {google.state === 'ok' && google.readAt && (
          <span className="text-xs text-ink-muted">Yangilandi: {formatDateTime(google.readAt)} · 1 kungacha kechikadi</span>
        )}
      </div>

      {google.state === 'not_configured' && (
        <div className="space-y-2 text-sm text-ink-muted">
          <p>Ulanmagan. Google haqiqiy to'lovlarni faqat Cloud Billing eksportida beradi. Ulash uchun DevOps:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Cloud Billing › Billing export › BigQuery export (standard usage cost) ni yoqadi.</li>
            <li>BigQuery Job User va jadvalni o'qish huquqi bor service account yaratadi.</li>
            <li>
              Server env fayliga <code className="font-mono text-xs">GoogleBilling__ProjectId</code>,{' '}
              <code className="font-mono text-xs">GoogleBilling__Table</code> va{' '}
              <code className="font-mono text-xs">GoogleBilling__ServiceAccountJson</code> ni qo'shadi.
            </li>
          </ol>
        </div>
      )}

      {google.state === 'error' && <ErrorNote>Google hisobini o'qib bo'lmadi: {google.error}</ErrorNote>}

      {google.state === 'ok' && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Stat
              label="Google: 30 kun"
              value={`${(google.last30DaysTotal ?? 0).toFixed(2)} ${google.currency ?? ''}`}
              note="Kreditlar ayirilgan"
            />
            <Stat label="Ilova hisobi: 30 kun" value={formatUsd(estimatedTotal)} note="Taqqoslash uchun" />
          </div>
          <LineChart
            points={google.byDay.map((point) => ({ date: point.date, value: point.costUsd }))}
            label="Google kunlik to'lovi"
            format={(value) => `${value.toFixed(2)} ${google.currency ?? ''}`}
          />
        </>
      )}
    </Card>
  )
}

/** A top-up, or the balance read off AI Studio's billing page to correct the estimate. */
function AddEntry({ onAdded }: { onAdded: () => void }) {
  const [kind, setKind] = useState<AiBalanceEntryKind>('TopUp')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  const value = Number(amount.replace(',', '.'))
  const valid = amount.trim() !== '' && Number.isFinite(value) && value >= 0 && (kind === 'Correction' || value > 0)

  async function save() {
    if (!valid) return
    setBusy(true)
    setFailure('')
    try {
      await adminFetch('/api/admin-portal/ai-balance/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          amountUsd: value,
          effectiveAt: date ? new Date(date).toISOString() : null,
          note: note.trim() || null,
        }),
      })
      setAmount('')
      setDate('')
      setNote('')
      onAdded()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-extrabold text-ink">Yozuv qo'shish</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {kind === 'TopUp'
            ? "AI Studio'da balansni to'ldirganingizda summani kiriting."
            : "AI Studio billing sahifasidagi hozirgi qoldiqni kiriting — taxmin shu qiymatdan qayta hisoblanadi."}
        </p>
      </div>
      {failure && <ErrorNote>{failure}</ErrorNote>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FieldLabel label="Turi">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { id: 'TopUp', label: "To'ldirish" },
              { id: 'Correction', label: 'Tuzatish' },
            ]}
          />
        </FieldLabel>
        <FieldLabel label="Summa, USD">
          <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50" />
        </FieldLabel>
        <FieldLabel label="Sana (bo'sh — hozir)">
          <Input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
        </FieldLabel>
        <FieldLabel label="Izoh">
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Masalan: karta orqali" />
        </FieldLabel>
      </div>
      <Button disabled={!valid || busy} onClick={() => void save()}>
        {busy ? 'Saqlanmoqda…' : 'Saqlash'}
      </Button>
    </Card>
  )
}
