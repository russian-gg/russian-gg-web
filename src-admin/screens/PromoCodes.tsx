import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useFocusTrap } from '../../src/lib/focus-trap'
import { cx } from '../../src/lib/cx'
import { Overlay } from '../../src/components/motion'
import { adminFetch, formatDateTime, formatMoney, formatNumber, useAdminQuery } from '../lib/api'
import type { AdminPromoCode, BillingPeriod, PromoDiscountType } from '../lib/types'
import {
  Badge,
  Button,
  Card,
  Cell,
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  LoadingRows,
  LoadingStats,
  PageHeader,
  Row,
  Screen,
  Stat,
  Table,
  Tabs,
  TextField,
} from '../components/ui'

type FormState = {
  code: string
  period: BillingPeriod
  discountType: PromoDiscountType
  percentOff: string
  amountOffUzs: string
  validFrom: string
  validUntil: string
}

type Status = 'active' | 'scheduled' | 'expired' | 'disabled'
type Filter = 'all' | Status

const STATUS: Record<Status, { label: string; tone: 'milestone' | 'signal' | 'caution' | 'neutral' }> = {
  active: { label: 'Faol', tone: 'milestone' },
  scheduled: { label: 'Rejalashtirilgan', tone: 'signal' },
  expired: { label: "Muddati o'tgan", tone: 'caution' },
  disabled: { label: "O'chirilgan", tone: 'neutral' },
}

const DAY = 24 * 60 * 60 * 1000

/**
 * What an operator means by "is this code working". The server's `isActive` already folds the
 * switch and the window together; splitting them back out tells the operator *why* a code is
 * not working — paused by hand, not started yet, or simply over.
 */
function statusOf(item: AdminPromoCode, now: number): Status {
  if (!item.isEnabled) return 'disabled'
  if (now < Date.parse(item.validFrom)) return 'scheduled'
  if (now > Date.parse(item.validUntil)) return 'expired'
  return 'active'
}

