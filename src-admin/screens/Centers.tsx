import { useState } from 'react'
import { adminFetch, formatDate, formatDateTime, useAdminQuery } from '../lib/api'
import {
  centerStatusLabel,
  invoiceStatusLabel,
  leadStatusLabel,
  payModeLabel,
  somFromTiyin,
  type AdminCenterDetail,
  type AdminCenterInvoice,
  type AdminCenterLead,
  type AdminCenterRow,
  type CenterInvoiceStatus,
  type CenterStatus,
  type CenterStudent,
  type LeadStatus,
} from '../lib/center-types'
import {
  Badge,
  Button,
  Card,
  Cell,
  EmptyNote,
  ErrorNote,
  LoadingRows,
  PageHeader,
  Row,
  Screen,
  SectionHeading,
  Segmented,
  Select,
  Stat,
  Table,
  Tabs,
  Textarea,
} from '../components/ui'
import { Field, FormDialog, StudentDrawer, StudentsTable } from '../components/center'
import { fieldClass, formatSom } from '../lib/center-format'
import { toast } from '../lib/toast'

/*
 * The team's side of the B2B offer. A center exists because a contract was signed: it is made
 * here, by an admin, with its pay mode and price; its own admin login is handed over from here.
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
      <PageHeader title="O'quv markazlari" subtitle="B2B: markazlar, demo so'rovlari va oylik hisob-fakturalar" />

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
      {tab === 'invoices' && <InvoicesList />}

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

function CentersList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, error, isLoading, refresh } = useAdminQuery<AdminCenterRow[]>('/api/admin-portal/centers')

  if (error) return <ErrorNote onRetry={refresh}>{error}</ErrorNote>
  if (isLoading && !data) return <LoadingRows />
  if (!data || data.length === 0) return <EmptyNote>Hali markaz yo'q. Shartnoma imzolangach shu yerda qo'shing.</EmptyNote>

  const totalSeats = data.reduce((sum, center) => sum + center.activeStudents, 0)
  const totalBill = data.reduce((sum, center) => sum + center.billSoFarTiyin, 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Faol markazlar" value={data.filter((c) => c.status === 'active').length} />
        <Stat label="Faol o'quvchilar" value={totalSeats} />
        <Stat label="Shu oy hisob (hozircha)" value={formatSom(totalBill)} note="markaz to'laydigan markazlar" />
      </div>
      <Table head={['Markaz', 'Holat', "Kim to'laydi", "Faol o'quvchilar", "So'rovlar", 'Shu oy', 'Admin', 'Kod']}>
        {data.map((center) => (
          <Row key={center.id} onClick={() => onOpen(center.id)} label={center.name}>
            <Cell strong>
              {center.name}
              {center.city && <span className="block text-xs font-normal text-ink-muted">{center.city}</span>}
            </Cell>
            <Cell>
              <StatusBadge status={center.status} />
            </Cell>
            <Cell muted>{payModeLabel[center.payMode]}</Cell>
            <Cell>{center.activeStudents}</Cell>
            <Cell>{center.requested > 0 ? <Badge tone="signal">{center.requested}</Badge> : '0'}</Cell>
            <Cell>
              {center.payMode === 'center' ? (
                <>
                  {formatSom(center.billSoFarTiyin)}
                  <span className="block text-xs text-ink-muted">{center.billableThisMonth} o'quvchi</span>
                </>
              ) : (
                '—'
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
  const [contactPhone, setContactPhone] = useState(center?.contactPhone ?? lead?.phone ?? '')
  const [payMode, setPayMode] = useState(center?.payMode ?? 'center')
  const [price, setPrice] = useState(String(center ? somFromTiyin(center.pricePerSeatTiyin) : 99000))
  const [contractStartsOn, setContractStartsOn] = useState(center?.contractStartsOn ?? '')
  const [note, setNote] = useState(center?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
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
            contactPhone,
            payMode,
            pricePerSeatSom: Number(price.replace(/\s/g, '')) || null,
            contractStartsOn: contractStartsOn || null,
            note,
            leadId: lead?.id ?? null,
          }),
        },
      )
      toast(center ? 'Markaz saqlandi' : 'Markaz yaratildi')
      onSaved(detail)
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog title={center ? 'Markazni tahrirlash' : 'Yangi markaz'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Markaz nomi">
            <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} maxLength={120} />
          </Field>
          <Field label="Shahar">
            <input value={city} onChange={(event) => setCity(event.target.value)} className={fieldClass} placeholder="Toshkent" />
          </Field>
          <Field label="Mas'ul shaxs">
            <input value={contactName} onChange={(event) => setContactName(event.target.value)} className={fieldClass} />
          </Field>
          <Field label="Telefon">
            <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className={fieldClass} placeholder="+998 90 123 45 67" />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-bold text-ink">Kim to'laydi</span>
          <Segmented
            value={payMode}
            onChange={setPayMode}
            options={[
              { id: 'center', label: payModeLabel.center },
              { id: 'student', label: payModeLabel.student },
            ]}
          />
          <p className="mt-1 text-xs text-ink-muted">
            {payMode === 'center'
              ? "Markaz qo'shgan o'quvchiga Pro darhol ochiladi; markazga oylik hisob-faktura."
              : "Markaz ro'yxatga oladi, o'quvchi ilovada shu narxda o'zi to'laydi."}{' '}
            Bepul kunlar yo'q.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Narx, so'm / o'quvchi / oy">
            <input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" className={fieldClass} />
          </Field>
          <Field label="Shartnoma boshlanishi">
            <input type="date" value={contractStartsOn} onChange={(event) => setContractStartsOn(event.target.value)} className={fieldClass} />
          </Field>
        </div>

        <Field label="Izoh">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </Field>

        {failure && <ErrorNote>{failure}</ErrorNote>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button size="sm" type="submit" disabled={busy || name.trim().length < 2}>
            {busy ? 'Saqlanmoqda…' : 'Saqlash'}
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
  const [failure, setFailure] = useState('')

  async function patch(body: object, message: string) {
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/centers/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      toast(message)
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    }
  }

  return (
    <Screen className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Markazlar
        </Button>
      </div>

      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
      {failure && <ErrorNote>{failure}</ErrorNote>}
      {!data && !error && <LoadingRows />}

      {data && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">{data.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <StatusBadge status={data.status} />
                <Badge tone="signal">{payModeLabel[data.payMode]}</Badge>
                <span>{formatSom(data.pricePerSeatTiyin)} / o'quvchi / oy</span>
                {data.city && <span>· {data.city}</span>}
                {data.contractStartsOn && <span>· shartnoma {formatDate(data.contractStartsOn)}</span>}
              </div>
              {(data.contactName || data.contactPhone) && (
                <p className="mt-1 text-sm text-ink-muted">
                  {data.contactName} {data.contactPhone}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Tahrirlash
              </Button>
              {data.status === 'active' ? (
                <Button variant="danger" size="sm" onClick={() => patch({ status: 'suspended' }, "Markaz to'xtatildi")}>
                  To'xtatish
                </Button>
              ) : (
                <Button size="sm" onClick={() => patch({ status: 'active' }, 'Markaz faollashtirildi')}>
                  Faollashtirish
                </Button>
              )}
              {data.status !== 'archived' && (
                <Button variant="ghost" size="sm" onClick={() => patch({ status: 'archived' }, 'Markaz arxivlandi')}>
                  Arxivlash
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Faol o'quvchilar" value={data.overview.activeStudents} note={`${data.overview.notSignedIn} tasi hali kirmagan`} />
            <Stat label="Bu hafta mashq qilgan" value={`${data.overview.weeklyActivePercent}%`} />
            <Stat label="Xavf ostida" value={data.overview.atRisk} />
            <Stat
              label="Shu oy"
              value={data.payMode === 'center' ? formatSom(data.overview.billSoFarTiyin) : '—'}
              note={data.payMode === 'center' ? `${data.overview.billableThisMonth} o'quvchi hisobda` : "o'quvchilar o'zi to'laydi"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <CenterAdmins detail={data} onChanged={refresh} />
            <Card as="div" className="space-y-3">
              <SectionHeading
                action={
                  <Button variant="secondary" size="sm" onClick={() => patch({ newJoinCode: true }, 'Yangi kod yaratildi')}>
                    Yangi kod
                  </Button>
                }
              >
                Markaz kodi
              </SectionHeading>
              <div className="font-mono text-3xl font-extrabold tracking-[0.2em] text-ink">{data.joinCode}</div>
              <p className="text-sm text-ink-muted">
                O'quvchilar ilovada shu kodni yozib qo'shilish so'rovini yuboradi. Yangi kod eskisini bekor qiladi.
              </p>
            </Card>
          </div>

          <section>
            <SectionHeading>O'quvchilar</SectionHeading>
            {students.error && <ErrorNote onRetry={students.refresh}>{students.error}</ErrorNote>}
            {students.data && (
              <StudentsTable
                students={students.data}
                onOpen={(student) => setOpenSeat(student.seatId)}
                showPaid={data.payMode === 'student'}
              />
            )}
          </section>

          <section>
            <SectionHeading>Hisob-fakturalar</SectionHeading>
            <InvoicesTable invoices={data.invoices} onChanged={refresh} showCenter={false} />
          </section>

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
            <TeamStudentDrawer centerId={id} seatId={openSeat} detail={data} onClose={() => setOpenSeat(null)} />
          )}
        </>
      )}
    </Screen>
  )
}

/**
 * The team looks at a center's student read-only: changing seats is the center's job, and the
 * center-portal endpoints that do it only answer the center's own token.
 */
