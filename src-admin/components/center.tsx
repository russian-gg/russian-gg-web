import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Overlay } from '../../src/components/motion'
import { useFocusTrap } from '../../src/lib/focus-trap'
import { cx } from '../../src/lib/cx'
import { adminFetch, formatDate, useAdminQuery } from '../lib/api'
import { lastActiveLabel } from '../lib/center-format'
import {
  seatStatusLabel,
  type CenterGroup,
  type CenterStudent,
  type CenterStudentProfile,
  type SeatStatus,
} from '../lib/center-types'
import { Badge, Button, Card, Cell, EmptyNote, ErrorNote, Loading, Row, SectionHeading, Select, Table } from './ui'

export function SeatBadge({ status }: { status: SeatStatus }) {
  const tone = status === 'active' ? 'milestone' : status === 'requested' ? 'signal' : 'caution'
  return <Badge tone={tone}>{seatStatusLabel[status]}</Badge>
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
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
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
        className={cx('max-h-[90vh] w-full overflow-y-auto', wide ? 'max-w-2xl' : 'max-w-lg')}
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
 * `onOpen` is given.
 */
export function StudentsTable({
  students,
  onOpen,
  showPaid,
  showGroup = true,
}: {
  students: CenterStudent[]
  onOpen?: (student: CenterStudent) => void
  showPaid: boolean
  /** Off for centers while groups are hidden. */
  showGroup?: boolean
}) {
  if (students.length === 0) return <EmptyNote>Bu yerda hali o'quvchi yo'q.</EmptyNote>

  const head = ['Ism', ...(showGroup ? ['Guruh'] : []), 'Holat', 'Daraja', 'Kurs kuni', 'Oxirgi faollik', 'Bu hafta, daq.']
  if (showPaid) head.push("To'lov")

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
          {showPaid && (
            <Cell>
              {student.paid ? <Badge tone="milestone">To'langan</Badge> : <Badge tone="caution">To'lanmagan</Badge>}
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
              {student.paid === true && <Badge tone="milestone">To'langan</Badge>}
              {student.paid === false && <Badge tone="caution">To'lanmagan</Badge>}
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
                    Ro'yxatdan olish
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
                  O'chirilgan o'quvchi Pro'dan foydalana olmaydi va hisobga kirmaydi; uning natijalari saqlanadi.
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