function toLocalInput(date: Date) {
  const pad = (value: number) => `${value}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const emptyForm = (): FormState => ({
  code: '',
  period: 'Monthly',
  discountType: 'Percentage',
  percentOff: '10',
  amountOffUzs: '',
  validFrom: toLocalInput(new Date()),
  validUntil: toLocalInput(new Date(Date.now() + 7 * DAY)),
})

const formFrom = (item: AdminPromoCode): FormState => ({
  code: item.code,
  period: item.period,
  discountType: item.discountType,
  percentOff: item.percentOff != null ? String(item.percentOff) : '10',
  amountOffUzs: item.amountOffTiyin != null ? String(item.amountOffTiyin / 100) : '',
  validFrom: toLocalInput(new Date(item.validFrom)),
  validUntil: toLocalInput(new Date(item.validUntil)),
})

function discountLabel(item: AdminPromoCode) {
  return item.discountType === 'Percentage'
    ? `−${item.percentOff}%`
    : `−${formatMoney((item.amountOffTiyin ?? 0) / 100, 'UZS')}`
}

export function PromoCodes() {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminPromoCode[]>('/api/admin-portal/promo-codes')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<AdminPromoCode | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AdminPromoCode | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toggling, setToggling] = useState<Record<string, boolean>>({})
  /*
    Server answers to a toggle, laid over the list until the next fetch lands. Without it the
    switch would flip, then flick back for the length of a refetch, then flip again.
  */
  const [patched, setPatched] = useState<Record<string, AdminPromoCode>>({})
  useEffect(() => setPatched({}), [data])

  // Re-read whenever the list changes, so statuses are as fresh as the data they describe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => Date.now(), [data, patched])
  const items = useMemo(() => (data ?? []).map((item) => patched[item.id] ?? item), [data, patched])

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: items.length, active: 0, scheduled: 0, expired: 0, disabled: 0 }
    for (const item of items) result[statusOf(item, now)] += 1
    return result
  }, [items, now])

  const totalUses = useMemo(() => items.reduce((sum, item) => sum + item.usageCount, 0), [items])

  const visible = useMemo(() => {
    const needle = query.trim().toUpperCase()
    return items.filter(
      (item) =>
        (filter === 'all' || statusOf(item, now) === filter) && (!needle || item.code.includes(needle)),
    )
  }, [items, filter, query, now])

  async function toggle(item: AdminPromoCode) {
    setActionError('')
    setToggling((state) => ({ ...state, [item.id]: true }))
    try {
      const next = await adminFetch<AdminPromoCode>(`/api/admin-portal/promo-codes/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !item.isEnabled }),
      })
      setPatched((state) => ({ ...state, [item.id]: next }))
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Holatni o'zgartirib bo'lmadi.")
    } finally {
      setToggling((state) => ({ ...state, [item.id]: false }))
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    setActionError('')
    try {
      await adminFetch<void>(`/api/admin-portal/promo-codes/${deleting.id}`, { method: 'DELETE' })
      setDeleting(null)
      refresh()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Promo kodni o'chirib bo'lmadi.")
      setDeleting(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <>
    <Screen className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Promo kodlar" subtitle="Chegirma kodlarini yaratish, tahrirlash va boshqarish" />
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
          Yangi promo kod
        </Button>
      </div>

      {!data && isLoading ? (
        <LoadingStats count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Faol" value={formatNumber(counts.active)} note="Hozir ishlatish mumkin" />
          <Stat label="Rejalashtirilgan" value={formatNumber(counts.scheduled)} note="Hali boshlanmagan" />
          <Stat
            label="Nofaol"
            value={formatNumber(counts.disabled + counts.expired)}
            note={`${counts.disabled} ta o'chirilgan · ${counts.expired} ta muddati o'tgan`}
          />
          <Stat label="Foydalanishlar" value={formatNumber(totalUses)} note="Kod bilan yaratilgan to'lovlar" />
        </div>
      )}

      <Card as="div" className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-full overflow-x-auto">
            <Tabs<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'all', label: `Hammasi · ${counts.all}` },
                { id: 'active', label: `Faol · ${counts.active}` },
                { id: 'scheduled', label: `Kutilmoqda · ${counts.scheduled}` },
                { id: 'expired', label: `Tugagan · ${counts.expired}` },
                { id: 'disabled', label: `O'chirilgan · ${counts.disabled}` },
              ]}
            />
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint"
            />
            <TextField value={query} onChange={setQuery} placeholder="Kod bo'yicha qidirish" className="w-full pl-10" />
          </div>
        </div>

        {actionError && <ErrorNote>{actionError}</ErrorNote>}
        {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
        {!data && isLoading && <LoadingRows />}

        {data && (
          <Table head={['Kod', 'Tarif', 'Chegirma', 'Amal qilish muddati', 'Holat', 'Ishlatilgan', 'Yoqilgan', '']}>
            {visible.map((item) => {
              const status = statusOf(item, now)
              return (
                <Row key={item.id}>
                  <Cell>
                    <CodeChip code={item.code} />
                    <div className="mt-1 text-xs text-ink-faint">{formatDateTime(item.createdAt)}</div>
                  </Cell>
                  <Cell muted>{item.period === 'Monthly' ? '30 kunlik' : '90 kunlik'}</Cell>
                  <Cell>
                    <span className="font-extrabold tabular-nums text-signal-ink">{discountLabel(item)}</span>
                  </Cell>
                  <Cell>
                    <ValidityWindow item={item} now={now} />
                  </Cell>
                  <Cell>
                    <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
                  </Cell>
                  <Cell muted>
                    <span className="tabular-nums">{formatNumber(item.usageCount)}</span>
                  </Cell>
                  <Cell>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.isEnabled}
                      aria-label={`${item.code} — ${item.isEnabled ? "o'chirish" : 'yoqish'}`}
                      disabled={toggling[item.id]}
                      onClick={() => void toggle(item)}
                      className="disabled:opacity-50"
                    >
                      <Switch checked={item.isEnabled} />
                    </button>
                  </Cell>
                  <Cell>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton label={`${item.code} — tahrirlash`} onClick={() => setEditing(item)}>
                        <Pencil aria-hidden="true" className="size-4" />
                      </IconButton>
                      <IconButton label={`${item.code} — o'chirish`} tone="danger" onClick={() => setDeleting(item)}>
                        <Trash2 aria-hidden="true" className="size-4" />
                      </IconButton>
                    </div>
                  </Cell>
                </Row>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyNote>
                    {items.length === 0 ? 'Hali promo kod yaratilmagan' : "Bu filtr bo'yicha kod topilmadi"}
                  </EmptyNote>
                </td>
              </tr>
            )}
          </Table>
        )}
      </Card>
    </Screen>

      {editing && (
        <PromoFormDialog
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Promo kodni o'chirish"
          body={
            <>
              <strong className="font-extrabold text-ink">{deleting.code}</strong> butunlay o'chiriladi.
              {deleting.usageCount > 0 && (
                <>
                  {' '}
                  U {deleting.usageCount} ta to'lovda ishlatilgan — to'lov tarixi saqlanadi, lekin kod endi
                  ishlamaydi. Vaqtincha to'xtatish uchun uni o'chirish o'rniga shunchaki o'chirib qo'ying.
                </>
              )}
            </>
          }
          confirmLabel="O'chirish"
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}

/* -------------------------------------------------------------------------------- pieces */

function CodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copied])

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => setCopied(true))
      }}
      title="Nusxa olish"
      aria-label={`${code} — nusxa olish`}
      className="group inline-flex items-center gap-2 rounded-[var(--radius-control)] border-2 border-dashed border-hairline bg-ground-sunken px-2.5 py-1 font-mono text-sm font-bold tracking-wide text-ink transition-colors hover:border-signal"
    >
      {code}
      {copied ? (
        <Check aria-hidden="true" className="size-3.5 text-milestone" strokeWidth={3} />
      ) : (
        <Copy aria-hidden="true" className="size-3.5 text-ink-faint group-hover:text-signal-ink" />
      )}
    </button>
  )
}

