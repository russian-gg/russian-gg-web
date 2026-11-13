import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Overlay } from '../../src/components/motion'
import { useFocusTrap } from '../../src/lib/focus-trap'
import { cx } from '../../src/lib/cx'
import { adminApiPath, adminFetch, formatDate, useAdminQuery } from '../lib/api'
import { formatSom, lastActiveLabel, maskUzLocal, uzLocalDigits } from '../lib/center-format'
import clickMark from '../../src/assets/images/click_mark.webp'
import paymeMark from '../../src/assets/images/payme_mark.webp'
import {
  accessLabel,
  invoiceStatusLabel,
  seatStatusLabel,
  type CenterAccess,
  type CenterGroup,
  type CenterInvoiceStatus,
  type CenterStudent,
  type CenterStudentProfile,
  type SeatStatus,
} from '../lib/center-types'
import { Badge, Button, Card, Cell, EmptyNote, ErrorNote, Loading, Row, SectionHeading, Select, Table } from './ui'

export function SeatBadge({ status }: { status: SeatStatus }) {
  const tone = status === 'active' ? 'milestone' : status === 'requested' ? 'signal' : 'caution'
  return <Badge tone={tone}>{seatStatusLabel[status]}</Badge>
}

/** Whether the center's students have Pro today, and if not, why. */
export function AccessBadge({ access }: { access: CenterAccess }) {
  const tone = access === 'open' ? 'milestone' : access === 'not_started' ? 'signal' : access === 'archived' ? 'neutral' : 'danger'
  return <Badge tone={tone}>{accessLabel[access]}</Badge>
}

export function InvoiceBadge({ status }: { status: CenterInvoiceStatus }) {
  const tone = status === 'paid' ? 'milestone' : status === 'overdue' ? 'danger' : status === 'sent' ? 'signal' : 'neutral'
  return <Badge tone={tone}>{invoiceStatusLabel[status]}</Badge>
}

/**
 * An Uzbek mobile number: "+998" fixed in front, the nine digits typed after it and grouped as
 * they are read aloud. `value` is what the field shows ("90 123 45 67"); `toUzPhone` turns it
 * into what the server stores. The error shows once the field has been left half-filled.
 */
export function PhoneField({
  label,
  value,
  onChange,
  required = false,
  showError = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  /** Show the format error now (after a submit attempt) rather than waiting for blur. */
  showError?: boolean
}) {
  const [left, setLeft] = useState(false)
  const filled = value.replace(/\D/g, '').length > 0
  const invalid = (filled || required) && !uzLocalDigits(value)
  const shownError = invalid && (left || showError)

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">{label}</span>
      <span
        className={cx(
          'flex h-11 items-center rounded-[var(--radius-control)] border-2 bg-ground-raised focus-within:border-signal',
          shownError ? 'border-danger' : 'border-hairline',
        )}
      >
        <span className="pr-1 pl-4 text-sm font-bold text-ink-muted">+998</span>
        <input
          value={value}
          onChange={(event) => onChange(maskUzLocal(event.target.value))}
          onBlur={() => setLeft(true)}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="90 123 45 67"
          aria-invalid={shownError}
          pattern="\d{2} \d{3} \d{2} \d{2}"
          className="h-full min-w-0 flex-1 rounded-r-[var(--radius-control)] bg-transparent pr-4 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </span>
      {shownError && <span className="mt-1 block text-xs text-danger">9 ta raqam kiriting, masalan 90 123 45 67</span>}
    </label>
  )
}

/*
 * The providers' own marks, the same files the learner paywall shows. Imported across from
 * `src/` on purpose: they are artwork, not components bound to the learner app's router or
 * dictionary, and a second copy of a vendor logo is a second copy to keep in step.
 */
const providerMarks: Record<string, { name: string; src: string; height: string }> = {
  click: { name: 'Click', src: clickMark, height: 'h-9' },
  payme: { name: 'Payme', src: paymeMark, height: 'h-8' },
}

/**
 * How a center pays one invoice: pick Click or Payme, then one button that names the provider
 * and the sum. Two equal "pay with…" buttons made choosing the provider and committing to pay
 * the same press — the learner paywall split them for that reason, and this follows it.
 *
 * The provider's page opens in this tab and sends the payer back to `returnUrl`. Works without
 * a session: the pay link is paid by whoever was sent it.
 */