function TeamStudentDrawer({
  centerId,
  seatId,
  detail,
  onClose,
}: {
  centerId: string
  seatId: string
  detail: AdminCenterDetail
  onClose: () => void
}) {
  return (
    <StudentDrawer
      seatId={seatId}
      groups={detail.overview.groups}
      basePath={`/api/admin-portal/centers/${centerId}`}
      readOnly
      onClose={onClose}
      onChanged={() => undefined}
    />
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
      <SectionHeading>Markaz administratorlari</SectionHeading>

      {issued && (
        <div className="rounded-[var(--radius-control)] border-2 border-signal bg-signal-soft px-4 py-3 text-sm text-signal-ink">
          Markazga yuboring (faqat hozir ko'rinadi): admin.russian.gg · login <b>{issued.username}</b> · parol{' '}
          <b className="font-mono">{issued.password}</b>
        </div>
      )}

      {detail.admins.length === 0 ? (
        <p className="text-sm text-ink-muted">Hali login yo'q.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {detail.admins.map((admin) => (
            <li key={admin.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="text-sm">
                <span className="font-bold text-ink">{admin.username}</span>{' '}
                <span className="text-ink-muted">
                  {admin.displayName} · oxirgi kirish {formatDateTime(admin.lastLoginAt)}
                </span>
                {!admin.isActive && (
                  <span className="ml-2">
                    <Badge tone="caution">O'chirilgan</Badge>
                  </span>
                )}
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

      <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
        <Button type="submit" disabled={busy || username.trim().length < 3}>
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
                {lead.phone}
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

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function previousMonth() {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function InvoicesList() {
  const [month, setMonth] = useState(previousMonth)
  const { data, error, isLoading, refresh } = useAdminQuery<AdminCenterInvoice[]>(
    `/api/admin-portal/center-invoices?month=${month}`,
  )
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function generate() {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch('/api/admin-portal/center-invoices/generate', { method: 'POST', body: JSON.stringify({ month }) })
      toast('Hisob-fakturalar yangilandi')
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Yaratib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  const total = (data ?? []).filter((invoice) => invoice.status !== 'cancelled').reduce((sum, invoice) => sum + invoice.amountTiyin, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Oy">
          <input type="month" value={month} max={currentMonth()} onChange={(event) => setMonth(event.target.value)} className={fieldClass} />
        </Field>
        <Button variant="secondary" onClick={generate} disabled={busy}>
          {busy ? 'Hisoblanmoqda…' : 'Qoralamalarni hisoblash'}
        </Button>
        {data && data.length > 0 && <span className="pb-3 text-sm text-ink-muted">Jami: {formatSom(total)}</span>}
      </div>
      <p className="text-xs text-ink-muted">
        Har oy boshida o'tgan oy uchun qoralamalar avtomatik yaratiladi. Faqat shu oy faol bo'lgan va mashq qilgan
        o'quvchilar hisoblanadi. Yuborilgan hisob 7 kun ichida to'lanmasa “Muddati o'tgan” bo'ladi.
      </p>
      {failure && <ErrorNote>{failure}</ErrorNote>}
      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
      {isLoading && !data && <LoadingRows />}
      {data && <InvoicesTable invoices={data} onChanged={refresh} showCenter />}
    </div>
  )
}

function InvoicesTable({
  invoices,
  onChanged,
  showCenter,
}: {
  invoices: AdminCenterInvoice[]
  onChanged: () => void
  showCenter: boolean
}) {
  const [failure, setFailure] = useState('')

  async function setStatus(invoice: AdminCenterInvoice, status: string) {
    setFailure('')
    try {
      await adminFetch(`/api/admin-portal/center-invoices/${invoice.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      toast(`Holat: ${invoiceStatusLabel[status as CenterInvoiceStatus]}`)
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    }
  }

  if (invoices.length === 0) return <EmptyNote>Bu davr uchun hisob-faktura yo'q.</EmptyNote>

  const head = [...(showCenter ? ['Markaz'] : []), 'Oy', "O'quvchilar", 'Narx', 'Summa', 'Holat', "To'langan"]

  return (
    <div className="space-y-3">
      {failure && <ErrorNote>{failure}</ErrorNote>}
      <Table head={head}>
        {invoices.map((invoice) => (
          <Row key={invoice.id}>
            {showCenter && <Cell strong>{invoice.centerName}</Cell>}
            <Cell>{invoice.month}</Cell>
            <Cell>{invoice.activeSeats}</Cell>
            <Cell muted>{formatSom(invoice.pricePerSeatTiyin)}</Cell>
            <Cell strong>{formatSom(invoice.amountTiyin)}</Cell>
            <Cell>
              <Select
                label="Holat"
                value={invoice.status}
                onChange={(value) => setStatus(invoice, value)}
                options={(Object.keys(invoiceStatusLabel) as CenterInvoiceStatus[]).map((value) => ({
                  value,
                  label: invoiceStatusLabel[value],
                }))}
              />
            </Cell>
            <Cell muted>{formatDate(invoice.paidAt)}</Cell>
          </Row>
        ))}
      </Table>
    </div>
  )
}