/** The two dates, and how far through them the code is — a bar reads faster than arithmetic. */
function ValidityWindow({ item, now }: { item: AdminPromoCode; now: number }) {
  const from = Date.parse(item.validFrom)
  const until = Date.parse(item.validUntil)
  const progress = Math.min(1, Math.max(0, (now - from) / Math.max(1, until - from)))

  let note: string
  if (now < from) note = `${Math.ceil((from - now) / DAY)} kundan keyin boshlanadi`
  else if (now > until) note = 'Tugagan'
  else note = `${Math.max(0, Math.ceil((until - now) / DAY))} kun qoldi`

  return (
    <div className="min-w-44">
      <div className="text-sm text-ink tabular-nums">
        {formatDateTime(item.validFrom)} → {formatDateTime(item.validUntil)}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ground-sunken">
          <div
            className={cx('h-full rounded-full', now > until ? 'bg-ink-faint' : 'bg-signal')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-xs whitespace-nowrap text-ink-faint">{note}</span>
      </div>
    </div>
  )
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-milestone' : 'bg-hairline',
      )}
    >
      <span
        className={cx(
          'inline-block size-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </span>
  )
}

function IconButton({
  label,
  onClick,
  tone = 'neutral',
  children,
}: {
  label: string
  onClick: () => void
  tone?: 'neutral' | 'danger'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] text-ink-muted transition-colors',
        tone === 'danger' ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-ground-sunken hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

const inputClass =
  'h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none'

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">{label}</span>
      {children}
    </label>
  )
}

/** Two-way choice drawn as a segmented control: both options stay visible, unlike a select. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ id: T; label: string }>
}) {
  return (
    <div className="grid grid-cols-2 rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cx(
            'rounded-[var(--radius-control)] py-1.5 text-sm font-bold transition-colors',
            value === option.id ? 'bg-signal text-on-signal' : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Create and edit share one form: an edit is a create that starts filled in. */