export function PayButtons({
  token,
  providers,
  returnUrl,
  amountTiyin,
}: {
  token: string
  providers: string[]
  returnUrl: string
  amountTiyin: number
}) {
  const known = providers.filter((provider) => provider in providerMarks)
  const [provider, setProvider] = useState(known[0] ?? 'click')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  async function pay() {
    setBusy(true)
    setFailure('')
    try {
      const response = await fetch(adminApiPath(`/api/public/center-pay/${encodeURIComponent(token)}/checkout`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, returnUrl }),
      })
      const payload = (await response.json().catch(() => ({}))) as { checkoutUrl?: string; message?: string }
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.message ?? "To'lovni ochib bo'lmadi.")
      // Left disabled on purpose: a second press before the redirect lands would open a second checkout.
      window.location.assign(payload.checkoutUrl)
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "To'lovni ochib bo'lmadi.")
      setBusy(false)
    }
  }

  const chosen = providerMarks[provider]

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="To'lov usuli" className="grid gap-3 sm:grid-cols-2">
        {known.map((value) => {
          const mark = providerMarks[value]
          const checked = provider === value
          return (
            <label
              key={value}
              className={cx(
                'flex cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border-2 px-4 py-3 transition-colors',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-signal',
                checked ? 'border-signal bg-signal-soft/60' : 'border-hairline bg-ground-raised hover:border-ink-faint',
              )}
            >
              <input
                type="radio"
                name={`pay-provider-${token}`}
                value={value}
                checked={checked}
                onChange={() => setProvider(value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cx(
                  'grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
                  checked ? 'border-signal bg-signal' : 'border-hairline bg-ground',
                )}
              >
                {checked && <span className="size-1.5 rounded-full bg-on-signal" />}
              </span>
              <img src={mark.src} alt="" aria-hidden="true" className={cx('w-auto shrink-0 object-contain', mark.height)} />
              <span className="text-base font-extrabold text-ink">{mark.name}</span>
            </label>
          )
        })}
      </div>

      <Button block disabled={busy || !chosen} onClick={pay} className="h-auto min-h-12 py-3 whitespace-normal">
        {busy ? 'Ochilmoqda…' : `${chosen?.name ?? ''} orqali to'lash · ${formatSom(amountTiyin)}`}
      </Button>

      {failure && <ErrorNote>{failure}</ErrorNote>}
    </div>
  )
}

/**
 * A dialog with a form in it. The confirm dialog in `ui.tsx` is for yes/no questions; this one
 * holds fields, so its buttons belong to the caller.
 */
