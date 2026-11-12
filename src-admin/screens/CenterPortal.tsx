import { useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, X } from 'lucide-react'
import { cx } from '../../src/lib/cx'
import { adminApiPath, adminFetch, formatDate, session, useAdminQuery } from '../lib/api'
import {
  type AddStudentsResult,
  type CenterGroup,
  type CenterOverview,
  type CenterPayView,
  type CenterStudent,
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
  LoadingStats,
  PageHeader,
  Row,
  Screen,
  SectionHeading,
  Segmented,
  Stat,
  Table,
  Textarea,
  TextField,
} from '../components/ui'
import { Field, FormDialog, InvoiceBadge, PayButtons, StudentDrawer, StudentsTable } from '../components/center'
import { fieldClass, formatPeriod, formatSom, maskUzLocal, payLink, uzLocalDigits } from '../lib/center-format'
import { readStudentsFile, downloadStudentsTemplate } from '../lib/student-import'
import { toast } from '../lib/toast'

/*
 * A language center's own admin page. Groups are hidden for now (CenterGroupsScreen stays for
 * later): a center only has to add students to start.
 *
 * A language center's own admin page. Everything here reads and writes /api/center-portal,
 * whose every endpoint is scoped to the center in the admin's token; nothing on this screen
 * names a center id.
 */

const BASE = '/api/center-portal'

// ------------------------------------------------------------------------------- overview