function PromoFormDialog({
  item,
  onClose,
  onSaved,
}: {
  item: AdminPromoCode | null
  onClose: () => void
  onSaved: () => void
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const [form, setForm] = useState<FormState>(() => (item ? formFrom(item) : emptyForm()))
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((state) => ({ ...state, [key]: value }))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure('')

    try {
      await adminFetch<AdminPromoCode>(
        item ? `/api/admin-portal/promo-codes/${item.id}` : '/api/admin-portal/promo-codes',
        {
          method: item ? 'PUT' : 'POST',
          body: JSON.stringify({
            code: form.code.trim(),
            period: form.period,
            discountType: form.discountType,
            percentOff: form.discountType === 'Percentage' ? Number(form.percentOff) : null,
            amountOffTiyin:
              form.discountType === 'FixedAmount' ? Math.round(Number(form.amountOffUzs || '0') * 100) : null,
            validFrom: new Date(form.validFrom).toISOString(),
            validUntil: new Date(form.validUntil).toISOString(),
          }),
        },
      )
      onSaved()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Promo kodni saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay open onDismiss={busy ? undefined : onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={item ? 'Promo kodni tahrirlash' : 'Yangi promo kod'}
        className="max-h-full w-full max-w-lg overflow-y-auto"
      >
        <Card as="div" className="w-full" onClick={(event) => event.stopPropagation()}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-ink">{item ? 'Promo kodni tahrirlash' : 'Yangi promo kod'}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {item && item.usageCount > 0
                  ? `Bu kod ${item.usageCount} marta ishlatilgan. O'zgarishlar faqat yangi to'lovlarga ta'sir qiladi.`
                  : "Kod nomini o'zingiz yozasiz — u avtomatik yaratilmaydi."}
              </p>
            </div>

            <FieldLabel label="Promo kod">
              <input
                value={form.code}
                onChange={(event) => set('code', event.target.value.toUpperCase().replace(/\s+/g, ''))}
                placeholder="MASALAN: BACK2SCHOOL"
                maxLength={64}
                required
                autoFocus
                className={cx(inputClass, 'font-mono font-bold tracking-wide')}
              />
            </FieldLabel>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Tarif">
                <Segmented<BillingPeriod>
                  value={form.period}
                  onChange={(value) => set('period', value)}
                  options={[
                    { id: 'Monthly', label: '30 kun' },
                    { id: 'NinetyDay', label: '90 kun' },
                  ]}
                />
              </FieldLabel>
              <FieldLabel label="Chegirma turi">
                <Segmented<PromoDiscountType>
                  value={form.discountType}
                  onChange={(value) => set('discountType', value)}
                  options={[
                    { id: 'Percentage', label: 'Foiz' },
                    { id: 'FixedAmount', label: 'Summa' },
                  ]}
                />
              </FieldLabel>
            </div>

            {form.discountType === 'Percentage' ? (
              <FieldLabel label="Foiz chegirma (1–99)">
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={form.percentOff}
                    onChange={(event) => set('percentOff', event.target.value)}
                    className={cx(inputClass, 'pr-10')}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-bold text-ink-faint">
                    %
                  </span>
                </div>
              </FieldLabel>
            ) : (
              <FieldLabel label="Chegirma summasi">
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.amountOffUzs}
                    onChange={(event) => set('amountOffUzs', event.target.value)}
                    className={cx(inputClass, 'pr-14')}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-bold text-ink-faint">
                    UZS
                  </span>
                </div>
              </FieldLabel>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Boshlanish">
                <input
                  type="datetime-local"
                  required
                  value={form.validFrom}
                  onChange={(event) => set('validFrom', event.target.value)}
                  className={cx(inputClass, 'px-3')}
                />
              </FieldLabel>
              <FieldLabel label="Tugash">
                <input
                  type="datetime-local"
                  required
                  value={form.validUntil}
                  onChange={(event) => set('validUntil', event.target.value)}
                  className={cx(inputClass, 'px-3')}
                />
              </FieldLabel>
            </div>

            {failure && <ErrorNote>{failure}</ErrorNote>}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Bekor qilish
              </Button>
              <Button type="submit" disabled={busy || !form.code.trim()}>
                {busy ? 'Saqlanmoqda…' : item ? 'Saqlash' : 'Yaratish'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </Overlay>
  )
}