export function FormDialog({
  title,
  onClose,
  children,
  wide = false,
  size,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** "xl" for a form with three fields per row. */
  size?: 'xl'
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <Overlay open onDismiss={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('max-h-[90vh] w-full overflow-y-auto', size === 'xl' ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-lg')}
      >
        <Card as="div" className="w-full" onClick={(event) => event.stopPropagation()}>
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          <div className="mt-4">{children}</div>
        </Card>
      </div>
    </Overlay>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

/**
 * The student list, as both the center admin and the team see it. Read-only unless
 * `onOpen` is given. With `onApprove`/`onReject`, a join request is answered in its own row —
 * opening each student to find the button was the slow part of a morning's requests.
 */
export function StudentsTable({
  students,
  onOpen,
  showGroup = true,
  onApprove,
  onReject,
  busySeat = null,
}: {
  students: CenterStudent[]
  onOpen?: (student: CenterStudent) => void
  /** Off for centers while groups are hidden. */
  showGroup?: boolean
  onApprove?: (student: CenterStudent) => void
  onReject?: (student: CenterStudent) => void
  /** The seat whose approve/reject is in flight, so its buttons wait. */
  busySeat?: string | null
}) {
  if (students.length === 0) return <EmptyNote>Bu yerda hali o'quvchi yo'q.</EmptyNote>

  const answers = Boolean(onApprove || onReject)
  const head = ['Ism', ...(showGroup ? ['Guruh'] : []), 'Holat', 'Daraja', 'Kurs kuni', 'Oxirgi faollik', 'Bu hafta, daq.']
  if (answers) head.push("So'rov")

  return (
    <Table head={head}>
      {students.map((student) => (
        <Row key={student.seatId} onClick={onOpen ? () => onOpen(student) : undefined} label={student.name}>
          <Cell strong>
            <div className="flex flex-col">
              <span className="flex items-center gap-2">
                {student.name}
                {student.atRisk && <Badge tone="danger">Xavf</Badge>}
              </span>
              <span className="text-xs font-normal text-ink-muted">
                {student.phone}
                {student.email && ` · ${student.email}`}
                {!student.signedIn && ' · hali kirmagan'}
              </span>
            </div>
          </Cell>
          {showGroup && <Cell muted>{student.groupName ?? '—'}</Cell>}
          <Cell>
            <SeatBadge status={student.status} />
          </Cell>
          <Cell>{student.level ?? '—'}</Cell>
          <Cell>{student.courseDay ? `${student.courseDay} / 90` : '—'}</Cell>
          <Cell muted>{lastActiveLabel(student.lastActiveDate)}</Cell>
          <Cell>
            {student.activeMinutes7d}
            {student.speakingMinutes7d > 0 && (
              <span className="text-ink-muted"> · gapirish {student.speakingMinutes7d}</span>
            )}
          </Cell>
          {answers && (
            <Cell>
              {student.status === 'requested' ? (
                // The row opens the drawer; these answer the request without opening it.
                <span className="flex gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  {onApprove && (
                    <Button size="sm" disabled={busySeat === student.seatId} onClick={() => onApprove(student)}>
                      Tasdiqlash
                    </Button>
                  )}
                  {onReject && (
                    <Button variant="ghost" size="sm" disabled={busySeat === student.seatId} onClick={() => onReject(student)}>
                      Rad etish
                    </Button>
                  )}
                </span>
              ) : (
                <span className="text-ink-faint">—</span>
              )}
            </Cell>
          )}
        </Row>
      ))}
    </Table>
  )
}

const skillLabel: Record<string, string> = {
  Listening: 'Tinglash',
  Speaking: 'Gapirish',
  Pronunciation: 'Talaffuz',
  Vocabulary: "Lug'at",
  Grammar: 'Grammatika',
}

const historyLabel: Record<string, string> = {
  'center.seat.added': "Qo'shildi",
  'center.seat.activated': 'Faollashtirildi',
  'center.seat.deactivated': "O'chirildi",
  'center.seat.removed': "Ro'yxatdan olindi",
  'center.seat.moved': "Guruhi o'zgardi",
  'center.seat.requested': "Kod bilan so'rov yubordi",
}

/**
 * One student, from the center admin's list: their progress and the four things the center can
 * do to their seat. `readOnly` for the team, who look but do not change a center's students.
 */
export function StudentDrawer({
  seatId,
  groups,
  basePath,
  readOnly = false,
  onClose,
  onChanged,
}: {
  seatId: string
  groups: CenterGroup[]
  basePath: string
  readOnly?: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const dialogRef = useFocusTrap<HTMLElement>()
  const { data, error, refresh } = useAdminQuery<CenterStudentProfile>(`${basePath}/students/${seatId}`)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const close = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  async function act(action: string, groupId?: string | null) {
    setBusy(true)
    setFailure('')
    try {
      await adminFetch(`${basePath}/students/${seatId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, groupId: groupId ?? null }),
      })
      if (action === 'remove') {
        onChanged()
        onClose()
        return
      }

      refresh()
      onChanged()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "O'zgartirib bo'lmadi.")
    } finally {
      setBusy(false)
      setConfirmRemove(false)
    }
  }

  const student = data?.student

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={close}>
      <aside
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={student?.name ?? "O'quvchi"}
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-xl overflow-y-auto bg-ground-raised p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-ink">{student?.name ?? '…'}</h2>
            {student && (
              <p className="mt-1 text-sm text-ink-muted">
                {student.phone}
                {student.email && ` · ${student.email}`}
                {groups.length > 0 && ` · ${student.groupName ?? 'guruhsiz'}`}
              </p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={close}>
            Yopish
          </Button>
        </div>

        {error && <ErrorNote onRetry={refresh}>{error}</ErrorNote>}
        {!data && !error && <Loading />}

        {data && student && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <SeatBadge status={student.status} />
              {student.atRisk && <Badge tone="danger">Xavf ostida</Badge>}
              {!student.signedIn && <Badge>Ilovaga hali kirmagan</Badge>}
            </div>

            {!readOnly && (
              <Card as="div" className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {student.status !== 'active' ? (
                    <Button size="sm" disabled={busy} onClick={() => act('activate')}>
                      {student.status === 'requested' ? 'Tasdiqlash' : 'Faollashtirish'}
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => act('deactivate')}>
                      O'chirish (pauza)
                    </Button>
                  )}
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => setConfirmRemove(true)}>
                    {student.status === 'requested' ? 'Rad etish' : "Ro'yxatdan olish"}
                  </Button>
                </div>
                {groups.length > 0 && (
                <Select
                  label="Guruh"
                  block
                  value={student.groupId ?? ''}
                  disabled={busy}
                  onChange={(value) => act('move', value || null)}
                  options={[
                    { value: '', label: 'Guruhsiz' },
                    ...groups.filter((group) => !group.archived).map((group) => ({ value: group.id, label: group.name })),
                  ]}
                />
                )}
                <p className="text-xs text-ink-muted">
                  O'chirilgan o'quvchi Pro'dan foydalana olmaydi va limitdan joy egallamaydi; uning natijalari saqlanadi.
                </p>
                {failure && <ErrorNote>{failure}</ErrorNote>}
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini label="Kurs kuni" value={student.courseDay ? `${student.courseDay}/90` : '—'} />
              <Mini label="Darslar" value={String(student.missionsCompleted)} />
              <Mini label="Seriya" value={`${student.streak} kun`} />
              <Mini label="Bu hafta" value={`${student.activeMinutes7d} daq.`} />
            </div>

            <section>
              <SectionHeading>Daraja testi</SectionHeading>
              {data.placement ? (
                <p className="text-sm text-ink">
                  Tushunish: <b>{data.placement.comprehension ?? '—'}</b> · Gapirish:{' '}
                  <b>{data.placement.speaking ?? '—'}</b> · Tavsiya: {data.placement.recommendedStartDay}-kundan ·{' '}
                  <span className="text-ink-muted">{formatDate(data.placement.completedAt)}</span>
                </p>
              ) : (
                <p className="text-sm text-ink-muted">Hali topshirmagan.</p>
              )}
            </section>

            <section>
              <SectionHeading>Ko'nikmalar</SectionHeading>
              {data.skills.length === 0 ? (
                <p className="text-sm text-ink-muted">Hali baholanmagan.</p>
              ) : (
                <div className="space-y-2">
                  {data.skills.map((skill) => (
                    <div key={skill.skill} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm text-ink">{skillLabel[skill.skill] ?? skill.skill}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ground-sunken">
                        <div className="h-full rounded-full bg-signal" style={{ width: `${Math.min(100, skill.score)}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-sm font-bold text-ink">
                        {skill.score}
                        {skill.previous !== null && (
                          <span className={cx('ml-1 text-xs', skill.score >= skill.previous ? 'text-milestone' : 'text-danger')}>
                            {skill.score >= skill.previous ? '▲' : '▼'}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionHeading>Oxirgi darslar</SectionHeading>
              {data.recentMissions.length === 0 ? (
                <p className="text-sm text-ink-muted">Hali tugatilgan dars yo'q.</p>
              ) : (
                <ul className="divide-y divide-hairline text-sm">
                  {data.recentMissions.map((mission, index) => (
                    <li key={index} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-ink">
                        {mission.courseDay ? `${mission.courseDay}-kun · ` : ''}
                        {mission.title}
                      </span>
                      <span className="shrink-0 text-ink-muted">
                        {mission.score !== null ? `${mission.score} ball · ` : ''}
                        {formatDate(mission.completedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <SectionHeading>Tarix</SectionHeading>
              {data.history.length === 0 ? (
                <p className="text-sm text-ink-muted">—</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.history.map((event, index) => (
                    <li key={index} className="text-ink-muted">
                      <span className="text-ink">{historyLabel[event.action] ?? event.action}</span> ·{' '}
                      {formatDate(event.at)}
                      {event.summary ? ` · ${event.summary}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {confirmRemove && student && (
          <FormDialog title="Ro'yxatdan olinsinmi?" onClose={() => setConfirmRemove(false)}>
            <p className="text-sm text-ink-muted">
              {student.name} markaz ro'yxatidan olinadi va markaz to'laydigan Pro yopiladi. O'quvchining akkaunti va
              natijalari saqlanadi.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(false)} disabled={busy}>
                Bekor qilish
              </Button>
              <Button variant="danger" size="sm" onClick={() => act('remove')} disabled={busy}>
                Ro'yxatdan olish
              </Button>
            </div>
          </FormDialog>
        )}
      </aside>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border-2 border-hairline px-3 py-2">
      <div className="text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">{label}</div>
      <div className="mt-0.5 text-base font-extrabold text-ink">{value}</div>
    </div>
  )
}
