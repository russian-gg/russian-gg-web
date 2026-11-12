import { useState } from 'react'
import { ChevronLeft, Copy, ExternalLink } from 'lucide-react'
import { adminFetch, formatDate, formatDateTime, useAdminQuery } from '../lib/api'
import {
  centerStatusLabel,
  leadStatusLabel,
  somFromTiyin,
  type AdminCenterDetail,
  type AdminCenterInvoice,
  type AdminCenterLead,
  type AdminCenterRow,
  type CenterInvoice,
  type CenterStatus,
  type CenterStudent,
  type LeadStatus,
} from '../lib/center-types'
import {
  Badge,
  Button,
  Card,
  Cell,
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  LoadingRows,
  PageHeader,
  Row,
  Screen,
  SectionHeading,
  Select,
  Stat,
  Table,
  Tabs,
} from '../components/ui'
import { AccessBadge, Field, FormDialog, InvoiceBadge, PhoneField, StudentDrawer, StudentsTable } from '../components/center'
import {
  fieldClass,
  formatPeriod,
  formatSom,
  formatUzPhone,
  maskUzLocal,
  payLink,
  todayIso,
  toUzPhone,
  uzLocalDigits,
} from '../lib/center-format'
import { toast } from '../lib/toast'

/*
 * The team's side of the B2B offer. A center exists because a contract was signed: it is made
 * here, by an admin, with its student limit and price; it pays up front, a month at a time,
 * through the pay link on its invoice; its own admin login is handed over from here.
 */

type Tab = 'centers' | 'leads' | 'invoices'

export function Centers() {
  const [tab, setTab] = useState<Tab>('centers')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ lead?: AdminCenterLead } | null>(null)
  const leads = useAdminQuery<AdminCenterLead[]>('/api/admin-portal/center-leads')
  const newLeads = leads.data?.filter((lead) => lead.status === 'new').length ?? 0

  if (openId) {
    return <CenterDetail id={openId} onBack={() => setOpenId(null)} />
  }

  return (
    <Screen className="space-y-6">
      <PageHeader title="O'quv markazlari" subtitle="B2B: markazlar, demo so'rovlari va oldindan to'lanadigan hisob-fakturalar" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: 'centers', label: 'Markazlar' },
            { id: 'leads', label: "Demo so'rovlari", badge: newLeads || undefined },
            { id: 'invoices', label: 'Hisob-fakturalar' },
          ]}
        />
        {tab === 'centers' && <Button onClick={() => setCreating({})}>+ Markaz qo'shish</Button>}
      </div>

      {tab === 'centers' && <CentersList onOpen={setOpenId} />}
      {tab === 'leads' && (
        <LeadsList
          leads={leads.data}
          error={leads.error}
          refresh={leads.refresh}
          onCreateCenter={(lead) => setCreating({ lead })}
          onOpenCenter={setOpenId}
        />
      )}
      {tab === 'invoices' && <InvoicesList onOpenCenter={setOpenId} />}

      {creating && (
        <CenterForm
          lead={creating.lead}
          onClose={() => setCreating(null)}
          onSaved={(detail) => {
            setCreating(null)
            leads.refresh()
            setOpenId(detail.id)
          }}
        />
      )}
    </Screen>
  )
}

function StatusBadge({ status }: { status: CenterStatus }) {
  return (
    <Badge tone={status === 'active' ? 'milestone' : status === 'suspended' ? 'caution' : 'neutral'}>
      {centerStatusLabel[status]}
    </Badge>
  )
}