export function CenterOverviewScreen({ onOpenStudents }: { onOpenStudents: (filter: StudentFilter) => void }) {
  const { data, error, isLoading, refresh } = useAdminQuery<CenterOverview>(`${BASE}/overview`)

  return (
    <Screen className="space-y-6">
      <PageHeader title={data?.name ?? session.centerName() ?? 'Markaz'} subtitle="Bu hafta o'quvchilaringiz qanday mashq qilmoqda" />

      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
      {isLoading && !data && <LoadingStats count={4} />}

      {data && (
        <>
          <AccessBanner overview={data} />

          {data.requested > 0 && (
            <button
              type="button"
              onClick={() => onOpenStudents('requested')}
              className="w-full rounded-[var(--radius-card)] border-2 border-signal bg-signal-soft px-4 py-3 text-left text-sm font-bold text-signal-ink"
            >
              {data.requested} ta o'quvchi kod orqali qo'shilishni so'radi — tasdiqlash uchun bosing
            </button>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" className="text-left" onClick={() => onOpenStudents('active')}>
              <Stat
                label="Faol o'quvchilar"
                value={
                  <>
                    {data.activeStudents}
                    <span className="text-lg text-ink-faint"> / {data.maxStudents}</span>
                  </>
                }
                note={
                  data.notSignedIn > 0
                    ? `${data.notSignedIn} tasi ilovaga hali kirmagan`
                    : `${Math.max(0, data.maxStudents - data.activeStudents)} ta joy bo'sh`
                }
              />
            </button>
            <Stat
              label="Pro muddati"
              value={data.paidThrough ? formatDate(data.paidThrough) : "To'lanmagan"}
              note={data.paidThrough ? 'gacha to\'langan' : "to'lovdan keyin ochiladi"}
            />
            <Stat label="Bu hafta mashq qilgan" value={`${data.weeklyActivePercent}%`} note="faol o'quvchilardan" />
            <button type="button" className="text-left" onClick={() => onOpenStudents('risk')}>
              <Stat
                label="Xavf ostida"
                value={data.atRisk}
                note="7+ kun kirmagan yoki ortda qolgan"
                badge={data.atRisk > 0 ? <Badge tone="danger">Ko'rish</Badge> : undefined}
              />
            </button>
          </div>

          <PaymentCard overview={data} />

        </>
      )}
    </Screen>
  )
}

/** Says plainly, at the top, when the students have no Pro and what fixes it. */
function AccessBanner({ overview }: { overview: CenterOverview }) {
  const message = {
    open: null,
    suspended: "Markaz o'chirilgan: o'quvchilar bepul rejada. Russian.gg jamoasi bilan bog'laning.",
    archived: "Markaz arxivda: o'quvchilar bepul rejada. Russian.gg jamoasi bilan bog'laning.",
    not_started: `Shartnoma ${formatDate(overview.contractStartsOn)} dan boshlanadi — o'quvchilarda Pro shu kuni ochiladi.`,
    unpaid: "To'lov qilinmagan: o'quvchilar hozir bepul rejada. Quyidagi tugma orqali to'lang — Pro darhol ochiladi.",
  }[overview.access]

  if (!message) return null
  const tone = overview.access === 'not_started' ? 'border-signal bg-signal-soft text-signal-ink' : 'border-caution bg-caution-soft text-caution'
  return (
    <div role="status" className={cx('rounded-[var(--radius-card)] border-2 px-4 py-3 text-sm font-bold', tone)}>
      {message}
    </div>
  )
}

/**
 * The month the center pays next: amount, what it covers, and Click / Payme right here. The
 * same pay link works for whoever at the center holds the money, without a login.
 */
function PaymentCard({ overview }: { overview: CenterOverview }) {
  const open = overview.openInvoice
  const pay = useAdminQuery<CenterPayView>(open ? `/api/public/center-pay/${open.payToken}` : null)
  const [copied, setCopied] = useState(false)

  return (
    <Card as="div" className="space-y-4">
      <SectionHeading action={open && <InvoiceBadge status={open.status} />}>To'lov</SectionHeading>
      {open ? (
        <>
          <div>
            <div className="text-3xl font-extrabold tabular-nums text-ink">{formatSom(open.amountTiyin)}</div>
            <p className="mt-1 text-sm text-ink-muted">
              {formatPeriod(open.periodStart, open.periodEnd)} · {open.seats} o'quvchi × {formatSom(open.pricePerSeatTiyin)}
            </p>
          </div>
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
            Hisobchiga yuborish uchun havola:{' '}
            <button
              type="button"
              className="font-bold text-signal-ink hover:underline"
              onClick={async () => {
                await navigator.clipboard?.writeText(payLink(open.payToken))
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? 'nusxa olindi' : 'nusxa olish'}
            </button>
            . Bank o'tkazmasi bilan to'lasangiz, Russian.gg jamoasi uni qo'lda tasdiqlaydi.
          </p>
        </>
      ) : (
        <p className="text-sm text-ink">
          {overview.paidThrough
            ? `${formatDate(overview.paidThrough)} gacha to'langan. Keyingi oy hisob-fakturasi muddat tugashidan 7 kun oldin shu yerda paydo bo'ladi.`
            : "Hozircha to'lanadigan hisob-faktura yo'q. Russian.gg jamoasi bilan bog'laning."}
        </p>
      )}
    </Card>
  )
}

function GroupsTable({ groups, onEdit }: { groups: CenterGroup[]; onEdit?: (group: CenterGroup) => void }) {
  if (groups.length === 0) return <EmptyNote>Hali guruh yo'q.</EmptyNote>

  return (
    <Table head={['Guruh', 'Daraja', "O'quvchilar", 'Bu hafta faol', "O'rtacha kun", 'Xavf ostida']}>
      {groups.map((group) => (
        <Row key={group.id} onClick={onEdit ? () => onEdit(group) : undefined} label={group.name}>
          <Cell strong>
            {group.name}
            {group.archived && (
              <span className="ml-2">
                <Badge>Arxiv</Badge>
              </span>
            )}
            {group.scheduleNote && <span className="block text-xs font-normal text-ink-muted">{group.scheduleNote}</span>}
          </Cell>
          <Cell>{group.level ?? '—'}</Cell>
          <Cell>
            {group.activeStudents}
            {group.students > group.activeStudents && <span className="text-ink-muted"> / {group.students}</span>}
          </Cell>
          <Cell>{group.weeklyActivePercent}%</Cell>
          <Cell>{group.averageCourseDay ?? '—'}</Cell>
          <Cell>{group.atRisk > 0 ? <Badge tone="danger">{group.atRisk}</Badge> : '0'}</Cell>
        </Row>
      ))}
    </Table>
  )
}

// ------------------------------------------------------------------------------- groups

export function CenterGroupsScreen() {
  const { data, error, isLoading, refresh } = useAdminQuery<CenterOverview>(`${BASE}/overview`)
  const [editing, setEditing] = useState<CenterGroup | 'new' | null>(null)
  const [activation, setActivation] = useState<{ group: CenterGroup; active: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function setGroupActive() {
    if (!activation) return
    setBusy(true)
    try {
      const result = await adminFetch<{ changed: number; overLimit: number }>(`${BASE}/groups/${activation.group.id}/activation`, {
        method: 'POST',
        body: JSON.stringify({ active: activation.active }),
      })
      toast(
        `${result.changed} ta o'quvchi ${activation.active ? 'faollashtirildi' : "o'chirildi"}` +
          (result.overLimit > 0 ? ` · ${result.overLimit} tasi limit tufayli qoldi` : ''),
      )
      setActivation(null)
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "O'zgartirib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  const groups = data?.groups ?? []

  return (
    <Screen className="space-y-6">
      <PageHeader title="Guruhlar" subtitle="Sinflaringiz va ulardagi o'quvchilar" />

      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>+ Guruh yaratish</Button>
      </div>

      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
      {failure && <ErrorNote>{failure}</ErrorNote>}
      {isLoading && !data && <LoadingRows />}

      {data && groups.length === 0 && (
        <Card as="div" className="text-center">
          <p className="text-sm text-ink-muted">Birinchi guruhni yarating, keyin unga o'quvchilarni qo'shasiz.</p>
          <div className="mt-3">
            <Button onClick={() => setEditing('new')}>Birinchi guruhni yaratish</Button>
          </div>
        </Card>
      )}

      {groups.length > 0 && <GroupsTable groups={groups} onEdit={(group) => setEditing(group)} />}

      {editing && (
        <GroupDialog
          group={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
          onActivation={(group, active) => {
            setEditing(null)
            setActivation({ group, active })
          }}
        />
      )}

      {activation && data && (
        <ConfirmDialog
          title={activation.active ? 'Guruhni faollashtirish' : "Guruhni o'chirish"}
          body={
            activation.active ? (
              <>
                “{activation.group.name}” guruhidagi o'chirilgan o'quvchilar yana faol bo'ladi — limitdagi bo'sh joylar (
                {Math.max(0, data.maxStudents - data.activeStudents)} ta) to'lguncha.
              </>
            ) : (
              <>
                “{activation.group.name}” guruhidagi {activation.group.activeStudents} ta faol o'quvchi o'chiriladi: Pro yopiladi,
                natijalar saqlanadi, limitda joy bo'shaydi.
              </>
            )
          }
          confirmLabel={activation.active ? 'Faollashtirish' : "O'chirish"}
          confirmVariant={activation.active ? 'primary' : 'danger'}
          busy={busy}
          onConfirm={setGroupActive}
          onCancel={() => setActivation(null)}
        />
      )}
    </Screen>
  )
}

function GroupDialog({
  group,
  onClose,
  onSaved,
  onActivation,
}: {
  group: CenterGroup | null
  onClose: () => void
  onSaved: () => void
  onActivation: (group: CenterGroup, active: boolean) => void
}) {
  const [name, setName] = useState(group?.name ?? '')
  const [level, setLevel] = useState(group?.level ?? 'A1')
  const [schedule, setSchedule] = useState(group?.scheduleNote ?? '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function save(archived?: boolean) {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(group ? `${BASE}/groups/${group.id}` : `${BASE}/groups`, {
        method: group ? 'PATCH' : 'POST',
        body: JSON.stringify({ name: name.trim(), level, scheduleNote: schedule.trim(), archived }),
      })
      toast(group ? 'Guruh saqlandi' : 'Guruh yaratildi')
      onSaved()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog title={group ? group.name : 'Yangi guruh'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <Field label="Nomi">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="A1 — kechki" className={fieldClass} maxLength={80} />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-bold text-ink">Daraja</span>
          <Segmented
            value={level}
            onChange={setLevel}
            options={['A1', 'A2', 'B1', 'B2'].map((id) => ({ id, label: id }))}
          />
        </div>
        <Field label="Jadval (ixtiyoriy)">
          <input value={schedule} onChange={(event) => setSchedule(event.target.value)} placeholder="Du, Chor, Ju — 18:00" className={fieldClass} maxLength={200} />
        </Field>

        {failure && <ErrorNote>{failure}</ErrorNote>}

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <div className="flex flex-wrap gap-2">
            {group && !group.archived && (
              <>
                <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={() => onActivation(group, false)}>
                  Hammasini o'chirish
                </Button>
                <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={() => onActivation(group, true)}>
                  Hammasini faollashtirish
                </Button>
              </>
            )}
            {group && (
              <Button variant="ghost" size="sm" type="button" disabled={busy} onClick={() => save(!group.archived)}>
                {group.archived ? 'Arxivdan chiqarish' : 'Arxivlash'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={busy}>
              Bekor qilish
            </Button>
            <Button size="sm" type="submit" disabled={busy || name.trim().length === 0}>
              {busy ? 'Saqlanmoqda…' : 'Saqlash'}
            </Button>
          </div>
        </div>
      </form>
    </FormDialog>
  )
}

// ------------------------------------------------------------------------------- students

export type StudentFilter = 'all' | 'active' | 'requested' | 'deactivated' | 'risk'

/**
 * The status filter. Chips that wrap rather than a segmented control: five labels with counts
 * do not fit one fixed-width row, and the selected one used to spill over its neighbour.
 */
function FilterChips({
  value,
  onChange,
  options,
}: {
  value: StudentFilter
  onChange: (value: StudentFilter) => void
  options: Array<{ id: StudentFilter; label: string; count: number; tone?: 'signal' | 'danger' }>
}) {
  return (
    <div role="group" aria-label="Holat bo'yicha" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cx(
              'inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border-2 px-3.5 text-sm font-bold transition-colors',
              selected
                ? 'border-ink bg-ink text-ground-raised'
                : 'border-hairline bg-ground-raised text-ink-muted hover:border-ink-faint hover:text-ink',
            )}
          >
            {option.label}
            <span
              className={cx(
                'min-w-6 rounded-[var(--radius-control)] px-1.5 text-center text-xs font-extrabold tabular-nums',
                selected
                  ? 'bg-ground-raised/20 text-ground-raised'
                  : option.tone === 'danger' && option.count > 0
                    ? 'bg-danger-soft text-danger'
                    : option.tone === 'signal' && option.count > 0
                      ? 'bg-signal text-on-signal'
                      : 'bg-ground-sunken text-ink-muted',
              )}
            >
              {option.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function CenterStudentsScreen({ initialFilter = 'all' }: { initialFilter?: StudentFilter }) {
  const students = useAdminQuery<CenterStudent[]>(`${BASE}/students`)
  const overview = useAdminQuery<CenterOverview>(`${BASE}/overview`)
  const [filter, setFilter] = useState<StudentFilter>(initialFilter)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  /* The add dialog, empty or filled from an Excel file. */
  const [adding, setAdding] = useState<DraftStudent[] | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [answering, setAnswering] = useState<string | null>(null)
  const [failure, setFailure] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const all = useMemo(() => students.data ?? [], [students.data])

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase()
    const digits = query.replace(/\D/g, '')
    return all.filter((student) => {
      if (filter === 'risk' && !student.atRisk) return false
      if (filter !== 'all' && filter !== 'risk' && student.status !== filter) return false
      if (
        query &&
        !student.name.toLowerCase().includes(query) &&
        !(digits && student.phone.replace(/\D/g, '').includes(digits))
      ) {
        return false
      }
      return true
    })
  }, [all, filter, search])

  const refresh = () => {
    students.refresh()
    overview.refresh()
  }

  async function exportCsv() {
    setExporting(true)
    setFailure('')
    try {
      const response = await fetch(adminApiPath(`${BASE}/students/export`), {
        headers: { authorization: `Bearer ${session.token()}` },
      })
      if (!response.ok) throw new Error("Yuklab bo'lmadi.")
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `oquvchilar-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Yuklab bo'lmadi.")
    } finally {
      setExporting(false)
    }
  }

  async function importFile(file: File) {
    setImporting(true)
    setFailure('')
    try {
      const rows = await readStudentsFile(file)
      if (rows.length === 0) throw new Error("Faylda o'quvchi topilmadi. Shablondagi ustunlarni to'ldiring.")
      setAdding(
        rows.map((row) => {
          const local = uzLocalDigits(row.phone)
          return { key: draftKey++, name: row.name, phone: local ? maskUzLocal(local) : row.phone }
        }),
      )
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Faylni o'qib bo'lmadi.")
    } finally {
      setImporting(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  /** A join request answered from its row: approve takes a seat under the limit, reject drops it. */
  async function answer(student: CenterStudent, approve: boolean) {
    setAnswering(student.seatId)
    setFailure('')
    try {
      await adminFetch(`${BASE}/students/${student.seatId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: approve ? 'activate' : 'remove' }),
      })
      toast(approve ? `${student.name} tasdiqlandi` : `${student.name} so'rovi rad etildi`)
      refresh()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "O'zgartirib bo'lmadi.")
    } finally {
      setAnswering(null)
    }
  }

  const free = overview.data ? Math.max(0, overview.data.maxStudents - overview.data.activeStudents) : null

  const count = (status: StudentFilter) =>
    status === 'all'
      ? all.length
      : status === 'risk'
        ? all.filter((s) => s.atRisk).length
        : all.filter((s) => s.status === status).length

  return (
    <Screen className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="O'quvchilar"
          subtitle={
            overview.data
              ? `Faol: ${overview.data.activeStudents} / ${overview.data.maxStudents} · bo'sh joy: ${free}`
              : 'Kim mashq qilyapti, kim ortda qolmoqda'
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={exporting || all.length === 0}>
            {exporting ? 'Yuklanmoqda…' : 'CSV yuklab olish'}
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={importing}>
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet aria-hidden="true" className="size-4" strokeWidth={1.8} />
              {importing ? "O'qilmoqda…" : "Excel'dan import"}
            </span>
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importFile(file)
            }}
          />
          <Button onClick={() => setAdding([])}>+ O'quvchi qo'shish</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'Hammasi', count: count('all') },
            { id: 'active', label: 'Faol', count: count('active') },
            { id: 'requested', label: 'Kutilmoqda', count: count('requested'), tone: 'signal' },
            { id: 'deactivated', label: "O'chirilgan", count: count('deactivated') },
            { id: 'risk', label: 'Xavf ostida', count: count('risk'), tone: 'danger' },
          ]}
        />
        <TextField value={search} onChange={setSearch} placeholder="Ism yoki telefon" className="w-full sm:w-64" />
      </div>

      {students.error && <ErrorNote onRetry={refresh}>{students.error}</ErrorNote>}
      {failure && <ErrorNote>{failure}</ErrorNote>}
      {students.isLoading && !students.data && <LoadingRows />}

      {students.data && all.length === 0 && (
        <Card as="div" className="text-center">
          <h2 className="text-lg font-extrabold text-ink">Birinchi o'quvchilaringizni qo'shing</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-ink-muted">
            Ism va telefon raqamini kiriting — o'quvchi shu raqam bilan ilovaga kirishi bilan Pro avtomatik ochiladi.
            Raqami yo'q o'quvchi markaz kodini yozadi: <b className="text-ink">{overview.data?.joinCode ?? '…'}</b>
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setAdding([])}>O'quvchi qo'shish</Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              Excel'dan import
            </Button>
          </div>
        </Card>
      )}

      {all.length > 0 && shown.length === 0 && <EmptyNote>Bu filtrda o'quvchi yo'q.</EmptyNote>}

      {shown.length > 0 && (
        <StudentsTable
          students={shown}
          onOpen={(student) => setOpen(student.seatId)}
          showGroup={false}
          onApprove={(student) => answer(student, true)}
          onReject={(student) => answer(student, false)}
          busySeat={answering}
        />
      )}

      {adding && (
        <AddStudentsDialog
          initialRows={adding}
          free={free}
          onClose={() => setAdding(null)}
          onAdded={refresh}
        />
      )}

      {open && (
        <StudentDrawer seatId={open} groups={[]} basePath={BASE} onClose={() => setOpen(null)} onChanged={refresh} />
      )}
    </Screen>
  )
}

type DraftStudent = { key: number; name: string; phone: string }

const localDigits = uzLocalDigits
const formatLocal = maskUzLocal

/** "Ali Valiyev, 90 123 45 67" per line, either order — a list copied out of Excel or Telegram. */
function parseLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const phoneFirst = line.match(/^([+\d][\d\s()+-]{6,})[\s,;\t]*(.*)$/)
      if (phoneFirst) return { phone: phoneFirst[1].trim(), name: phoneFirst[2].trim() }
      const nameFirst = line.match(/^(.*?)[\s,;\t]+([+\d][\d\s()+-]{6,})$/)
      if (nameFirst) return { name: nameFirst[1].trim(), phone: nameFirst[2].trim() }
      return { name: '', phone: line }
    })
}

