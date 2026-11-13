import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Archive,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  House,
  Info,
  Pencil,
  Plus,
  Power,
  Send,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { cx } from '../../src/lib/cx'
import { adminFetch, daysUntil, formatDate, formatDateTime, formatDayLong, useAdminQuery } from '../lib/api'
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
import { IconStat } from '../components/center-ui'
import { readStudentsFile } from '../lib/student-import'
import { AddStudentsDialog, type DraftStudent } from './CenterPortal'

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

type DetailTab = 'overview' | 'students' | 'payments' | 'admins' | 'history'

const detailTabs: Array<{ id: DetailTab; label: string; Icon: typeof House }> = [
  { id: 'overview', label: "Umumiy ma'lumot", Icon: House },
  { id: 'students', label: "O'quvchilar", Icon: Users },
  { id: 'payments', label: "To'lovlar", Icon: CreditCard },
  { id: 'admins', label: 'Administratorlar', Icon: ShieldCheck },
  { id: 'history', label: 'Tarix', Icon: Clock },
]

function CenterDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, error, refresh } = useAdminQuery<AdminCenterDetail>(`/api/admin-portal/centers/${id}`)
  const students = useAdminQuery<CenterStudent[]>(`/api/admin-portal/centers/${id}/students`)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [editing, setEditing] = useState(false)
  const [openSeat, setOpenSeat] = useState<string | null>(null)
  const [adding, setAdding] = useState<DraftStudent[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [importFailure, setImportFailure] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const reload = () => {
    refresh()
    students.refresh()
  }

  async function importFile(file: File) {
    setImporting(true)
    setImportFailure('')
    try {
      const rows = await readStudentsFile(file)
      if (rows.length === 0) throw new Error("Faylda o'quvchi topilmadi. Shablondagi ustunlarni to'ldiring.")
      setAdding(
        rows.map((row, index) => {
          const local = uzLocalDigits(row.phone)
          return { key: 1_000_000 + index, name: row.name, phone: local ? maskUzLocal(local) : row.phone, email: row.email }
        }),
      )
    } catch (caught) {
      setImportFailure(caught instanceof Error ? caught.message : "Faylni o'qib bo'lmadi.")
    } finally {
      setImporting(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const studentActions = (
    <>
      <Button size="sm" onClick={() => setAdding([])} disabled={data?.status === 'archived'}>
        <span className="flex items-center gap-1.5">
          <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
          O'quvchilar qo'shish
        </span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => fileInput.current?.click()}
        disabled={importing || data?.status === 'archived'}
      >
        <span className="flex items-center gap-1.5">
          <Upload aria-hidden="true" className="size-4" strokeWidth={1.8} />
          {importing ? "O'qilmoqda…" : "Excel'dan yuklash"}
        </span>
      </Button>
    </>
  )

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

      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importFile(file)
        }}
      />

      {data && (
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span
                aria-hidden="true"
                className="flex size-16 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-signal-soft text-signal-ink"
              >
                <GraduationCap className="size-8" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-ink">{data.name}</h1>
                  <StatusPill status={data.status} />
                  <AccessBadge access={data.overview.access} />
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {[data.city, data.contactName].filter(Boolean).join(' · ')}
                  {data.contactPhone && (
                    <>
                      {(data.city || data.contactName) && ' · '}
                      <a href={`tel:${data.contactPhone}`} className="hover:text-signal-ink hover:underline">
                        {formatUzPhone(data.contactPhone)}
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>
            <HeaderActions detail={data} onChanged={reload} onEdit={() => setEditing(true)} />
          </header>

          <nav
            role="tablist"
            aria-label="Markaz bo'limlari"
            className="flex min-h-14 items-stretch gap-1 overflow-x-auto overflow-y-hidden rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-2 [scrollbar-width:none]"
          >
            {detailTabs.map(({ id: tabId, label, Icon }) => (
              <button
                key={tabId}
                type="button"
                role="tab"
                aria-selected={tab === tabId}
                onClick={() => setTab(tabId)}
                className={cx(
                  'flex shrink-0 items-center gap-2 border-y-[3px] border-t-transparent px-4 py-4 text-sm font-bold whitespace-nowrap transition-colors focus-visible:rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-signal',
                  tab === tabId
                    ? 'border-b-signal text-signal-ink'
                    : 'border-b-transparent text-ink-muted hover:text-ink',
                )}
              >
                <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
                {label}
                {tabId === 'students' && students.data && (
                  <span className="rounded-[var(--radius-control)] bg-ground-sunken px-1.5 text-xs font-extrabold text-ink-muted">
                    {students.data.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {importFailure && <ErrorNote>{importFailure}</ErrorNote>}

          {tab === 'overview' && (
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 space-y-6">
                <SetupChecklist detail={data} />

                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                  <IconStat
                    Icon={Users}
                    tone="signal"
                    label="O'quvchilar"
                    value={
                      <>
                        {data.overview.activeStudents} <span className="text-ink-faint">/ {data.maxStudents}</span>
                      </>
                    }
                    note={
                      <>
                        <span aria-hidden="true" className="mb-2 block h-1.5 overflow-hidden rounded-full bg-ground-sunken">
                          <span
                            className="block h-full rounded-full bg-signal"
                            style={{
                              width: `${data.maxStudents ? Math.min(100, (100 * data.overview.activeStudents) / data.maxStudents) : 0}%`,
                            }}
                          />
                        </span>
                        {data.overview.notSignedIn > 0
                          ? `${data.overview.notSignedIn} tasi ilovaga hali kirmagan`
                          : `${Math.max(0, data.maxStudents - data.overview.activeStudents)} ta joy bo'sh`}
                      </>
                    }
                  />
                  <ProStat detail={data} />
                  <IconStat
                    Icon={TrendingUp}
                    tone="purple"
                    label="Bu hafta mashq qilgan"
                    value={`${data.overview.weeklyActivePercent}%`}
                    note="faol o'quvchilardan"
                  />
                  <IconStat
                    Icon={TriangleAlert}
                    tone="caution"
                    label="Xavf ostida"
                    value={<span className={data.overview.atRisk > 0 ? 'text-danger' : undefined}>{data.overview.atRisk}</span>}
                    note="7+ kun kirmagan yoki ortda qolgan"
                  />
                </div>

                <PaymentCard detail={data} onChanged={refresh} />

                <StudentsSection
                  students={students.data}
                  error={students.error}
                  onRetry={students.refresh}
                  onOpen={setOpenSeat}
                  actions={studentActions}
                />
              </div>

              <aside className="space-y-6">
                <AboutCard detail={data} onChanged={refresh} />
                <CenterAdmins detail={data} onChanged={refresh} compact />
              </aside>
            </div>
          )}

          {tab === 'students' && (
            <StudentsSection
              students={students.data}
              error={students.error}
              onRetry={students.refresh}
              onOpen={setOpenSeat}
              actions={studentActions}
            />
          )}

          {tab === 'payments' && (
            <div className="space-y-6">
              <PaymentCard detail={data} onChanged={refresh} />
              <section>
                <SectionHeading>Hisob-fakturalar</SectionHeading>
                {data.invoices.length === 0 ? (
                  <Card as="div" className="text-sm text-ink-muted">
                    Hali hisob-faktura yo'q.
                  </Card>
                ) : (
                  <InvoicesTable rows={data.invoices.map((invoice) => ({ invoice }))} onChanged={refresh} />
                )}
              </section>
            </div>
          )}

          {tab === 'admins' && (
            <CenterAdmins detail={data} onChanged={refresh} />
          )}

          {tab === 'history' && <HistoryList detail={data} />}

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

          {adding && (
            <AddStudentsDialog
              initialRows={adding}
              free={Math.max(0, data.maxStudents - data.overview.activeStudents)}
              basePath={`/api/admin-portal/centers/${id}`}
              onClose={() => setAdding(null)}
              onAdded={reload}
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
        </div>
      )}
    </Screen>
  )
}

function StatusPill({ status }: { status: CenterStatus }) {
  const tone =
    status === 'active'
      ? 'bg-milestone-soft text-milestone'
      : status === 'suspended'
        ? 'bg-caution-soft text-caution'
        : 'bg-ground-sunken text-ink-muted'
  const dot = status === 'active' ? 'bg-milestone' : status === 'suspended' ? 'bg-caution' : 'bg-ink-faint'
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-bold', tone)}>
      <span aria-hidden="true" className={cx('size-2 rounded-full', dot)} />
      {centerStatusLabel[status]}
    </span>
  )
}

/** Whether students have Pro today, said as days left rather than a bare date. */
function ProStat({ detail }: { detail: AdminCenterDetail }) {
  const access = detail.overview.access
  if (access === 'open' && detail.paidThrough) {
    // Days still ahead after today: paid on the 13th for 14 Nov–13 Dec reads "30 kun".
    const left = Math.max(0, daysUntil(detail.paidThrough))
    return (
      <IconStat
        Icon={CalendarCheck}
        tone={left <= 7 ? 'caution' : 'milestone'}
        label="Pro ochiq"
        value={<span className={left <= 7 ? 'text-caution' : undefined}>{left} kun</span>}
        note={`${formatDayLong(detail.paidThrough)}gacha to'langan`}
      />
    )
  }

  return (
    <IconStat
      Icon={CalendarCheck}
      tone="caution"
      label="Pro"
      value={<span className="text-caution">{access === 'not_started' ? 'Hali emas' : 'Yopiq'}</span>}
      note={accessNote(detail)}
    />
  )
}

/**
 * Where a new center stands, as four steps the team walks it through. Shown until the center
 * has paid, has a login, has used it, and has students — then it gets out of the way.
 */
function SetupChecklist({ detail }: { detail: AdminCenterDetail }) {
  const steps = [
    { done: Boolean(detail.paidThrough), label: "Birinchi oy to'langan", hint: "To'lov havolasini markazga yuboring" },
    { done: detail.admins.length > 0, label: 'Login yaratilgan', hint: "“Markaz administratorlari”da yarating" },
    { done: detail.admins.some((admin) => admin.lastLoginAt), label: 'Panelga kirgan', hint: 'Login va parolni markazga yuboring' },
    {
      done: detail.overview.activeStudents > 0,
      label: "O'quvchilar qo'shilgan",
      hint: "Panelda raqamlarni kiriting yoki Excel'dan yuklang",
    },
  ]
  const doneCount = steps.filter((step) => step.done).length
  if (doneCount === steps.length || detail.status === 'archived') return null
  const current = steps.findIndex((step) => !step.done)
  const percent = Math.round((100 * doneCount) / steps.length)

  return (
    <Card as="section" aria-labelledby="setup-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="setup-title" className="text-lg font-extrabold text-ink">
            Markazni ishga tushirish
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">Markazni to'liq ishga tushirish uchun {steps.length} bosqichni bajaring.</p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <div className="flex items-center justify-end gap-2 text-sm font-bold text-signal-ink">
            {doneCount} / {steps.length} bajarildi
            <span className="rounded-[var(--radius-control)] bg-signal px-2 py-0.5 text-xs font-extrabold text-on-signal">{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Ishga tushirish"
            className="h-2 overflow-hidden rounded-full bg-ground-sunken"
          >
            <div className="h-full rounded-full bg-signal" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
      <ol className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
        {steps.map((step, index) => (
          <Fragment key={step.label}>
            <li
              className={cx(
                'flex items-center gap-3 rounded-[var(--radius-card)] border-2 px-3 py-3',
                step.done
                  ? 'border-transparent bg-ground-sunken'
                  : index === current
                    ? 'border-signal bg-signal-soft'
                    : 'border-hairline',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold',
                  step.done ? 'bg-milestone text-ground-raised' : index === current ? 'bg-signal text-on-signal' : 'bg-ground-sunken text-ink-muted',
                )}
              >
                {step.done ? <Check className="size-4" strokeWidth={3} /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{step.label}</span>
                {!step.done && index === current && <span className="block text-xs text-ink-muted">{step.hint}</span>}
                <span className="sr-only">{step.done ? '— bajarildi' : '— bajarilmagan'}</span>
              </span>
            </li>
            {index < steps.length - 1 && (
              <ChevronRight aria-hidden="true" className="hidden size-4 self-center text-ink-faint md:block" strokeWidth={2} />
            )}
          </Fragment>
        ))}
      </ol>
    </Card>
  )
}

function StudentsSection({
  students,
  error,
  onRetry,
  onOpen,
  actions,
}: {
  students: CenterStudent[] | null
  error: string
  onRetry: () => void
  onOpen: (seatId: string) => void
  actions: ReactNode
}) {
  return (
    <Card as="section" aria-labelledby="students-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="students-title" className="flex items-center gap-3 text-lg font-extrabold text-ink">
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
            <Users className="size-[18px]" strokeWidth={1.8} />
          </span>
          O'quvchilar · {students?.length ?? '…'}
        </h2>
        {students && students.length > 0 && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      {error && <ErrorNote onRetry={onRetry}>{error}</ErrorNote>}
      {!students && !error && <LoadingRows />}

      {students && students.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border-2 border-dashed border-hairline px-6 py-8 text-center">
          <div className="flex items-center gap-4 text-left">
            <Users aria-hidden="true" className="size-12 shrink-0 text-ink-faint" strokeWidth={1.4} />
            <div>
              <p className="text-base font-extrabold text-ink">Hali o'quvchi qo'shilmagan</p>
              <p className="max-w-sm text-sm text-ink-muted">
                Ism va telefon raqamini kiriting yoki Excel fayldan yuklang. O'quvchi shu raqam bilan kirishi bilan markazga
                o'zi ulanadi — kod kerak emas.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">{actions}</div>
        </div>
      )}

      {students && students.length > 0 && <StudentsTable students={students} onOpen={(student) => onOpen(student.seatId)} />}
    </Card>
  )
}

/** The center's facts in one card: its join code first, because it is what gets asked for. */
function AboutCard({ detail, onChanged }: { detail: AdminCenterDetail; onChanged: () => void }) {
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

  const rows: Array<[string, ReactNode]> = [
    ['Narx', `${formatSom(detail.pricePerSeatTiyin)} / o'quvchi`],
    ["O'quvchilar limiti", `${detail.maxStudents} ta`],
    ["Oylik to'lov", formatSom(detail.maxStudents * detail.pricePerSeatTiyin)],
    ['Shartnoma boshlanishi', formatDate(detail.contractStartsOn)],
    ['Yaratilgan sana', <span className="font-normal text-ink-muted">{formatDateTime(detail.createdAt)}</span>],
  ]

  return (
    <Card as="section" aria-labelledby="about-title" className="space-y-4">
      <h2 id="about-title" className="flex items-center gap-3 text-lg font-extrabold text-ink">
        <Info aria-hidden="true" className="size-5 text-signal-ink" strokeWidth={1.8} />
        Markaz haqida
      </h2>
      <dl className="divide-y divide-hairline text-sm">
        <div className="flex items-center justify-between gap-3 pb-3">
          <dt className="text-ink-muted">
            Markaz kodi <span className="text-xs">(zaxira)</span>
          </dt>
          <dd className="flex items-center gap-1">
            <span className="rounded-[var(--radius-control)] bg-ground-sunken px-3 py-1 font-mono text-base font-extrabold tracking-[0.12em] text-ink">
              {detail.joinCode}
            </span>
            <button
              type="button"
              onClick={() => copyText(detail.joinCode, 'Kod nusxalandi')}
              aria-label="Kodni nusxalash"
              className="flex size-9 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-ground-sunken hover:text-ink"
            >
              <Copy className="size-4" strokeWidth={1.8} />
            </button>
          </dd>
        </div>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-3 last:pb-0">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-right font-bold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={() => setConfirm(true)} className="text-sm font-bold text-signal-ink hover:underline">
        Kodni almashtirish
      </button>
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

/** What happened to the center, newest first, from what the page already knows. */
function HistoryList({ detail }: { detail: AdminCenterDetail }) {
  const events: Array<{ at: string; text: string }> = [{ at: detail.createdAt, text: 'Markaz yaratildi' }]
  if (detail.contractStartsOn) events.push({ at: detail.contractStartsOn, text: 'Shartnoma boshlandi' })
  for (const invoice of detail.invoices) {
    if (invoice.paidAt) {
      events.push({
        at: invoice.paidAt,
        text: `${formatPeriod(invoice.periodStart, invoice.periodEnd)} to'landi · ${formatSom(invoice.amountTiyin)}${
          invoice.paidVia ? ` · ${paidViaLabel(invoice.paidVia)}` : ''
        }`,
      })
    }
    if (invoice.sentAt) events.push({ at: invoice.sentAt, text: `Hisob-faktura yuborildi · ${formatSom(invoice.amountTiyin)}` })
  }
  for (const admin of detail.admins) {
    if (admin.lastLoginAt) events.push({ at: admin.lastLoginAt, text: `${admin.username} panelga kirdi` })
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <Card as="section" aria-label="Tarix">
      <ol className="relative space-y-5 border-l-2 border-hairline pl-6">
        {events.map((event, index) => (
          <li key={index} className="relative">
            <span aria-hidden="true" className="absolute top-1.5 -left-[31px] size-3 rounded-full border-2 border-ground-raised bg-signal" />
            <div className="text-sm font-bold text-ink">{event.text}</div>
            <div className="text-xs text-ink-muted">{/^\d{4}-\d{2}-\d{2}$/.test(event.at) ? formatDate(event.at) : formatDateTime(event.at)}</div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** One sentence on why the students do or do not have Pro today. */
function accessNote(detail: AdminCenterDetail) {
  switch (detail.overview.access) {
    case 'open':
      return "O'quvchilarda Pro ochiq"
    case 'not_started':
      return `Pro ${formatDayLong(detail.contractStartsOn)}dan ochiladi`
    case 'suspended':
      return "Markaz o'chirilgan — o'quvchilar bepul rejada"
    case 'archived':
      return 'Markaz arxivda'
    default:
      return "To'lov kelmaguncha o'quvchilar bepul rejada"
  }
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast(done)
  } catch {
    toast("Nusxalab bo'lmadi — matnni qo'lda belgilang")
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
      <Button size="sm" onClick={() => copyText(payLink(token), "To'lov havolasi nusxalandi")}>
        <span className="flex items-center gap-1.5">
          <Copy aria-hidden="true" className="size-4" strokeWidth={1.8} />
          Havolani nusxalash
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
 * The money, in one place. An open invoice is the thing to act on: its sum, its pay link and
 * the two things only the team does. With nothing open, one line says until when it is paid and
 * when the next invoice will appear on its own — making one early is a quiet secondary action.
 */
function PaymentCard({ detail, onChanged }: { detail: AdminCenterDetail; onChanged: () => void }) {
  const open = detail.overview.openInvoice
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [confirm, setConfirm] = useState<'paid' | 'cancelled' | null>(null)
  const monthly = detail.maxStudents * detail.pricePerSeatTiyin

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

  const nextInvoiceDay = detail.paidThrough ? shiftDays(detail.paidThrough, -7) : null

  return (
    <Card as="section" aria-labelledby="pay-title" className={cx('space-y-4', open && 'border-signal')}>
      <div className="flex flex-wrap items-start gap-4">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal-ink">
          <CreditCard className="size-[18px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="pay-title" className="text-lg font-extrabold text-ink">
              {open ? "To'lov kutilmoqda" : "To'lovlar"}
            </h2>
            {open && <InvoiceBadge status={open.status} />}
          </div>
          {open ? (
            <>
              <div className="text-3xl font-extrabold text-ink tabular-nums">{formatSom(open.amountTiyin)}</div>
              <p className="text-sm text-ink-muted">
                {formatPeriod(open.periodStart, open.periodEnd)} · {open.seats} o'quvchi × {formatSom(open.pricePerSeatTiyin)}
              </p>
            </>
          ) : detail.paidThrough ? (
            <>
              <p className="text-base font-bold text-ink">
                {formatDayLong(detail.paidThrough)}gacha to'langan <span className="text-ink-faint">·</span> Oyiga{' '}
                {formatSom(monthly)}
              </p>
              {nextInvoiceDay && (
                <p className="text-sm text-ink-muted">Keyingi hisob-faktura {formatDayLong(nextInvoiceDay)}da yaratiladi.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-muted">Ochiq hisob-faktura yo'q. Birinchi oy uchun yarating va havolani markazga yuboring.</p>
          )}
        </div>
        {!open && (
          <Button
            size="sm"
            variant={detail.paidThrough ? 'secondary' : 'primary'}
            disabled={busy || detail.status === 'archived'}
            onClick={nextInvoice}
          >
            <span className="flex items-center gap-1.5">
              <FileText aria-hidden="true" className="size-4" strokeWidth={1.8} />
              {busy ? 'Yaratilmoqda…' : detail.paidThrough ? 'Hozir yaratish' : 'Hisob-faktura yaratish'}
            </span>
          </Button>
        )}
      </div>

      {open && (
        <>
          <PayLinkRow token={open.payToken} />
          <p className="text-xs text-ink-muted">
            Havolani markazga yuboring: Click yoki Payme orqali to'laydi, login kerak emas. To'lov tushishi bilan
            o'quvchilarda Pro {formatDayLong(open.periodEnd)}gacha ochiladi.
          </p>
          <div className="flex flex-wrap gap-2 border-t-2 border-hairline pt-4">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirm('paid')}>
              Bank o'tkazmasi keldi
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm('cancelled')}>
              Hisob-fakturani bekor qilish
            </Button>
          </div>
        </>
      )}

      {failure && <ErrorNote>{failure}</ErrorNote>}

      {confirm && open && (
        <ConfirmDialog
          title={confirm === 'paid' ? "To'langan deb belgilash" : 'Hisob-fakturani bekor qilish'}
          body={
            confirm === 'paid'
              ? `${formatSom(open.amountTiyin)} hisobga tushganini tekshirdingizmi? Belgilangach o'quvchilarda Pro ${formatDayLong(open.periodEnd)}gacha ochiladi.`
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

/** "2026-11-30" moved by some days, as the same ISO string. */
function shiftDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** A small menu under a button; closes on a choice, Escape, or a click outside it. */
function MenuButton({
  label,
  children,
  items,
  className,
}: {
  label: string
  children: ReactNode
  items: Array<{ label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }>
  className?: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={className}
      >
        {children}
      </button>
      {open && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 min-w-56 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-1.5 shadow-xl"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={cx(
                  'block w-full rounded-[10px] px-3 py-2 text-left text-sm font-bold hover:bg-ground-sunken disabled:opacity-50',
                  item.danger ? 'text-danger' : 'text-ink',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const headerButton =
  'inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm font-bold text-ink shadow-[0_3px_0_0_var(--color-control-depth,#d5dae1)] hover:-translate-y-px'

/**
 * Edit, archive and the center's on/off switch, in the header. Off drops every one of its
 * students to the free plan at once — so the confirmation says how many — and back on restores
 * the same seats.
 */
function HeaderActions({ detail, onChanged, onEdit }: { detail: AdminCenterDetail; onChanged: () => void; onEdit: () => void }) {
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
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MenuButton
        label="Boshqa amallar"
        className={cx(headerButton, 'px-3')}
        items={[
          { label: 'Telefon qilish', onSelect: () => detail.contactPhone && (window.location.href = `tel:${detail.contactPhone}`), disabled: !detail.contactPhone },
          { label: 'Markaz kodini nusxalash', onSelect: () => copyText(detail.joinCode, 'Kod nusxalandi') },
        ]}
      >
        <Ellipsis aria-hidden="true" className="size-5" strokeWidth={2} />
      </MenuButton>
      {detail.status !== 'archived' && (
        <button type="button" className={headerButton} disabled={busy} onClick={() => setConfirm('archived')}>
          <Archive aria-hidden="true" className="size-4" strokeWidth={1.8} />
          Arxivlash
        </button>
      )}
      <button type="button" className={headerButton} onClick={onEdit}>
        <Pencil aria-hidden="true" className="size-4" strokeWidth={1.8} />
        Tahrirlash
      </button>
      {active ? (
        <Button disabled={busy} onClick={() => setConfirm('suspended')}>
          <span className="flex items-center gap-2">
            <Power aria-hidden="true" className="size-4" strokeWidth={2} />
            Markazni o'chirish
          </span>
        </Button>
      ) : (
        <Button disabled={busy} onClick={() => setConfirm('active')}>
          <span className="flex items-center gap-2">
            <Power aria-hidden="true" className="size-4" strokeWidth={2} />
            Markazni yoqish
          </span>
        </Button>
      )}
      {failure && <span className="w-full text-right text-sm text-danger">{failure}</span>}

      {confirm && (
        <ConfirmDialog
          title={confirm === 'active' ? 'Markazni yoqish' : confirm === 'suspended' ? "Markazni o'chirish" : 'Markazni arxivlash'}
          body={
            confirm === 'active'
              ? `${students} ta o'quvchida Pro to'langan muddat ichida darhol qaytadi.`
              : `${students} ta faol o'quvchi darhol bepul rejaga o'tadi. Natijalari va markazdagi joyi saqlanadi.${
                  confirm === 'archived' ? " Arxivdagi markazga yangi o'quvchi qo'shib bo'lmaydi." : ''
                }`
          }
          confirmLabel={confirm === 'active' ? 'Yoqish' : confirm === 'suspended' ? "O'chirish" : 'Arxivlash'}
          confirmVariant={confirm === 'active' ? 'primary' : 'danger'}
          busy={busy}
          onConfirm={() => setStatus(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

function suggestPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

/** What is sent to the center after a login is made or reset: everything it needs, in one message. */
function credentialsMessage(detail: AdminCenterDetail, username: string, password: string) {
  return [
    `Assalomu alaykum! ${detail.name} uchun Russian.gg markaz paneli tayyor.`,
    `Manzil: ${panelAddress()}`,
    `Login: ${username}`,
    `Parol: ${password}`,
    "Kirgach, o'quvchilaringizning ism va telefon raqamlarini qo'shing — ular shu raqam bilan ilovaga kirishi bilan Pro ochiladi.",
  ].join('\n')
}

/**
 * Where a center admin signs in: this panel's own address. In development the panel is served at
 * /admin.html beside the learner app, so the path is kept; in production it is the host's root.
 */
function panelAddress() {
  const path = window.location.pathname.endsWith('.html') ? window.location.pathname : ''
  return `${window.location.origin}${path}`
}

/** One credential as a labelled, copyable field: what the center will type, nothing else. */
function CredentialField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border-2 border-hairline bg-ground-raised py-2 pr-1.5 pl-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold tracking-[0.1em] whitespace-nowrap text-ink-faint uppercase">{label}</div>
        <div className={cx('text-sm font-bold break-all text-ink', mono && 'font-mono tracking-wide')}>{value}</div>
      </div>
      <button
        type="button"
        onClick={() => copyText(value, `${label} nusxalandi`)}
        aria-label={`${label}ni nusxalash`}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ground-sunken hover:text-ink"
      >
        <Copy className="size-4" strokeWidth={1.8} />
      </button>
    </div>
  )
}

/**
 * A login just made (or a password just reset), shown once — the server keeps only a hash. The
 * three things the center types are fields of their own; the message that carries them is one
 * button away, or one tap into Telegram, where these are usually sent.
 */
function IssuedCredentials({
  detail,
  username,
  password,
  onClose,
}: {
  detail: AdminCenterDetail
  username: string
  password: string
  onClose: () => void
}) {
  const message = credentialsMessage(detail, username, password)
  const telegram = `https://t.me/share/url?url=${encodeURIComponent(panelAddress())}&text=${encodeURIComponent(message)}`

  return (
    <div role="status" className="@container space-y-4 rounded-[var(--radius-card)] border-2 border-milestone/40 bg-milestone-soft/60 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-milestone text-ground-raised">
          <Check className="size-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold text-ink">Login tayyor</p>
          <p className="text-sm text-ink-muted">Markazga yuboring — shu bilan panelga kiradi.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ground-raised hover:text-ink"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid gap-2 @xl:grid-cols-3">
        <CredentialField label="Panel manzili" value={panelAddress().replace(/^https?:\/\//, '')} />
        <CredentialField label="Login" value={username} mono />
        <CredentialField label="Parol" value={password} mono />
      </div>

      <div className="grid gap-2 @md:flex @md:flex-wrap @md:items-center">
        <Button size="sm" onClick={() => copyText(message, 'Xabar nusxalandi')}>
          <span className="flex items-center gap-1.5">
            <Copy aria-hidden="true" className="size-4" strokeWidth={1.8} />
            Xabarni nusxalash
          </span>
        </Button>
        <a
          href={telegram}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm font-bold text-ink hover:border-ink-faint"
        >
          <Send aria-hidden="true" className="size-4" strokeWidth={1.8} />
          Telegram orqali yuborish
        </a>
        <details className="group w-full text-sm">
          <summary className="cursor-pointer list-none text-center font-bold text-signal-ink hover:underline @md:text-left">
            <span className="group-open:hidden">Xabar matnini ko'rish</span>
            <span className="hidden group-open:inline">Xabar matnini yashirish</span>
          </summary>
          <pre className="mt-2 rounded-[var(--radius-control)] bg-ground-raised p-3 font-sans text-sm whitespace-pre-wrap text-ink">
            {message}
          </pre>
        </details>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-caution-soft px-3 py-2.5 text-xs leading-relaxed font-bold text-caution">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        Parol faqat hozir ko'rinadi. Yopgandan keyin uni ko'rib bo'lmaydi — faqat yangisini berish mumkin.
      </p>
    </div>
  )
}

/**
 * The password the team generated, while the admin has not signed in with it yet — so a center
 * that lost the message can still be told it. It disappears from here at their first sign-in.
 */
function PendingPassword({ detail, username, password }: { detail: AdminCenterDetail; username: string; password: string }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-caution-soft px-3 py-2 pl-[52px] text-sm">
      <span className="font-bold text-caution">Parol:</span>
      <span className="font-mono font-bold tracking-wide text-ink">{shown ? password : '•'.repeat(password.length)}</span>
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-label={shown ? 'Parolni yashirish' : "Parolni ko'rsatish"}
        className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-ground-raised hover:text-ink"
      >
        {shown ? <EyeOff className="size-4" strokeWidth={1.8} /> : <Eye className="size-4" strokeWidth={1.8} />}
      </button>
      <button
        type="button"
        onClick={() => copyText(password, 'Parol nusxalandi')}
        aria-label="Parolni nusxalash"
        className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-ground-raised hover:text-ink"
      >
        <Copy className="size-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={() => copyText(credentialsMessage(detail, username, password), 'Xabar nusxalandi')}
        className="text-xs font-bold text-signal-ink hover:underline"
      >
        Xabarni nusxalash
      </button>
      <span className="w-full text-xs text-ink-muted">Birinchi kirishdan keyin bu yerdan o'chadi.</span>
    </div>
  )
}

/**
 * The center's own logins. In the overview's side column (`compact`) it is a list with a menu
 * per person; the form to add one opens from "+ Login", or straight away while there is none.
 */
function CenterAdmins({ detail, onChanged, compact = false }: { detail: AdminCenterDetail; onChanged: () => void; compact?: boolean }) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  /* Shown once: the server keeps only a hash. */
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null)
  const showForm = detail.admins.length === 0 || adding

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
      setAdding(false)
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
    <Card as="section" aria-labelledby={compact ? 'admins-side-title' : 'admins-title'} className={cx('space-y-4', detail.admins.length === 0 && 'border-signal')}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={compact ? 'admins-side-title' : 'admins-title'} className="flex items-center gap-3 text-lg font-extrabold text-ink">
          <Users aria-hidden="true" className="size-5 shrink-0 text-signal-ink" strokeWidth={1.8} />
          {compact ? 'Administratorlar' : 'Markaz administratorlari'}
        </h2>
        {detail.admins.length > 0 && !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <span className="flex items-center gap-1.5">
              <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
              Login
            </span>
          </Button>
        )}
      </div>

      {issued && (
        <IssuedCredentials
          detail={detail}
          username={issued.username}
          password={issued.password}
          onClose={() => setIssued(null)}
        />
      )}

      {detail.admins.length === 0 && !issued && (
        <p className="text-sm text-ink-muted">
          Markaz hali panelga kira olmaydi. Login yarating — parol o'zi tuziladi va markazga yuboriladigan tayyor xabar chiqadi.
        </p>
      )}

      {detail.admins.length > 0 && (
        <ul className="divide-y divide-hairline">
          {detail.admins.map((admin) => (
            <li key={admin.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-signal-soft text-sm font-extrabold text-signal-ink uppercase"
              >
                {admin.username.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">{admin.username}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {admin.displayName && admin.displayName !== admin.username ? `${admin.displayName} · ` : ''}
                  {admin.lastLoginAt ? `kirgan ${formatDateTime(admin.lastLoginAt)}` : 'hali kirmagan'}
                </span>
              </span>
              {admin.isActive ? <Badge tone="milestone">Administrator</Badge> : <Badge tone="caution">O'chirilgan</Badge>}
              <MenuButton
                label={`${admin.username} amallari`}
                className="flex size-9 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-ground-sunken hover:text-ink"
                items={[
                  { label: 'Yangi parol berish', onSelect: () => reset(admin.id, admin.username) },
                  {
                    label: admin.isActive ? "Loginni o'chirish" : 'Loginni yoqish',
                    onSelect: () => setActive(admin.id, !admin.isActive),
                    danger: admin.isActive,
                  },
                ]}
              >
                <EllipsisVertical aria-hidden="true" className="size-4" strokeWidth={2} />
              </MenuButton>
              {admin.pendingPassword && (
                <PendingPassword detail={detail} username={admin.username} password={admin.pendingPassword} />
              )}
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form onSubmit={create} className={cx('space-y-3', detail.admins.length > 0 && 'border-t-2 border-hairline pt-4')}>
          <Field label="Login">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s+/g, ''))}
              placeholder="ziyo-admin"
              autoComplete="off"
              className={fieldClass}
            />
          </Field>
          <Field label="Mas'ul shaxs ismi">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={detail.contactName ?? ''}
              className={fieldClass}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" block disabled={busy || username.trim().length < 3}>
              {busy ? 'Yaratilmoqda…' : 'Login yaratish'}
            </Button>
            {adding && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Bekor
              </Button>
            )}
          </div>
        </form>
      )}
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
                    <Button variant="secondary" size="sm" onClick={() => copyText(payLink(invoice.payToken), "To'lov havolasi nusxalandi")}>
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