/** "12 / 50" with a thin bar under it: how much of what the center bought is in use. */
function LimitMeter({ used, max }: { used: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
  return (
    <div className="min-w-24">
      <span className="tabular-nums">
        {used} <span className="text-ink-muted">/ {max}</span>
      </span>
      <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-ground-sunken">
        <div className={percent >= 100 ? 'h-full bg-caution' : 'h-full bg-signal'} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function CentersList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminCenterRow[]>('/api/admin-portal/centers')

  if (error) return <ErrorNote onRetry={refresh}>{error}</ErrorNote>
  if (isLoading && !data) return <LoadingRows />
  if (!data || data.length === 0) return <EmptyNote>Hali markaz yo'q. Shartnoma imzolangach shu yerda qo'shing.</EmptyNote>

  const totalSeats = data.reduce((sum, center) => sum + center.activeStudents, 0)
  const unpaid = data.reduce((sum, center) => sum + center.openAmountTiyin, 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Faol markazlar" value={data.filter((c) => c.status === 'active').length} />
        <Stat label="Faol o'quvchilar" value={totalSeats} note={`${data.reduce((sum, c) => sum + c.maxStudents, 0)} ta joydan`} />
        <Stat
          label="To'lanmagan"
          value={formatSom(unpaid)}
          note={`${data.filter((c) => c.overdue).length} ta markazda muddati o'tgan`}
        />
      </div>
      <Table head={['Markaz', 'Holat', 'Pro', "O'quvchilar", "To'langan muddat", 'Qarz', 'Admin', 'Kod']}>
        {data.map((center) => (
          <Row key={center.id} onClick={() => onOpen(center.id)} label={center.name}>
            <Cell strong>
              {center.name}
              {center.city && <span className="block text-xs font-normal text-ink-muted">{center.city}</span>}
            </Cell>
            <Cell>
              <StatusBadge status={center.status} />
            </Cell>
            <Cell>
              <AccessBadge access={center.access} />
            </Cell>
            <Cell>
              <LimitMeter used={center.activeStudents} max={center.maxStudents} />
              {center.requested > 0 && <span className="text-xs text-signal-ink">+{center.requested} so'rov</span>}
            </Cell>
            <Cell muted>{center.paidThrough ? `${formatDate(center.paidThrough)} gacha` : '—'}</Cell>
            <Cell>
              {center.openAmountTiyin > 0 ? (
                <span className={center.overdue ? 'font-bold text-danger' : 'text-ink'}>{formatSom(center.openAmountTiyin)}</span>
              ) : (
                <span className="text-ink-faint">—</span>
              )}
            </Cell>
            <Cell muted>{center.admins.join(', ') || '—'}</Cell>
            <Cell>
              <span className="font-mono">{center.joinCode}</span>
            </Cell>
          </Row>
        ))}
      </Table>
    </div>
  )
}

// ------------------------------------------------------------------------------- create / edit

function CenterForm({
  center,
  lead,
  onClose,
  onSaved,
}: {
  center?: AdminCenterDetail
  lead?: AdminCenterLead
  onClose: () => void
  onSaved: (detail: AdminCenterDetail) => void
}) {
  const [name, setName] = useState(center?.name ?? lead?.centerName ?? '')
  const [city, setCity] = useState(center?.city ?? lead?.city ?? '')
  const [contactName, setContactName] = useState(center?.contactName ?? lead?.contactName ?? '')
  const [contactPhone, setContactPhone] = useState(() => {
    const stored = center?.contactPhone ?? lead?.phone ?? ''
    const local = uzLocalDigits(stored)
    return local ? maskUzLocal(local) : ''
  })
  const [maxStudents, setMaxStudents] = useState(center ? String(center.maxStudents) : '')
  const [price, setPrice] = useState(String(center ? somFromTiyin(center.pricePerSeatTiyin) : 99000))
  const [contractStartsOn, setContractStartsOn] = useState(center?.contractStartsOn ?? todayIso())
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  const seats = Number(maxStudents)
  const priceSom = Number(price.replace(/\s/g, ''))
  const phoneOk = contactPhone.trim() === '' || Boolean(toUzPhone(contactPhone))
  const seatsOk = Number.isInteger(seats) && seats >= 1 && seats <= 10_000
  const valid = name.trim().length >= 2 && phoneOk && seatsOk && priceSom >= 1000

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!valid) return

    setBusy(true)
    setFailure('')
    try {
      const detail = await adminFetch<AdminCenterDetail>(
        center ? `/api/admin-portal/centers/${center.id}` : '/api/admin-portal/centers',
        {
          method: center ? 'PATCH' : 'POST',
          body: JSON.stringify({
            name: name.trim(),
            city,
            contactName,
            contactPhone: toUzPhone(contactPhone) ?? '',
            maxStudents: seats,
            pricePerSeatSom: priceSom,
            contractStartsOn: contractStartsOn || null,
            leadId: lead?.id ?? null,
          }),
        },
      )
      toast(center ? 'Markaz saqlandi' : 'Markaz yaratildi — birinchi hisob-faktura tayyor')
      onSaved(detail)
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  const monthly = seatsOk && priceSom > 0 ? seats * priceSom * 100 : null

  return (
    <FormDialog title={center ? 'Markazni tahrirlash' : 'Yangi markaz'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Markaz nomi">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
              maxLength={120}
              aria-invalid={submitted && name.trim().length < 2}
            />
          </Field>
          <Field label="Shahar">
            <input value={city} onChange={(event) => setCity(event.target.value)} className={fieldClass} placeholder="Toshkent" />
          </Field>
          <Field label="Mas'ul shaxs">
            <input value={contactName} onChange={(event) => setContactName(event.target.value)} className={fieldClass} />
          </Field>
          <PhoneField label="Telefon" value={contactPhone} onChange={setContactPhone} showError={submitted} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="O'quvchilar limiti" hint="Markaz shundan ko'p o'quvchini faollashtira olmaydi">
            <input
              value={maxStudents}
              onChange={(event) => setMaxStudents(event.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              placeholder="50"
              className={fieldClass}
              aria-invalid={submitted && !seatsOk}
            />
            {submitted && !seatsOk && <span className="mt-1 block text-xs text-danger">1 dan 10 000 gacha son kiriting</span>}
          </Field>
          <Field label="Narx, so'm / o'quvchi / oy">
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value.replace(/[^\d\s]/g, ''))}
              inputMode="numeric"
              className={fieldClass}
            />
          </Field>
          <Field label="Shartnoma boshlanishi" hint="Shu kundan Pro ochiladi">
            <input type="date" value={contractStartsOn} onChange={(event) => setContractStartsOn(event.target.value)} className={fieldClass} />
          </Field>
        </div>

        <div className="rounded-[var(--radius-control)] bg-ground-sunken px-4 py-3 text-sm text-ink-muted">
          Markaz oldindan to'laydi: har oy <b className="text-ink">{seatsOk ? seats : '…'}</b> o'quvchi ×{' '}
          {formatSom(Math.max(0, priceSom) * 100)}
          {monthly !== null && (
            <>
              {' '}= <b className="text-ink">{formatSom(monthly)}</b>
            </>
          )}
          . O'quvchilarga Pro faqat to'langan oy ichida ochiq bo'ladi.
        </div>

        {failure && <ErrorNote>{failure}</ErrorNote>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button size="sm" type="submit" disabled={busy}>
            {busy ? 'Saqlanmoqda…' : center ? 'Saqlash' : 'Markazni yaratish'}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

// ------------------------------------------------------------------------------- detail

function CenterDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, error, refresh } = useAdminQuery<AdminCenterDetail>(`/api/admin-portal/centers/${id}`)
  const students = useAdminQuery<CenterStudent[]>(`/api/admin-portal/centers/${id}/students`)
  const [editing, setEditing] = useState(false)
  const [openSeat, setOpenSeat] = useState<string | null>(null)

  const reload = () => {
    refresh()
    students.refresh()
  }

  return (
    <Screen className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <span className="flex items-center gap-1.5">
            <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={1.8} />
            Markazlar
          </span>
        </Button>
      </div>

      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
      {!data && !error && <LoadingRows />}

      {data && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">{data.name}</h1>
                <StatusBadge status={data.status} />
                <AccessBadge access={data.overview.access} />
              </div>
              <p className="mt-1.5 text-sm text-ink-muted">
                {[data.city, data.contactName].filter(Boolean).join(' · ')}
                {data.contactPhone && (
                  <>
                    {(data.city || data.contactName) && ' · '}
                    <a href={`tel:${data.contactPhone}`} className="text-signal-ink hover:underline">
                      {formatUzPhone(data.contactPhone)}
                    </a>
                  </>
                )}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Tahrirlash
            </Button>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Faol o'quvchilar"
              value={
                <>
                  {data.overview.activeStudents}
                  <span className="text-lg text-ink-faint"> / {data.maxStudents}</span>
                </>
              }
              note={`${Math.max(0, data.maxStudents - data.overview.activeStudents)} ta joy bo'sh · ${data.overview.notSignedIn} tasi hali kirmagan`}
            />
            <Stat
              label="To'langan muddat"
              value={data.paidThrough ? formatDate(data.paidThrough) : "To'lanmagan"}
              note={accessNote(data)}
            />
            <Stat label="Bu hafta mashq qilgan" value={`${data.overview.weeklyActivePercent}%`} note="faol o'quvchilardan" />
            <Stat label="Xavf ostida" value={data.overview.atRisk} note="7+ kun kirmagan yoki ortda qolgan" />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              <PaymentCard detail={data} onChanged={refresh} />

              <section>
                <SectionHeading>O'quvchilar · {students.data?.length ?? '…'}</SectionHeading>
                {students.error && <ErrorNote onRetry={students.refresh}>{students.error}</ErrorNote>}
                {!students.data && !students.error && <LoadingRows />}
                {students.data && students.data.length === 0 && (
                  <Card as="div" className="text-sm text-ink-muted">
                    Markaz hali o'quvchi qo'shmagan. Ular markaz paneli orqali yoki <b className="font-mono text-ink">{data.joinCode}</b>{' '}
                    kodi bilan qo'shiladi.
                  </Card>
                )}
                {students.data && students.data.length > 0 && (
                  <StudentsTable students={students.data} onOpen={(student) => setOpenSeat(student.seatId)} />
                )}
              </section>

              <section>
                <SectionHeading>Hisob-fakturalar tarixi</SectionHeading>
                {data.invoices.length === 0 ? (
                  <Card as="div" className="text-sm text-ink-muted">
                    Hali hisob-faktura yo'q.
                  </Card>
                ) : (
                  <InvoicesTable rows={data.invoices.map((invoice) => ({ invoice }))} onChanged={refresh} />
                )}
              </section>
            </div>

            <aside className="space-y-6">
              <AccessCard detail={data} onChanged={reload} />
              <ContractCard detail={data} />
              <JoinCodeCard detail={data} onChanged={refresh} />
              <CenterAdmins detail={data} onChanged={refresh} />
            </aside>
          </div>

          {editing && (
            <CenterForm
              center={data}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false)
                refresh()
              }}
            />
          )}

          {openSeat && (
            <StudentDrawer
              seatId={openSeat}
              groups={data.overview.groups}
              basePath={`/api/admin-portal/centers/${id}`}
              readOnly
              onClose={() => setOpenSeat(null)}
              onChanged={() => undefined}
            />
          )}
        </>
      )}
    </Screen>
  )
}

/** One sentence on why the students do or do not have Pro today. */
function accessNote(detail: AdminCenterDetail) {
  switch (detail.overview.access) {
    case 'open':
      return "O'quvchilarda Pro ochiq"
    case 'not_started':
      return `Pro ${formatDate(detail.contractStartsOn)} dan ochiladi`
    case 'suspended':
      return "Markaz o'chirilgan — o'quvchilar bepul rejada"
    case 'archived':
      return 'Markaz arxivda'
    default:
      return "To'lov kelmaguncha o'quvchilar bepul rejada"
  }
}

async function copyLink(token: string) {
  try {
    await navigator.clipboard.writeText(payLink(token))
    toast("To'lov havolasi nusxalandi")
  } catch {
    toast("Nusxalab bo'lmadi — havolani qo'lda belgilang")
  }
}

/** The pay link as a field the team can read, copy, or open — what is sent to the center. */
function PayLinkRow({ token }: { token: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={payLink(token)}
        onFocus={(event) => event.currentTarget.select()}
        aria-label="To'lov havolasi"
        className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
      />
      <Button variant="secondary" size="sm" onClick={() => copyLink(token)}>
        <span className="flex items-center gap-1.5">
          <Copy aria-hidden="true" className="size-4" strokeWidth={1.8} />
          Nusxalash
        </span>
      </Button>
      <a
        href={payLink(token)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-sm font-bold text-ink-muted hover:bg-ground-sunken hover:text-ink"
      >
        <ExternalLink aria-hidden="true" className="size-4" strokeWidth={1.8} />
        Ochish
      </a>
    </div>
  )
}

/**
 * The month waiting to be paid: what it is for, its pay link (Click or Payme, no login needed),
 * and the two things only the team does — confirm a bank transfer, or cancel it.
 */
function PaymentCard({ detail, onChanged }: { detail: AdminCenterDetail; onChanged: () => void }) {
  const open = detail.overview.openInvoice
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [confirm, setConfirm] = useState<'paid' | 'cancelled' | null>(null)

  async function nextInvoice() {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/centers/${detail.id}/invoices`, { method: 'POST' })
      toast('Hisob-faktura tayyor')
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Yaratib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(status: 'paid' | 'cancelled') {
    if (!open) return
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/center-invoices/${open.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      toast(status === 'paid' ? "To'lov qabul qilindi — Pro muddati uzaytirildi" : 'Hisob-faktura bekor qilindi')
      setConfirm(null)
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="div" className="space-y-4">
      <SectionHeading action={open && <InvoiceBadge status={open.status} />}>To'lov</SectionHeading>

      {open ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-extrabold tabular-nums text-ink">{formatSom(open.amountTiyin)}</div>
              <p className="mt-1 text-sm text-ink-muted">
                {formatPeriod(open.periodStart, open.periodEnd)} · {open.seats} o'quvchi × {formatSom(open.pricePerSeatTiyin)}
              </p>
            </div>
          </div>
          <PayLinkRow token={open.payToken} />
          <p className="text-xs text-ink-muted">
            Havolani markazga yuboring: ochganda Click yoki Payme orqali to'laydi, login kerak emas. To'lov tushishi bilan
            o'quvchilarda Pro {formatDate(open.periodEnd)} gacha ochiladi.
          </p>
          <div className="flex flex-wrap gap-2 border-t-2 border-hairline pt-4">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirm('paid')}>
              Bank o'tkazmasi keldi — to'langan
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm('cancelled')}>
              Bekor qilish
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            {detail.paidThrough
              ? `${formatDate(detail.paidThrough)} gacha to'langan. Keyingi oy hisob-fakturasi muddat tugashidan 7 kun oldin o'zi yaratiladi.`
              : "Ochiq hisob-faktura yo'q."}
          </p>
          <Button size="sm" disabled={busy || detail.status === 'archived'} onClick={nextInvoice}>
            {busy ? 'Yaratilmoqda…' : 'Keyingi oy uchun hisob-faktura'}
          </Button>
        </div>
      )}

      {failure && <ErrorNote>{failure}</ErrorNote>}

      {confirm && open && (
        <ConfirmDialog
          title={confirm === 'paid' ? "To'langan deb belgilash" : 'Hisob-fakturani bekor qilish'}
          body={
            confirm === 'paid'
              ? `${formatSom(open.amountTiyin)} hisobga tushganini tekshirdingizmi? Belgilangach o'quvchilarda Pro ${formatDate(open.periodEnd)} gacha ochiladi.`
              : "Havola ishlamay qoladi. Kerak bo'lsa keyin yangisini yaratasiz."
          }
          confirmLabel={confirm === 'paid' ? "Ha, to'langan" : 'Bekor qilish'}
          confirmVariant={confirm === 'paid' ? 'primary' : 'danger'}
          busy={busy}
          onConfirm={() => setStatus(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Card>
  )
}

/**
 * The center's switch. Off means every one of its students drops to the free plan at once —
 * so the confirmation says how many — and back on restores the same seats.
 */
function AccessCard({ detail, onChanged }: { detail: AdminCenterDetail; onChanged: () => void }) {
  const [confirm, setConfirm] = useState<'active' | 'suspended' | 'archived' | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const active = detail.status === 'active'
  const students = detail.overview.activeStudents

  async function setStatus(status: 'active' | 'suspended' | 'archived') {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/centers/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      toast(status === 'active' ? 'Markaz yoqildi' : status === 'suspended' ? "Markaz o'chirildi" : 'Markaz arxivlandi')
      setConfirm(null)
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "O'zgartirib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="div" className="space-y-3">
      <SectionHeading>Markaz holati</SectionHeading>
      <p className="text-sm text-ink">
        {active
          ? "Faol. O'quvchilar to'langan muddat ichida Pro'dan foydalanadi."
          : detail.status === 'suspended'
            ? `O'chirilgan. ${students} ta o'quvchi bepul rejada; yoqilsa, Pro to'langan muddat ichida qaytadi.`
            : "Arxivda. O'quvchilar bepul rejada."}
      </p>
      <div className="flex flex-wrap gap-2">
        {active ? (
          <Button variant="danger" size="sm" disabled={busy} onClick={() => setConfirm('suspended')}>
            Markazni o'chirish
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => setConfirm('active')}>
            Markazni yoqish
          </Button>
        )}
        {detail.status !== 'archived' && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirm('archived')}>
            Arxivlash
          </Button>
        )}
      </div>
      {failure && <ErrorNote>{failure}</ErrorNote>}

      {confirm && (
        <ConfirmDialog
          title={confirm === 'active' ? 'Markazni yoqish' : confirm === 'suspended' ? "Markazni o'chirish" : 'Markazni arxivlash'}
          body={
            confirm === 'active'
              ? `${students} ta o'quvchida Pro to'langan muddat ichida darhol qaytadi.`
              : `${students} ta faol o'quvchi darhol bepul rejaga o'tadi. Natijalari va markazdagi joyi saqlanadi.${
                  confirm === 'archived' ? ' Arxivdagi markazga yangi o\'quvchi qo\'shib bo\'lmaydi.' : ''
                }`
          }
          confirmLabel={confirm === 'active' ? 'Yoqish' : confirm === 'suspended' ? "O'chirish" : 'Arxivlash'}
          confirmVariant={confirm === 'active' ? 'primary' : 'danger'}
          busy={busy}
          onConfirm={() => setStatus(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Card>
  )
}

function ContractCard({ detail }: { detail: AdminCenterDetail }) {
  const rows: Array<[string, string]> = [
    ['Narx', `${formatSom(detail.pricePerSeatTiyin)} / o'quvchi / oy`],
    ["O'quvchilar limiti", `${detail.maxStudents} ta`],
    ["Oylik to'lov", formatSom(detail.maxStudents * detail.pricePerSeatTiyin)],
    ['Shartnoma boshlanishi', formatDate(detail.contractStartsOn)],
    ["To'langan muddat", detail.paidThrough ? `${formatDate(detail.paidThrough)} gacha` : '—'],
    ['Yaratilgan', formatDate(detail.createdAt)],
  ]

  return (
    <Card as="div">
      <SectionHeading>Shartnoma</SectionHeading>
      <dl className="divide-y divide-hairline text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-right font-bold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function JoinCodeCard({ detail, onChanged }: { detail: AdminCenterDetail; onChanged: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  async function renew() {
    setBusy(true)
    try {
      await adminFetch(`/api/admin-portal/centers/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ newJoinCode: true }) })
      toast('Yangi kod yaratildi')
      setConfirm(false)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="div" className="space-y-3">
      <SectionHeading
        action={
          <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
            Yangi kod
          </Button>
        }
      >
        Markaz kodi
      </SectionHeading>
      <div className="font-mono text-3xl font-extrabold tracking-[0.2em] text-ink">{detail.joinCode}</div>
      <p className="text-sm text-ink-muted">O'quvchi ilovada shu kodni yozib qo'shilish so'rovini yuboradi.</p>
      {confirm && (
        <ConfirmDialog
          title="Kodni almashtirish"
          body="Eski kod darhol ishlamay qoladi. Markazga yangi kodni yuborishni unutmang."
          confirmLabel="Almashtirish"
          busy={busy}
          onConfirm={renew}
          onCancel={() => setConfirm(false)}
        />
      )}
    </Card>
  )
}

function suggestPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

function CenterAdmins({ detail, onChanged }: { detail: AdminCenterDetail; onChanged: () => void }) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  /* Shown once: the server keeps only a hash. */
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null)

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFailure('')
    const password = suggestPassword()
    try {
      await adminFetch(`/api/admin-portal/centers/${detail.id}/admins`, {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password, displayName: displayName.trim() }),
      })
      setIssued({ username: username.trim().toLowerCase(), password })
      setUsername('')
      setDisplayName('')
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Hisob yaratib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  async function reset(userId: string, login: string) {
    setFailure('')
    const password = suggestPassword()
    try {
      await adminFetch(`/api/admin-portal/centers/${detail.id}/admins/${userId}/password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setIssued({ username: login, password })
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Parolni yangilab bo'lmadi.")
    }
  }

  async function setActive(userId: string, active: boolean) {
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/centers/${detail.id}/admins/${userId}/active?active=${active}`, { method: 'POST' })
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Holatni o'zgartirib bo'lmadi.")
    }
  }

  return (
    <Card as="div" className="space-y-4">
      <SectionHeading>Administratorlar</SectionHeading>

      {issued && (
        <div className="rounded-[var(--radius-control)] border-2 border-signal bg-signal-soft px-4 py-3 text-sm text-signal-ink">
          Markazga yuboring (faqat hozir ko'rinadi): admin.russian.gg · login <b>{issued.username}</b> · parol{' '}
          <b className="font-mono">{issued.password}</b>
        </div>
      )}

      {detail.admins.length === 0 ? (
        <p className="text-sm text-ink-muted">Hali login yo'q — markaz panelga kira olmaydi.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {detail.admins.map((admin) => (
            <li key={admin.id} className="space-y-2 py-3 first:pt-0">
              <div className="text-sm">
                <span className="font-bold text-ink">{admin.username}</span>
                {!admin.isActive && (
                  <span className="ml-2">
                    <Badge tone="caution">O'chirilgan</Badge>
                  </span>
                )}
                <span className="block text-xs text-ink-muted">
                  {admin.displayName} · oxirgi kirish {formatDateTime(admin.lastLoginAt)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => reset(admin.id, admin.username)}>
                  Yangi parol
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setActive(admin.id, !admin.isActive)}>
                  {admin.isActive ? "O'chirish" : 'Yoqish'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={create} className="space-y-3 border-t-2 border-hairline pt-4">
        <Field label="Login">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s+/g, ''))}
            placeholder="ziyo-admin"
            autoComplete="off"
            className={fieldClass}
          />
        </Field>
        <Field label="Ism">
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={fieldClass} />
        </Field>
        <Button type="submit" size="sm" block disabled={busy || username.trim().length < 3}>
          Login yaratish
        </Button>
      </form>
      {failure && <ErrorNote>{failure}</ErrorNote>}
    </Card>
  )
}

// ------------------------------------------------------------------------------- leads

function LeadsList({
  leads,
  error,
  refresh,
  onCreateCenter,
  onOpenCenter,
}: {
  leads: AdminCenterLead[] | null
  error: string
  refresh: () => void
  onCreateCenter: (lead: AdminCenterLead) => void
  onOpenCenter: (id: string) => void
}) {
  const [failure, setFailure] = useState('')

  async function setStatus(lead: AdminCenterLead, status: string) {
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/center-leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    }
  }

  if (error) return <ErrorNote onRetry={refresh}>{error}</ErrorNote>
  if (!leads) return <LoadingRows />
  if (leads.length === 0) return <EmptyNote>Hali demo so'rovi kelmagan. Ular /markazlar sahifasidagi formadan keladi.</EmptyNote>

  const bandLabel: Record<string, string> = { 'under-50': '50 dan kam', '50-200': '50–200', 'over-200': "200 dan ko'p" }

  return (
    <div className="space-y-3">
      {failure && <ErrorNote>{failure}</ErrorNote>}
      <Table head={['Markaz', "Bog'lanish", "O'quvchilar", 'Keldi', 'Holat', '']}>
        {leads.map((lead) => (
          <Row key={lead.id}>
            <Cell strong>
              {lead.centerName}
              {lead.city && <span className="block text-xs font-normal text-ink-muted">{lead.city}</span>}
            </Cell>
            <Cell>
              {lead.contactName}
              <a href={`tel:${lead.phone}`} className="block text-xs text-signal-ink">
                {formatUzPhone(lead.phone)}
              </a>
            </Cell>
            <Cell muted>{lead.studentBand ? bandLabel[lead.studentBand] ?? lead.studentBand : '—'}</Cell>
            <Cell muted>{formatDateTime(lead.createdAt)}</Cell>
            <Cell>
              <Select
                label="Holat"
                value={lead.status}
                onChange={(value) => setStatus(lead, value)}
                options={(Object.keys(leadStatusLabel) as LeadStatus[]).map((value) => ({ value, label: leadStatusLabel[value] }))}
              />
            </Cell>
            <Cell>
              {lead.centerId ? (
                <Button variant="secondary" size="sm" onClick={() => onOpenCenter(lead.centerId!)}>
                  Markazni ochish
                </Button>
              ) : (
                <Button size="sm" onClick={() => onCreateCenter(lead)}>
                  Markaz yaratish
                </Button>
              )}
            </Cell>
          </Row>
        ))}
      </Table>
    </div>
  )
}

// ------------------------------------------------------------------------------- invoices

function InvoicesList({ onOpenCenter }: { onOpenCenter: (id: string) => void }) {
  const [show, setShow] = useState<'open' | 'all'>('open')
  const { data, error, isLoading, refresh } = useAdminQuery<AdminCenterInvoice[]>(`/api/admin-portal/center-invoices?status=${show}`)

  const unpaid = (data ?? [])
    .filter((row) => row.invoice.status === 'sent' || row.invoice.status === 'overdue')
    .reduce((sum, row) => sum + row.invoice.amountTiyin, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={show}
          onChange={setShow}
          options={[
            { id: 'open', label: "To'lanmaganlar" },
            { id: 'all', label: 'Hammasi' },
          ]}
        />
        {data && unpaid > 0 && <span className="text-sm text-ink-muted">Jami to'lanmagan: {formatSom(unpaid)}</span>}
      </div>
      <p className="text-xs text-ink-muted">
        Markazlar oldindan to'laydi: limit × narx, bir oyga. Keyingi oy hisob-fakturasi to'langan muddat tugashidan 7 kun oldin
        o'zi yaratiladi; oy boshlanib, to'lanmagan bo'lsa “Muddati o'tgan” bo'ladi va o'quvchilar bepul rejaga o'tadi.
      </p>
      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
      {isLoading && !data && <LoadingRows />}
      {data && data.length === 0 && <EmptyNote>{show === 'open' ? "To'lanmagan hisob-faktura yo'q." : "Hali hisob-faktura yo'q."}</EmptyNote>}
      {data && data.length > 0 && <InvoicesTable rows={data} onChanged={refresh} onOpenCenter={onOpenCenter} />}
    </div>
  )
}

const paidViaLabel = (via: string | null) =>
  !via ? '' : via === 'click' ? 'Click' : via === 'payme' ? 'Payme' : via.startsWith('admin:') ? `qo'lda (${via.slice(6)})` : via

function InvoicesTable({
  rows,
  onChanged,
  onOpenCenter,
}: {
  rows: Array<{ invoice: CenterInvoice; centerId?: string; centerName?: string }>
  onChanged: () => void
  onOpenCenter?: (id: string) => void
}) {
  const [confirm, setConfirm] = useState<CenterInvoice | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const showCenter = Boolean(onOpenCenter)

  async function markPaid(invoice: CenterInvoice) {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/center-invoices/${invoice.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'paid' }) })
      toast("To'lov qabul qilindi")
      setConfirm(null)
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  const head = [...(showCenter ? ['Markaz'] : []), 'Davr', "O'quvchilar", 'Summa', 'Holat', "To'langan", '']

  return (
    <div className="space-y-3">
      {failure && <ErrorNote>{failure}</ErrorNote>}
      <Table head={head}>
        {rows.map(({ invoice, centerId, centerName }) => {
          const open = invoice.status === 'sent' || invoice.status === 'overdue'
          return (
            <Row key={invoice.id}>
              {showCenter && (
                <Cell strong>
                  <button type="button" className="font-bold text-ink hover:underline" onClick={() => centerId && onOpenCenter?.(centerId)}>
                    {centerName}
                  </button>
                </Cell>
              )}
              <Cell>{formatPeriod(invoice.periodStart, invoice.periodEnd)}</Cell>
              <Cell>{invoice.seats}</Cell>
              <Cell strong>{formatSom(invoice.amountTiyin)}</Cell>
              <Cell>
                <InvoiceBadge status={invoice.status} />
              </Cell>
              <Cell muted>
                {invoice.paidAt ? (
                  <>
                    {formatDate(invoice.paidAt)}
                    <span className="block text-xs">{paidViaLabel(invoice.paidVia)}</span>
                  </>
                ) : (
                  '—'
                )}
              </Cell>
              <Cell>
                {open && (
                  <span className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => copyLink(invoice.payToken)}>
                      Havola
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(invoice)}>
                      To'landi
                    </Button>
                  </span>
                )}
              </Cell>
            </Row>
          )
        })}
      </Table>

      {confirm && (
        <ConfirmDialog
          title="To'langan deb belgilash"
          body={`${formatSom(confirm.amountTiyin)} hisobga tushganini tekshirdingizmi? O'quvchilarda Pro ${formatDate(confirm.periodEnd)} gacha ochiladi.`}
          confirmLabel="Ha, to'langan"
          confirmVariant="primary"
          busy={busy}
          onConfirm={() => markPaid(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