let draftKey = 1
const emptyDraft = (): DraftStudent => ({ key: draftKey++, name: '', phone: '' })

function AddStudentsDialog({
  initialRows,
  free,
  onClose,
  onAdded,
}: {
  /** Rows read from an Excel file, to check and send; empty for a blank form. */
  initialRows: DraftStudent[]
  /** Places left under the center's limit, when known. */
  free: number | null
  onClose: () => void
  onAdded: () => void
}) {
  const [rows, setRows] = useState<DraftStudent[]>(() => (initialRows.length > 0 ? initialRows : [emptyDraft()]))
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [result, setResult] = useState<AddStudentsResult | null>(null)

  const filled = rows.filter((row) => row.phone.trim() || row.name.trim())
  const valid = filled.filter((row) => localDigits(row.phone))
  const invalidCount = filled.length - valid.length

  function update(key: number, patch: Partial<DraftStudent>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function remove(key: number) {
    setRows((current) => (current.length === 1 ? [emptyDraft()] : current.filter((row) => row.key !== key)))
  }

  function addRow() {
    setRows((current) => [...current, emptyDraft()])
  }

  function importPasted() {
    const parsed = parseLines(pasted).map((item) => {
      const local = localDigits(item.phone)
      return { key: draftKey++, name: item.name, phone: local ? formatLocal(local) : item.phone }
    })
    if (parsed.length === 0) return
    setRows((current) => [...current.filter((row) => row.phone.trim() || row.name.trim()), ...parsed])
    setPasted('')
    setPasting(false)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (valid.length === 0 || invalidCount > 0) return

    setBusy(true)
    setFailure('')
    try {
      const next = await adminFetch<AddStudentsResult>(`${BASE}/students`, {
        method: 'POST',
        body: JSON.stringify({
          groupId: null,
          students: valid.map((row) => ({ phone: `+998${localDigits(row.phone)}`, name: row.name.trim() || null })),
        }),
      })
      setResult(next)
      if (next.added > 0) {
        toast(`${next.added} ta o'quvchi qo'shildi`)
        onAdded()
      }
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Qo'shib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <FormDialog title="Tayyor" onClose={onClose}>
        <div className="space-y-3 text-sm">
          <p className="text-ink">
            <b>{result.added}</b> ta o'quvchi qo'shildi. Ular ilovaga shu raqam bilan kirishi bilan Pro ochiladi.
          </p>
          {result.overLimit.length > 0 && (
            <p className="rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 font-bold text-caution">
              Limit to'ldi ({result.maxStudents} ta): {result.overLimit.length} ta raqam qo'shilmadi. Ko'proq o'quvchi uchun
              Russian.gg jamoasiga murojaat qiling.
            </p>
          )}
          {result.alreadyHere.length > 0 && (
            <p className="text-ink-muted">Allaqachon ro'yxatda: {result.alreadyHere.join(', ')}</p>
          )}
          {result.inOtherCenter.length > 0 && (
            <p className="text-caution">
              Boshqa markazda: {result.inOtherCenter.join(', ')} — o'quvchi avval u markazdan chiqishi kerak.
            </p>
          )}
          {result.invalid.length > 0 && <p className="text-danger">Noto'g'ri raqam: {result.invalid.join(', ')}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setResult(null)
              setRows([emptyDraft()])
              setTouched(false)
            }}
          >
            Yana qo'shish
          </Button>
          <Button size="sm" onClick={onClose}>
            Yopish
          </Button>
        </div>
      </FormDialog>
    )
  }

  return (
    <FormDialog title="O'quvchi qo'shish" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-ink-muted">
          O'quvchi shu raqam bilan ilovaga kirishi bilan Pro avtomatik ochiladi.
          {free !== null && (
            <>
              {' '}
              Limitda <b className="text-ink">{free}</b> ta bo'sh joy bor.
            </>
          )}
        </p>
        {free !== null && valid.length > free && (
          <p role="status" className="rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 text-sm font-bold text-caution">
            {valid.length} ta raqam kiritildi, lekin faqat {free} tasi qo'shiladi. Limitni oshirish uchun Russian.gg jamoasiga
            yozing.
          </p>
        )}

        <div className="space-y-3">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 text-sm font-bold text-ink sm:grid">
            <span>Ism va familiya</span>
            <span>Telefon raqam</span>
            <span />
          </div>
          {rows.map((row, index) => {
            const showError = touched && Boolean(row.phone.trim() || row.name.trim()) && !localDigits(row.phone)
            return (
              <div
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_44px] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px]"
              >
                <label className="col-span-2 sm:col-span-1">
                  <span className="sr-only">Ism va familiya, {index + 1}-o'quvchi</span>
                  <input
                    value={row.name}
                    onChange={(event) => update(row.key, { name: event.target.value })}
                    placeholder="Ali Valiyev"
                    autoComplete="off"
                    autoFocus={index === rows.length - 1}
                    className={fieldClass}
                  />
                </label>
                <label className="min-w-0">
                  <span className="sr-only">Telefon raqam, {index + 1}-o'quvchi</span>
                  <span
                    className={cx(
                      'flex h-11 items-center rounded-[var(--radius-control)] border-2 bg-ground-raised focus-within:border-signal',
                      showError ? 'border-danger' : 'border-hairline',
                    )}
                  >
                    <span className="pr-1 pl-4 text-sm font-bold text-ink-muted">+998</span>
                    <input
                      value={row.phone}
                      onChange={(event) => update(row.key, { phone: event.target.value })}
                      onBlur={() => {
                        const local = localDigits(row.phone)
                        if (local) update(row.key, { phone: formatLocal(local) })
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && index === rows.length - 1 && localDigits(row.phone)) {
                          event.preventDefault()
                          addRow()
                        }
                      }}
                      inputMode="tel"
                      placeholder="90 123 45 67"
                      autoComplete="off"
                      aria-invalid={showError}
                      className="h-full min-w-0 flex-1 rounded-r-[var(--radius-control)] bg-transparent pr-4 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                  </span>
                  {showError && (
                    <span className="mt-1 block text-xs text-danger">9 ta raqam kiriting, masalan 90 123 45 67</span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  aria-label={`${index + 1}-qatorni o'chirish`}
                  className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-ink-faint hover:bg-ground-sunken hover:text-danger"
                >
                  <X aria-hidden="true" className="size-4" strokeWidth={2} />
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={addRow}>
            + Yana o'quvchi
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => setPasting((value) => !value)}>
            {pasting ? "Ro'yxatni yopish" : "Ro'yxatni nusxa olib qo'yish"}
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => void downloadStudentsTemplate()}>
            <span className="flex items-center gap-1.5">
              <Download aria-hidden="true" className="size-4" strokeWidth={1.8} />
              Excel shablon
            </span>
          </Button>
        </div>

        {pasting && (
          <div className="space-y-3 rounded-[var(--radius-card)] bg-ground-sunken p-4">
            <Field label="Excel yoki Telegram'dan ro'yxat" hint="Har qatorga bitta o'quvchi: ism va raqam, istalgan tartibda.">
              <Textarea
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                rows={5}
                placeholder={'Ali Valiyev, 90 123 45 67\nDilnoza Karimova  93 765 43 21'}
              />
            </Field>
            <Button size="sm" type="button" onClick={importPasted} disabled={!pasted.trim()}>
              Formaga qo'shish
            </Button>
          </div>
        )}

        {failure && <ErrorNote>{failure}</ErrorNote>}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t-2 border-hairline pt-4">
          {invalidCount > 0 && touched && (
            <p className="mr-auto text-xs font-bold text-danger">{invalidCount} ta qatorda raqam noto'g'ri — tuzating yoki o'chiring</p>
          )}
          <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button size="sm" type="submit" disabled={busy || valid.length === 0}>
            {busy ? "Qo'shilmoqda…" : valid.length > 1 ? `${valid.length} ta o'quvchini qo'shish` : "O'quvchini qo'shish"}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

// ------------------------------------------------------------------------------- settings

export function CenterSettingsScreen() {
  const { data, error, refresh } = useAdminQuery<CenterOverview>(`${BASE}/overview`)
  const [copied, setCopied] = useState(false)

  return (
    <Screen className="space-y-6">
      <PageHeader title="Sozlamalar" subtitle="Markaz kodi, limit va to'lov sharti" />
      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card as="div" className="space-y-3">
            <SectionHeading>Markaz kodi</SectionHeading>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-extrabold tracking-[0.2em] text-ink">{data.joinCode}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard?.writeText(data.joinCode)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? 'Nusxa olindi' : 'Nusxa olish'}
              </Button>
            </div>
            <p className="text-sm text-ink-muted">
              O'quvchi ilovada Sozlamalar → “Markazim” bo'limiga shu kodni yozadi. So'rov “Kutilmoqda” holatida keladi —
              siz tasdiqlaganingizdan keyin faol bo'ladi. Kodni almashtirish kerak bo'lsa, Russian.gg jamoasiga yozing.
            </p>
          </Card>
          <Card as="div" className="space-y-3">
            <SectionHeading>To'lov sharti</SectionHeading>
            <p className="text-sm text-ink">
              <b>{data.maxStudents}</b> o'quvchi × {formatSom(data.pricePerSeatTiyin)} ={' '}
              <b>{formatSom(data.maxStudents * data.pricePerSeatTiyin)}</b> / oy
            </p>
            <p className="text-sm text-ink-muted">
              Markaz oldindan, bir oyga to'laydi. O'quvchilarda Pro to'langan muddat ichida ochiq
              {data.paidThrough ? ` — hozir ${formatDate(data.paidThrough)} gacha` : ''}. Limitdan ko'p o'quvchini faollashtirib
              bo'lmaydi; limitni oshirish uchun Russian.gg jamoasiga yozing.
            </p>
          </Card>
        </div>
      )}
      {!data && !error && <EmptyNote>Yuklanmoqda…</EmptyNote>}
    </Screen>
  )
}
