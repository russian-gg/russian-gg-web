import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CalendarCheck,
  Check,
  Copy,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Info,
  KeyRound,
  Plus,
  Send,
  TrendingUp,
  TriangleAlert,
  Upload,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cx } from '../../src/lib/cx'
import { adminApiPath, adminFetch, daysUntil, formatDayLong, session, useAdminQuery } from '../lib/api'
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
  Segmented,
  Table,
  Textarea,
  TextField,
} from '../components/ui'
import { AccessBadge, Field, FormDialog, InvoiceBadge, PayButtons, StudentDrawer, StudentsTable } from '../components/center'
import { CardTitle, IconDot, IconStat, UsageBar } from '../components/center-ui'
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

/** How the students screen opens: plain, straight into the add form, or into the Excel picker. */
export type StartAdding = 'form' | 'excel'

/** Opens the students screen: on a filter, or straight into adding. */
export type OpenStudents = (filter: StudentFilter, start?: StartAdding) => void

export function CenterOverviewScreen({ onOpenStudents }: { onOpenStudents: OpenStudents }) {
  const { data, error, isLoading, refresh } = useAdminQuery<CenterOverview>(`${BASE}/overview`)

  return (
    <Screen className="space-y-6">
      {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
      {isLoading && !data && <LoadingStats count={4} />}

      {data && (
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-signal-soft text-signal-ink"
              >
                <GraduationCap className="size-7" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-ink">{data.name}</h1>
                  <AccessBadge access={data.access} />
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">Bu hafta o'quvchilaringiz qanday mashq qilmoqda</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => onOpenStudents('all', 'excel')}>
                <span className="flex items-center gap-1.5">
                  <Upload aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  Excel'dan yuklash
                </span>
              </Button>
              <Button onClick={() => onOpenStudents('all', 'form')}>
                <span className="flex items-center gap-1.5">
                  <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
                  O'quvchi qo'shish
                </span>
              </Button>
            </div>
          </header>

          <AccessBanner overview={data} />

          {data.requested > 0 && (
            <button
              type="button"
              onClick={() => onOpenStudents('requested')}
              className="flex items-center gap-3 rounded-[var(--radius-card)] border-2 border-signal bg-signal-soft px-4 py-3 text-left"
            >
              <IconDot Icon={UserPlus} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-ink">
                  {data.requested} ta o'quvchi markaz kodi bilan qo'shilishni so'radi
                </span>
                <span className="block text-xs text-ink-muted">Tasdiqlaganingizdan keyin ularda Pro ochiladi</span>
              </span>
              <span className="text-sm font-bold text-signal-ink">Ko'rish →</span>
            </button>
          )}

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <IconStat
                  Icon={Users}
                  tone="signal"
                  label="Faol o'quvchilar"
                  value={
                    <>
                      {data.activeStudents} <span className="text-ink-faint">/ {data.maxStudents}</span>
                    </>
                  }
                  note={
                    <>
                      <span className="mb-2 block">
                        <UsageBar used={data.activeStudents} max={data.maxStudents} />
                      </span>
                      {data.notSignedIn > 0
                        ? `${data.notSignedIn} tasi ilovaga hali kirmagan`
                        : `${Math.max(0, data.maxStudents - data.activeStudents)} ta joy bo'sh`}
                    </>
                  }
                  onClick={() => onOpenStudents('active')}
                />
                <ProDaysStat overview={data} />
                <IconStat
                  Icon={TrendingUp}
                  tone="purple"
                  label="Bu hafta mashq qilgan"
                  value={`${data.weeklyActivePercent}%`}
                  note="faol o'quvchilardan"
                />
                <IconStat
                  Icon={TriangleAlert}
                  tone={data.atRisk > 0 ? 'danger' : 'caution'}
                  label="Xavf ostida"
                  value={<span className={data.atRisk > 0 ? 'text-danger' : undefined}>{data.atRisk}</span>}
                  note="7+ kun kirmagan yoki ortda qolgan"
                  onClick={data.atRisk > 0 ? () => onOpenStudents('risk') : undefined}
                />
              </div>

              <PaymentCard overview={data} />

              {data.activeStudents + data.requested + data.deactivated === 0 && (
                <GetStartedCard joinCode={data.joinCode} onAdd={() => onOpenStudents('all', 'form')} />
              )}
            </div>

            <aside className="space-y-6">
              <JoinCodeCard joinCode={data.joinCode} centerName={data.name} />
              <ContractCard overview={data} />
            </aside>
          </div>
        </div>
      )}
    </Screen>
  )
}

/** Days of Pro left, the way the team's page says it: what is ahead, not counting today. */
function ProDaysStat({ overview }: { overview: CenterOverview }) {
  if (overview.access === 'open' && overview.paidThrough) {
    const left = Math.max(0, daysUntil(overview.paidThrough))
    return (
      <IconStat
        Icon={CalendarCheck}
        tone={left <= 7 ? 'caution' : 'milestone'}
        label="Pro ochiq"
        value={<span className={left <= 7 ? 'text-caution' : undefined}>{left} kun</span>}
        note={`${formatDayLong(overview.paidThrough)}gacha to'langan`}
      />
    )
  }

  return (
    <IconStat
      Icon={CalendarCheck}
      tone="caution"
      label="Pro"
      value={<span className="text-caution">{overview.access === 'not_started' ? 'Hali emas' : 'Yopiq'}</span>}
      note={overview.access === 'not_started' ? `${formatDayLong(overview.contractStartsOn)}dan ochiladi` : "to'lovdan keyin ochiladi"}
    />
  )
}

/** Says plainly, at the top, when the students have no Pro and what fixes it. */
function AccessBanner({ overview }: { overview: CenterOverview }) {
  const message = {
    open: null,
    suspended: "Markaz o'chirilgan: o'quvchilar bepul rejada. Russian.gg jamoasi bilan bog'laning.",
    archived: "Markaz arxivda: o'quvchilar bepul rejada. Russian.gg jamoasi bilan bog'laning.",
    not_started: `Shartnoma ${formatDayLong(overview.contractStartsOn)}dan boshlanadi — o'quvchilarda Pro shu kuni ochiladi.`,
    unpaid: "To'lov qilinmagan: o'quvchilar hozir bepul rejada. Pastdagi tugma orqali to'lang — Pro darhol ochiladi.",
  }[overview.access]

  if (!message) return null
  const info = overview.access === 'not_started'
  return (
    <div
      role="status"
      className={cx(
        'flex items-center gap-3 rounded-[var(--radius-card)] border-2 px-4 py-3 text-sm font-bold',
        info ? 'border-signal bg-signal-soft text-signal-ink' : 'border-caution bg-caution-soft text-caution',
      )}
    >
      {info ? (
        <Info aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
      ) : (
        <TriangleAlert aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
      )}
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

  return (
    <Card as="section" aria-labelledby="pay-title" className={cx('space-y-4', open && 'border-signal')}>
      <CardTitle
        id="pay-title"
        Icon={CreditCard}
        title={open ? "To'lov kutilmoqda" : "To'lov"}
        action={open && <InvoiceBadge status={open.status} />}
      />
      {open ? (
        <div className="space-y-4 sm:pl-12">
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
      ) : (
        <div className="sm:pl-12">
          {overview.paidThrough ? (
            <>
              <p className="text-base font-bold text-ink">
                {formatDayLong(overview.paidThrough)}gacha to'langan <span className="text-ink-faint">·</span> oyiga{' '}
                {formatSom(overview.maxStudents * overview.pricePerSeatTiyin)}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                Keyingi oy uchun hisob-faktura muddat tugashidan 7 kun oldin shu yerda paydo bo'ladi.
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Hozircha to'lanadigan hisob-faktura yo'q. Russian.gg jamoasi bilan bog'laning.</p>
          )}
        </div>
      )}
    </Card>
  )
}

/** For a center with no students yet: the three ways in, side by side. */
function GetStartedCard({ joinCode, onAdd }: { joinCode: string; onAdd: () => void }) {
  return (
    <Card as="section" aria-labelledby="start-title" className="space-y-4">
      <CardTitle
        id="start-title"
        Icon={Users}
        title="Birinchi o'quvchilaringizni qo'shing"
        subtitle="O'quvchi shu raqam bilan ilovaga kirishi bilan Pro avtomatik ochiladi"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <WayIn Icon={UserPlus} title="Qo'lda kiriting" text="Ism, telefon va xohlasangiz email" action={<Button size="sm" onClick={onAdd}>Qo'shish</Button>} />
        <WayIn
          Icon={FileSpreadsheet}
          title="Excel'dan yuklang"
          text="Shablonni to'ldiring va faylni tanlang"
          action={
            <Button variant="secondary" size="sm" onClick={() => void downloadStudentsTemplate()}>
              Shablon
            </Button>
          }
        />
        <WayIn
          Icon={KeyRound}
          title="Kodni ulashing"
          text="O'quvchi ilovada kodni yozadi, siz tasdiqlaysiz"
          action={
            <button
              type="button"
              onClick={() => void copyText(joinCode, 'Kod nusxalandi')}
              className="rounded-[var(--radius-control)] bg-ground-sunken px-3 py-1.5 font-mono text-sm font-extrabold tracking-[0.15em] text-ink hover:bg-hairline"
            >
              {joinCode}
            </button>
          }
        />
      </div>
    </Card>
  )
}

function WayIn({ Icon, title, text, action }: { Icon: LucideIcon; title: string; text: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-hairline p-4">
      <IconDot Icon={Icon} size="sm" />
      <div>
        <div className="text-sm font-extrabold text-ink">{title}</div>
        <div className="text-xs text-ink-muted">{text}</div>
      </div>
      <div className="mt-auto">{action}</div>
    </div>
  )
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast(done)
  } catch {
    toast("Nusxalab bo'lmadi — matnni qo'lda belgilang")
  }
}

/** What a center sends its students: the app, the phone to sign in with, and the code as a fallback. */
function inviteText(centerName: string, joinCode: string) {
  return [
    `Assalomu alaykum! ${centerName} sizga Russian.gg — har kuni ruscha gapirish mashqini ochdi.`,
    "1. Russian.gg ilovasini o'rnating.",
    '2. Markazga bergan telefon raqamingiz bilan kiring — Pro o\'zi ochiladi.',
    `Raqamingiz boshqa bo'lsa: Sozlamalar → Markazim → ${joinCode}`,
  ].join('\n')
}

function JoinCodeCard({ joinCode, centerName, detailed = false }: { joinCode: string; centerName: string; detailed?: boolean }) {
  return (
    <Card as="section" aria-labelledby="code-title" className="space-y-4">
      <CardTitle id="code-title" Icon={KeyRound} title="Markaz kodi" />
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-ground-sunken px-4 py-3">
        <span className="font-mono text-3xl font-extrabold tracking-[0.2em] text-ink">{joinCode}</span>
        <Button variant="secondary" size="sm" onClick={() => void copyText(joinCode, 'Kod nusxalandi')}>
          <span className="flex items-center gap-1.5">
            <Copy aria-hidden="true" className="size-4" strokeWidth={1.8} />
            Nusxa
          </span>
        </Button>
      </div>
      {detailed ? (
        <ol className="space-y-3">
          {[
            ['Ilovani o\'rnatadi', "O'quvchi Russian.gg ilovasini telefoniga o'rnatadi"],
            ['Kodni yozadi', "Sozlamalar → “Markazim” bo'limiga shu kodni kiritadi"],
            ['Siz tasdiqlaysiz', "So'rov “Kutilmoqda”da paydo bo'ladi — tasdiqlasangiz Pro ochiladi"],
          ].map(([title, text], index) => (
            <li key={title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-signal-soft text-xs font-extrabold text-signal-ink"
              >
                {index + 1}
              </span>
              <span className="text-sm">
                <b className="block text-ink">{title}</b>
                <span className="text-ink-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-muted">Raqami ro'yxatda bo'lmagan o'quvchi ilovada shu kodni yozadi — siz tasdiqlaysiz.</p>
      )}
      <Button variant="ghost" size="sm" onClick={() => void copyText(inviteText(centerName, joinCode), 'Taklif matni nusxalandi')}>
        <span className="flex items-center gap-1.5">
          <Send aria-hidden="true" className="size-4" strokeWidth={1.8} />
          O'quvchilarga taklif matnini nusxalash
        </span>
      </Button>
    </Card>
  )
}

function ContractCard({ overview }: { overview: CenterOverview }) {
  const rows: Array<[string, ReactNode]> = [
    ["O'quvchilar limiti", `${overview.maxStudents} ta`],
    ['Narx', `${formatSom(overview.pricePerSeatTiyin)} / o'quvchi`],
    ["Oylik to'lov", formatSom(overview.maxStudents * overview.pricePerSeatTiyin)],
    ['Pro muddati', overview.paidThrough ? `${formatDayLong(overview.paidThrough)}gacha` : "to'lanmagan"],
  ]
  return (
    <Card as="section" aria-labelledby="deal-title" className="space-y-4">
      <CardTitle id="deal-title" Icon={FileText} title="Shartnoma" />
      <dl className="divide-y divide-hairline text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="text-right font-bold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="rounded-[var(--radius-control)] bg-ground-sunken px-3 py-2 text-xs text-ink-muted">
        Oldindan, 30 kunga to'lanadi. Limitni oshirish yoki shartlarni o'zgartirish uchun Russian.gg jamoasiga yozing.
      </p>
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

export function CenterStudentsScreen({
  initialFilter = 'all',
  start,
}: {
  initialFilter?: StudentFilter
  /** Open the add form, or the Excel picker, as soon as the screen is up. */
  start?: StartAdding
}) {
  const students = useAdminQuery<CenterStudent[]>(`${BASE}/students`)
  const overview = useAdminQuery<CenterOverview>(`${BASE}/overview`)
  const [filter, setFilter] = useState<StudentFilter>(initialFilter)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  /* The add dialog, empty or filled from an Excel file. */
  const [adding, setAdding] = useState<DraftStudent[] | null>(() => (start === 'form' ? [] : null))
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [answering, setAnswering] = useState<string | null>(null)
  const [failure, setFailure] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  // "Excel'dan yuklash" on the overview: the click that brought us here still counts as the
  // user's gesture, so the browser lets the file picker open.
  useEffect(() => {
    if (start === 'excel') fileInput.current?.click()
  }, [start])

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
        !(student.email ?? '').toLowerCase().includes(query) &&
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
      setAdding(rows.map((row) => draftFrom(row.name, row.phone, row.email)))
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

  const excelButton = (
    <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={importing}>
      <span className="flex items-center gap-1.5">
        <Upload aria-hidden="true" className="size-4" strokeWidth={1.8} />
        {importing ? "O'qilmoqda…" : "Excel'dan yuklash"}
      </span>
    </Button>
  )

  return (
    <Screen className="space-y-6">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">O'quvchilar</h1>
            {overview.data ? (
              <div className="mt-2 flex items-center gap-3">
                <div className="w-40">
                  <UsageBar used={overview.data.activeStudents} max={overview.data.maxStudents} />
                </div>
                <span className="text-sm text-ink-muted">
                  <b className="text-ink">
                    {overview.data.activeStudents} / {overview.data.maxStudents}
                  </b>{' '}
                  faol · {free} ta joy bo'sh
                </span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">Kim mashq qilyapti, kim ortda qolmoqda</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {all.length > 0 && (
              <Button variant="ghost" onClick={exportCsv} disabled={exporting}>
                <span className="flex items-center gap-1.5">
                  <Download aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  {exporting ? 'Yuklanmoqda…' : 'CSV'}
                </span>
              </Button>
            )}
            {excelButton}
            <Button onClick={() => setAdding([])}>
              <span className="flex items-center gap-1.5">
                <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
                O'quvchi qo'shish
              </span>
            </Button>
          </div>
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
        </header>

        {failure && <ErrorNote>{failure}</ErrorNote>}
        {students.error && <ErrorNote onRetry={refresh}>{students.error}</ErrorNote>}
        {students.isLoading && !students.data && <LoadingRows />}

        {students.data && all.length === 0 && (
          <Card as="section" aria-labelledby="empty-title" className="space-y-5">
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <IconDot Icon={Users} />
              <h2 id="empty-title" className="text-lg font-extrabold text-ink">
                Hali o'quvchi yo'q
              </h2>
              <p className="max-w-xl text-sm text-ink-muted">
                O'quvchi siz kiritgan telefon raqam (yoki Google'dagi email) bilan ilovaga kirishi bilan Pro avtomatik
                ochiladi. Uch usuldan birini tanlang:
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <WayIn
                Icon={UserPlus}
                title="Qo'lda kiriting"
                text="Ism, telefon va xohlasangiz email — bittadan yoki bir nechtasini"
                action={<Button size="sm" onClick={() => setAdding([])}>Formani ochish</Button>}
              />
              <WayIn
                Icon={FileSpreadsheet}
                title="Excel'dan yuklang"
                text="Shablonni to'ldiring, so'ng faylni tanlang — har bir qator tekshiriladi"
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                      Fayl tanlash
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void downloadStudentsTemplate()}>
                      Shablon
                    </Button>
                  </div>
                }
              />
              <WayIn
                Icon={KeyRound}
                title="Kodni ulashing"
                text="Raqami yo'q o'quvchi ilovada kodni yozadi, siz tasdiqlaysiz"
                action={
                  overview.data && (
                    <button
                      type="button"
                      onClick={() => void copyText(overview.data!.joinCode, 'Kod nusxalandi')}
                      className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-ground-sunken px-3 py-1.5 font-mono text-sm font-extrabold tracking-[0.15em] text-ink hover:bg-hairline"
                    >
                      {overview.data.joinCode}
                      <Copy aria-hidden="true" className="size-3.5" strokeWidth={2} />
                    </button>
                  )
                }
              />
            </div>
          </Card>
        )}

        {all.length > 0 && (
          <Card as="div" className="flex flex-wrap items-center justify-between gap-3 !py-3">
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
            <TextField value={search} onChange={setSearch} placeholder="Ism, telefon yoki email" className="w-full sm:w-72" />
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
      </div>

      {adding && <AddStudentsDialog initialRows={adding} free={free} onClose={() => setAdding(null)} onAdded={refresh} />}

      {open && <StudentDrawer seatId={open} groups={[]} basePath={BASE} onClose={() => setOpen(null)} onChanged={refresh} />}
    </Screen>
  )
}

export type DraftStudent = { key: number; name: string; phone: string; email: string }

const localDigits = uzLocalDigits
const formatLocal = maskUzLocal

/** Empty, or a valid-looking address. The server checks again; this only marks the field. */
const emailOk = (value: string) => !value.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())

/**
 * "Ali Valiyev, 90 123 45 67, ali@gmail.com" per line, any order — a list copied out of Excel or
 * Telegram. The token with an @ is the e-mail, the one with nine digits the phone, the rest the name.
 */
function parseLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const email = line.match(/[^\s,;]+@[^\s,;]+/)?.[0] ?? ''
      const rest = email ? line.replace(email, ' ') : line
      const phone = rest.match(/[+\d][\d\s()-]{6,}\d/)?.[0] ?? ''
      const name = (phone ? rest.replace(phone, ' ') : rest).replace(/[,;\t]+/g, ' ').replace(/\s+/g, ' ').trim()
      return { name, phone: phone.trim(), email }
    })
}

let draftKey = 1
const emptyDraft = (): DraftStudent => ({ key: draftKey++, name: '', phone: '', email: '' })

/** A form row from a name, a phone as typed and an optional e-mail. */
function draftFrom(name: string, phone: string, email: string): DraftStudent {
  const local = localDigits(phone)
  return { key: draftKey++, name, phone: local ? formatLocal(local) : phone, email: email.trim() }
}

export function AddStudentsDialog({
  initialRows,
  free,
  onClose,
  onAdded,
  basePath = BASE,
}: {
  /** Where the students go: the center's own portal, or the team's page for one center. */
  basePath?: string
  /** Rows read from an Excel file, to check and send; empty for a blank form. */
  initialRows: DraftStudent[]
  /** Places left under the center's limit, when known. */
  free: number | null
  onClose: () => void
  onAdded: () => void
}) {
  const [rows, setRows] = useState<DraftStudent[]>(() =>
    initialRows.length > 0 ? initialRows.map((row) => ({ ...row, email: row.email ?? '' })) : [emptyDraft()],
  )
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [result, setResult] = useState<AddStudentsResult | null>(null)

  const filled = rows.filter((row) => row.phone.trim() || row.name.trim() || row.email.trim())
  const valid = filled.filter((row) => localDigits(row.phone) && emailOk(row.email))
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
    const parsed = parseLines(pasted).map((item) => draftFrom(item.name, item.phone, item.email))
    if (parsed.length === 0) return
    setRows((current) => [...current.filter((row) => row.phone.trim() || row.name.trim() || row.email.trim()), ...parsed])
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
      const next = await adminFetch<AddStudentsResult>(`${basePath}/students`, {
        method: 'POST',
        body: JSON.stringify({
          groupId: null,
          students: valid.map((row) => ({
            phone: `+998${localDigits(row.phone)}`,
            name: row.name.trim() || null,
            email: row.email.trim() || null,
          })),
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
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-milestone text-ground-raised">
              <Check className="size-5" strokeWidth={2.5} />
            </span>
            <p className="text-ink">
              <b>{result.added}</b> ta o'quvchi qo'shildi. Ular ilovaga shu raqam bilan kirishi bilan Pro ochiladi.
            </p>
          </div>
          {result.overLimit.length > 0 && (
            <p className="rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 font-bold text-caution">
              Limit to'ldi ({result.maxStudents} ta): {result.overLimit.length} ta raqam qo'shilmadi. Ko'proq o'quvchi uchun
              Russian.gg jamoasiga murojaat qiling.
            </p>
          )}
          {result.alreadyHere.length > 0 && <p className="text-ink-muted">Allaqachon ro'yxatda: {result.alreadyHere.join(', ')}</p>}
          {result.inOtherCenter.length > 0 && (
            <p className="text-caution">
              Boshqa markazda: {result.inOtherCenter.join(', ')} — o'quvchi avval u markazdan chiqishi kerak.
            </p>
          )}
          {result.invalid.length > 0 && <p className="text-danger">Noto'g'ri: {result.invalid.join(', ')}</p>}
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

  const grid = 'grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)_44px]'

  return (
    <FormDialog title="O'quvchi qo'shish" onClose={onClose} size="xl">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-ink-muted">
          O'quvchi shu raqam bilan ilovaga kirishi bilan Pro avtomatik ochiladi. Email ixtiyoriy — o'quvchi Google orqali kirsa,
          u ham ishlaydi.
          {free !== null && (
            <>
              {' '}
              Limitda <b className="text-ink">{free}</b> ta bo'sh joy bor.
            </>
          )}
        </p>
        {free !== null && valid.length > free && (
          <p role="status" className="rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 text-sm font-bold text-caution">
            {valid.length} ta o'quvchi kiritildi, lekin faqat {free} tasi qo'shiladi. Limitni oshirish uchun Russian.gg jamoasiga
            yozing.
          </p>
        )}

        <div className="space-y-3">
          <div className={cx(grid, 'hidden text-sm font-bold text-ink sm:grid')}>
            <span>Ism va familiya</span>
            <span>Telefon raqam</span>
            <span>
              Email <span className="font-normal text-ink-faint">(ixtiyoriy)</span>
            </span>
            <span />
          </div>
          {rows.map((row, index) => {
            const used = Boolean(row.phone.trim() || row.name.trim() || row.email.trim())
            const phoneError = touched && used && !localDigits(row.phone)
            const emailError = touched && !emailOk(row.email)
            return (
              <div key={row.key} className={cx(grid, 'rounded-[var(--radius-card)] border-2 border-hairline p-3 sm:border-0 sm:p-0')}>
                <label>
                  <span className="mb-1 block text-xs font-bold text-ink-muted sm:sr-only">Ism va familiya, {index + 1}-o'quvchi</span>
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
                  <span className="mb-1 block text-xs font-bold text-ink-muted sm:sr-only">Telefon raqam, {index + 1}-o'quvchi</span>
                  <span
                    className={cx(
                      'flex h-11 items-center rounded-[var(--radius-control)] border-2 bg-ground-raised focus-within:border-signal',
                      phoneError ? 'border-danger' : 'border-hairline',
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
                      inputMode="tel"
                      placeholder="90 123 45 67"
                      autoComplete="off"
                      aria-invalid={phoneError}
                      className="h-full min-w-0 flex-1 rounded-r-[var(--radius-control)] bg-transparent pr-4 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                  </span>
                  {phoneError && <span className="mt-1 block text-xs text-danger">9 ta raqam, masalan 90 123 45 67</span>}
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-bold text-ink-muted sm:sr-only">Email (ixtiyoriy), {index + 1}-o'quvchi</span>
                  <input
                    type="email"
                    value={row.email}
                    onChange={(event) => update(row.key, { email: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && index === rows.length - 1 && localDigits(row.phone)) {
                        event.preventDefault()
                        addRow()
                      }
                    }}
                    placeholder="ali@gmail.com"
                    autoComplete="off"
                    aria-invalid={emailError}
                    className={cx(fieldClass, emailError && 'border-danger')}
                  />
                  {emailError && <span className="mt-1 block text-xs text-danger">Email noto'g'ri</span>}
                </label>
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  aria-label={`${index + 1}-qatorni o'chirish`}
                  className="flex size-11 items-center justify-center self-start rounded-[var(--radius-control)] text-ink-faint hover:bg-ground-sunken hover:text-danger sm:self-auto"
                >
                  <X aria-hidden="true" className="size-4" strokeWidth={2} />
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={addRow}>
            <span className="flex items-center gap-1.5">
              <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
              Yana o'quvchi
            </span>
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
            <Field label="Excel yoki Telegram'dan ro'yxat" hint="Har qatorga bitta o'quvchi: ism, raqam va email — istalgan tartibda.">
              <Textarea
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                rows={5}
                placeholder={'Ali Valiyev, 90 123 45 67, ali@gmail.com\nDilnoza Karimova  93 765 43 21'}
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
            <p className="mr-auto text-xs font-bold text-danger">{invalidCount} ta qatorda xato bor — tuzating yoki o'chiring</p>
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

  return (
    <Screen className="space-y-6">
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Sozlamalar</h1>
          <p className="mt-1 text-sm text-ink-muted">Markaz kodi, o'quvchilarni taklif qilish va to'lov sharti</p>
        </header>
        {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
        {!data && !error && <LoadingRows />}
        {data && (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <JoinCodeCard joinCode={data.joinCode} centerName={data.name} detailed />
            <div className="space-y-6">
              <ContractCard overview={data} />
              <Card as="section" aria-labelledby="invite-title" className="space-y-3">
                <CardTitle id="invite-title" Icon={Send} title="Taklif matni" subtitle="O'quvchilarga Telegram'da yuboring" />
                <pre className="rounded-[var(--radius-control)] bg-ground-sunken p-3 font-sans text-sm whitespace-pre-wrap text-ink">
                  {inviteText(data.name, data.joinCode)}
                </pre>
                <Button size="sm" onClick={() => void copyText(inviteText(data.name, data.joinCode), 'Taklif matni nusxalandi')}>
                  <span className="flex items-center gap-1.5">
                    <Copy aria-hidden="true" className="size-4" strokeWidth={1.8} />
                    Matnni nusxalash
                  </span>
                </Button>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Screen>
  )
}
