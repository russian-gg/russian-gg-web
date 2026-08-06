import { useMemo, useState } from 'react'
import { adminFetch, formatDateTime, formatMoney, useAdminQuery } from '../lib/api'
import type { AdminPromoCode, BillingPeriod, PromoDiscountType } from '../lib/types'
import { Badge, Button, Card, Cell, EmptyNote, ErrorNote, Loading, PageHeader, Row, Table } from '../components/ui'

type FormState = {
  code: string
  period: BillingPeriod
  discountType: PromoDiscountType
  percentOff: string
  amountOffUzs: string
  validFrom: string
  validUntil: string
}

function localDateTimeValue(offsetDays = 0) {
  const value = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  const yyyy = value.getFullYear()
  const mm = `${value.getMonth() + 1}`.padStart(2, '0')
  const dd = `${value.getDate()}`.padStart(2, '0')
  const hh = `${value.getHours()}`.padStart(2, '0')
  const min = `${value.getMinutes()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

const initialForm = (): FormState => ({
  code: '',
  period: 'Monthly',
  discountType: 'Percentage',
  percentOff: '10',
  amountOffUzs: '',
  validFrom: localDateTimeValue(),
  validUntil: localDateTimeValue(7),
})

export function PromoCodes() {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminPromoCode[]>('/api/admin-portal/promo-codes')
  const [form, setForm] = useState<FormState>(initialForm)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  const activeCount = useMemo(() => data?.filter((item) => item.isActive).length ?? 0, [data])

  async function createPromoCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure('')

    try {
      await adminFetch<AdminPromoCode>('/api/admin-portal/promo-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim(),
          period: form.period,
          discountType: form.discountType,
          percentOff: form.discountType === 'Percentage' ? Number(form.percentOff) : null,
          amountOffTiyin: form.discountType === 'FixedAmount' ? Number(form.amountOffUzs || '0') * 100 : null,
          validFrom: new Date(form.validFrom).toISOString(),
          validUntil: new Date(form.validUntil).toISOString(),
        }),
      })

      setForm(initialForm())
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Promo code yaratib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Promo kodlar" subtitle="Chegirma kodlarini yaratish va kuzatish" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <Card as="div">
          <form onSubmit={createPromoCode} className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-ink">Yangi promo kod</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Kod nomini o'zingiz yozasiz. U avtomatik generatsiya qilinmaydi.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">Promo code</span>
              <input
                value={form.code}
                onChange={(event) => setForm((state) => ({ ...state, code: event.target.value.toUpperCase() }))}
                placeholder="MASALAN: BACK2SCHOOL"
                className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">Tarif</span>
                <select
                  value={form.period}
                  onChange={(event) => setForm((state) => ({ ...state, period: event.target.value as BillingPeriod }))}
                  className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-3 text-sm font-semibold text-ink focus:border-signal focus:outline-none"
                >
                  <option value="Monthly">30 kunlik</option>
                  <option value="NinetyDay">90 kunlik</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">Chegirma turi</span>
                <select
                  value={form.discountType}
                  onChange={(event) => setForm((state) => ({ ...state, discountType: event.target.value as PromoDiscountType }))}
                  className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-3 text-sm font-semibold text-ink focus:border-signal focus:outline-none"
                >
                  <option value="Percentage">Foiz</option>
                  <option value="FixedAmount">Summa</option>
                </select>
              </label>
            </div>

            {form.discountType === 'Percentage' ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">Foiz chegirma</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={form.percentOff}
                  onChange={(event) => setForm((state) => ({ ...state, percentOff: event.target.value }))}
                  className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink focus:border-signal focus:outline-none"
                />
              </label>
            ) : (
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">Chegirma summasi (UZS)</span>
                <input
                  type="number"
                  min={1}
                  value={form.amountOffUzs}
                  onChange={(event) => setForm((state) => ({ ...state, amountOffUzs: event.target.value }))}
                  className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink focus:border-signal focus:outline-none"
                />
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">Boshlanish</span>
                <input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(event) => setForm((state) => ({ ...state, validFrom: event.target.value }))}
                  className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-3 text-sm text-ink focus:border-signal focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-ink">Tugash</span>
                <input
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(event) => setForm((state) => ({ ...state, validUntil: event.target.value }))}
                  className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-3 text-sm text-ink focus:border-signal focus:outline-none"
                />
              </label>
            </div>

            {failure && <ErrorNote>{failure}</ErrorNote>}

            <Button type="submit" block disabled={busy}>
              {busy ? 'Yaratilmoqda...' : 'Promo kod yaratish'}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="signal">{activeCount} ta faol kod</Badge>
            {data && <Badge tone="neutral">{data.length} ta jami kod</Badge>}
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}
          {!data && isLoading && <Loading />}

          {data && (
            <Table head={['Kod', 'Tarif', 'Chegirma', 'Muddat', 'Holat', 'Ishlatilgan', 'Yaratilgan']}>
              {data.map((item) => (
                <Row key={item.id}>
                  <Cell strong>{item.code}</Cell>
                  <Cell muted>{item.period === 'Monthly' ? '30 kunlik' : '90 kunlik'}</Cell>
                  <Cell muted>
                    {item.discountType === 'Percentage'
                      ? `${item.percentOff}%`
                      : formatMoney((item.amountOffTiyin ?? 0) / 100, 'UZS')}
                  </Cell>
                  <Cell>
                    <div className="text-sm text-ink">{formatDateTime(item.validFrom)}</div>
                    <div className="text-xs text-ink-faint">{formatDateTime(item.validUntil)}</div>
                  </Cell>
                  <Cell>
                    <Badge tone={item.isActive ? 'milestone' : 'caution'}>{item.isActive ? 'Faol' : 'Nofaol'}</Badge>
                  </Cell>
                  <Cell muted>{item.usageCount}</Cell>
                  <Cell muted>{formatDateTime(item.createdAt)}</Cell>
                </Row>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyNote>Hali promo kod yaratilmagan</EmptyNote>
                  </td>
                </tr>
              )}
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
