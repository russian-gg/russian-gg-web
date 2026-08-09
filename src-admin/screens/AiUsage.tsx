import { useState } from 'react'
import { formatDateTime, formatNumber, formatUsd, useAdminQuery } from '../lib/api'
import type { AiUsage as AiUsageData } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Cell,
  EmptyNote,
  ErrorNote,
  Loading,
  PageHeader,
  Pager,
  PeriodToggle,
  Row,
  Select,
  Stat,
  Table,
  TextField,
} from '../components/ui'
import { BarList, Donut, LineChart } from '../components/charts'

const PAGE_SIZE = 25

export function AiUsage() {
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [operation, setOperation] = useState('')

  const query = new URLSearchParams({ days: String(days), page: String(page), pageSize: String(PAGE_SIZE) })
  if (search) query.set('search', search)
  if (status) query.set('status', status)
  if (operation) query.set('operation', operation)

  const { data, error, isLoading } = useAdminQuery<AiUsageData>(`/api/admin-portal/ai-usage?${query}`)

  function find() {
    setPage(1)
    setSearch(draft.trim())
  }

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data && isLoading) return <Loading />
  if (!data) return null

  const hasCost = data.costByDay.some((point) => point.value > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="AI ishlatilishi" subtitle="AI chaqiruvlari jurnali: tokenlar, narx va status" />
        <PeriodToggle value={days} onChange={(next) => { setDays(next); setPage(1) }} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat label="Jami chaqiruvlar" value={formatNumber(data.totalCalls)} />
        <Stat label="Muvaffaqiyatli" value={formatNumber(data.succeeded)} />
        <Stat
          label="Xatoliklar"
          value={formatNumber(data.failed)}
          badge={data.failed > 0 ? <Badge tone="danger">xato</Badge> : undefined}
        />
        <Stat label="Jami tokenlar" value={formatNumber(data.totalTokens)} />
        {/*
          The note is the point, not decoration. This total once read under a dollar against
          fifty dollars of real billing, because the rate table was written for a model the
          product had moved off — and calls with no rate were summed as nothing. A total that
          silently leaves calls out is worse than no total, so it now says how many.
        */}
        <Stat
          label="Umumiy narx"
          value={formatUsd(data.totalCostUsd)}
          badge={
            data.unpricedCalls && data.unpricedCalls > 0 ? (
              <Badge tone="caution">to'liq emas</Badge>
            ) : undefined
          }
          note={
            data.unpricedCalls && data.unpricedCalls > 0
              ? `${formatNumber(data.unpricedCalls)} ta chaqiruv narxsiz — modeli uchun tarif kiritilmagan`
              : hasCost
                ? undefined
                : 'Provayder narxni qaytarmagan'
          }
        />
      </div>

      <Card>
        <h3 className="mb-3 text-base font-extrabold text-ink">Kunlar bo'yicha narx</h3>
        {hasCost ? (
          <LineChart points={data.costByDay} label="Kunlik narx" format={formatUsd} />
        ) : (
          /*
            An empty chart with an axis on it says "zero spend", which is a claim. Nothing
            was reported, which is a different thing and the one that is true.
          */
          <EmptyNote>Narx ma'lumoti yo'q — provayder javoblarida narx qaytmagan.</EmptyNote>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-base font-extrabold text-ink">Provayderlar bo'yicha</h3>
          <Donut slices={data.byProvider} format={formatNumber} />
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-extrabold text-ink">Operatsiyalar bo'yicha</h3>
          <BarList items={data.byOperation} format={formatNumber} labelWidth="w-28 sm:w-40" />
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TextField
          value={draft}
          onChange={setDraft}
          onSubmit={find}
          placeholder="Operatsiya / model / xato"
          className="w-full sm:w-72"
        />
        <Button onClick={find}>Topish</Button>
        <Select
          label="Operatsiya"
          value={operation}
          onChange={(value) => { setOperation(value); setPage(1) }}
          options={[
            { value: '', label: 'Barcha operatsiyalar' },
            ...data.byOperation.map((item) => ({ value: item.label, label: item.label })),
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={(value) => { setStatus(value); setPage(1) }}
          options={[
            { value: '', label: 'Barcha statuslar' },
            { value: 'success', label: 'Muvaffaqiyat' },
            { value: 'error', label: 'Xato' },
          ]}
        />
      </div>

      <Table head={['Vaqt', 'Operatsiya', 'Provayder', 'Model', 'Status', 'Tokenlar', 'Narx', 'Davomiyligi']}>
        {data.items.map((call) => (
          <Row key={call.id}>
            <Cell muted>{formatDateTime(call.occurredAt)}</Cell>
            <Cell strong>{call.operation}</Cell>
            <Cell muted>{call.provider}</Cell>
            <Cell muted>{call.model ?? '—'}</Cell>
            <Cell>
              {call.isSuccess ? (
                <Badge tone="milestone">Muvaffaqiyat</Badge>
              ) : (
                <Badge tone="danger">{call.errorCode ?? 'Xato'}</Badge>
              )}
            </Cell>
            {/*
              A dash where the provider said nothing, which is not the same as none — and
              `== null` rather than `=== null` because the API omits the field entirely.
            */}
            <Cell muted>{call.totalTokens == null ? '—' : formatNumber(call.totalTokens)}</Cell>
            <Cell muted>{call.costUsd == null ? '—' : formatUsd(call.costUsd)}</Cell>
            <Cell muted>{formatNumber(call.durationMs)} ms</Cell>
          </Row>
        ))}
        {data.items.length === 0 && (
          <tr>
            <td colSpan={8}>
              <EmptyNote>Bu davrda AI chaqiruvi yozilmagan</EmptyNote>
            </td>
          </tr>
        )}
      </Table>

      <Pager page={page} total={data.totalCalls} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  )
}
