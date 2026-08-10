import { useCallback, useEffect, useState } from 'react'
import { adminFetch, formatDateTime, session, useAdminQuery } from '../lib/api'
import type { UserDetail } from '../lib/types'
import { Badge, Button, Card, EmptyNote, ErrorNote, Loading, SectionHeading } from './ui'
import { cx } from '../../src/lib/cx'

/** Matches the transition below. Kept as a number so the unmount waits exactly as long. */
const SLIDE_MS = 220

/**
 * One learner, opened from wherever their name appears — the roster, a payment. It slides in
 * from the right rather than appearing, because it arrives over a list somebody is reading:
 * the movement says where it came from and that the list is still underneath.
 */
export function UserDrawer({
  userId,
  onClose,
  onChanged,
}: {
  userId: string
  onClose: () => void
  /** Called instead of onClose when something about the learner changed. */
  onChanged?: () => void
}) {
  const { data, error } = useAdminQuery<UserDetail>(`/api/admin-portal/users/${userId}`)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  /*
   * Mounted closed, then opened on the next frame. Rendering it already open would put it in
   * its final position before the browser has a first frame to animate away from, and it
   * would simply appear — which is the thing this is not supposed to do.
   */
  const [shown, setShown] = useState(false)
  const [entitlement, setEntitlement] = useState(false)

  /** Sales may read a learner and may not spend money on one. The server decides; this only
   * keeps a button that would answer 403 off the screen. */
  const canGrant = session.role() === 'Admin'

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const dismiss = useCallback(
    (changed = false) => {
      setShown(false)
      window.setTimeout(() => (changed && onChanged ? onChanged() : onClose()), SLIDE_MS)
    },
    [onChanged, onClose],
  )

  // Escape closes it: it covers the list, and reaching for the mouse to get back is a step.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismiss])

  // The page behind it must not scroll while it is open, or the list drifts under the panel.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  async function change(path: string, body: unknown) {
    setBusy(true)
    setFailure('')

    try {
      await adminFetch(`/api/admin-portal/users/${userId}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      dismiss(true)
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Bajarilmadi')
      setBusy(false)
    }
  }

  return (
    <div
      className={cx(
        'fixed inset-0 z-40 flex justify-end transition-opacity duration-200 motion-reduce:transition-none',
        shown ? 'bg-black/40 opacity-100' : 'bg-black/40 opacity-0',
      )}
      onClick={() => dismiss()}
      role="presentation"
    >
      <aside
        className={cx(
          'h-full w-full max-w-lg overflow-y-auto bg-ground p-4 shadow-2xl sm:p-6',
          'transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none',
          shown ? 'translate-x-0' : 'translate-x-full',
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Foydalanuvchi ma'lumoti"
      >
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data && !error && <Loading />}

        {data && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold text-ink">{data.displayName ?? 'Ismsiz'}</h2>
                <p className="truncate text-sm text-ink-muted">{data.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => dismiss()}>
                Yopish
              </Button>
            </div>

            {/*
              The two levels first and as figures rather than as two more rows in a list of
              fourteen. They are what somebody opening this panel mid-conversation is looking
              for, and a level buried between time zone and device is a level nobody reads.
            */}
            <div className="grid grid-cols-2 gap-3">
              <LevelTile label="Gapirish" value={data.speakingLevel} />
              <LevelTile label="Tushunish" value={data.comprehensionLevel} />
            </div>

            <Card className="space-y-2">
              <Line label="Reja" value={data.plan} accent={data.plan !== 'Free'} />
              <Line label="Kurs kuni" value={data.currentDay ? `${data.currentDay}-kun` : '-'} />
              <Line
                label="Tavsiya etilgan boshlanish"
                value={data.recommendedStartDay ? `${data.recommendedStartDay}-kun` : '-'}
              />
              <Line label="Bajarilgan mashqlar" value={String(data.completedMissions)} />
              <Line label="Telefon" value={data.phoneNumber ?? '-'} />
              <Line label="Til" value={data.uiLanguage} />
              <Line label="Qurilma" value={data.device} />
              <Line label="Vaqt mintaqasi" value={data.timeZoneId} />
              <Line label="Rol" value={data.role} />
              <Line label="Oxirgi kirish" value={formatDateTime(data.lastLoginAt)} />
              <Line label="Ro'yxatdan o'tgan" value={formatDateTime(data.createdAt)} />
            </Card>

            <div>
              <SectionHeading>Oxirgi mashqlar</SectionHeading>
              {data.recentMissions.length === 0 ? (
                <EmptyNote>Hali mashq boshlanmagan</EmptyNote>
              ) : (
                <ul className="space-y-2">
                  {data.recentMissions.map((attempt) => (
                    <li
                      key={attempt.id}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border-2 border-hairline px-4 py-3"
                    >
                      <span className="text-sm text-ink">{formatDateTime(attempt.createdAt)}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone={attempt.status === 'Completed' ? 'milestone' : 'neutral'}>
                          {attempt.status}
                        </Badge>
                        <span className="w-8 text-right text-sm tabular-nums text-ink-muted">
                          {attempt.overallScore ?? '-'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {failure && <ErrorNote>{failure}</ErrorNote>}

            {canGrant &&
              (entitlement ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    onClick={() => change('grant-pro', { days: 30, reason: 'Admin panel' })}
                    disabled={busy}
                    block
                  >
                    {busy ? 'Berilmoqda...' : '30 kunlik PRO berish'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => change('revoke-pro', { reason: 'Admin panel: restore free access' })}
                    disabled={busy}
                    block
                  >
                    {busy ? 'Qaytarilmoqda...' : 'FREE holatiga qaytarish'}
                  </Button>
                </div>
              ) : (
                /*
                 * Folded away behind one press. This panel is opened to read somebody, and two
                 * buttons that change what they paid for sat directly under a list that is
                 * scrolled with the mouse.
                 */
                <Button variant="secondary" block onClick={() => setEntitlement(true)}>
                  Obunani o'zgartirish
                </Button>
              ))}
          </div>
        )}
      </aside>
    </div>
  )
}

/** Unmeasured is said out loud, because a dash reads as a level of zero. */
function LevelTile({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-4 py-3">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</div>
      {value ? (
        <div className="mt-1 text-2xl font-extrabold tabular-nums text-signal-ink">{value}</div>
      ) : (
        <div className="mt-1 text-sm font-bold text-ink-faint">Aniqlanmagan</div>
      )}
    </div>
  )
}

function Line({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={cx('text-sm font-bold', accent ? 'text-signal-ink' : 'text-ink')}>{value}</span>
    </div>
  )
}
