import { Building2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { CENTER_QUERY_KEY, fetchCenter, useCenterStudent } from '../../lib/center'
import { formatDate } from '../../lib/format'
import { fill, useLocale, useT, type Dictionary } from '../../lib/i18n'
import type { MyCenterView } from '../../lib/types'
import { CenterLockNote } from '../../components/CenterLockNote'
import { Badge, QueryError, Spinner } from '../../components/ui'
import { SectionCard } from './stats'

/**
 * The learner's language center: which one, which group, and whether it gives Pro today.
 *
 * Read-only on purpose. The center registers its students by phone and the server links the
 * account at sign-in, so there is no code to enter; and only the center's admin can take a
 * student off, so there is no "leave" either. Nothing here buys anything — while the center
 * holds the seat the app sells nothing to this learner (see `lib/center.ts`).
 *
 * A learner in no center gets no card at all: an empty "your center" box is a question the
 * learner cannot do anything about.
 *
 * Every state is the server's. Whether the center pays, whether the seat is on and whether
 * Pro is open all arrive on `/me/center`; this card only chooses the sentence.
 */
export function CenterCard() {
  const t = useT()
  const { isCenterStudent } = useCenterStudent()

  const { data: center, isLoading, isError, refetch } = useQuery({
    queryKey: CENTER_QUERY_KEY,
    queryFn: fetchCenter,
    staleTime: 60_000,
    retry: false,
    enabled: isCenterStudent,
  })

  if (!isCenterStudent || (!isLoading && !isError && !center)) return null

  return (
    <SectionCard
      title={t.center.title}
      aside={<Building2 aria-hidden="true" strokeWidth={2} className="size-5 text-ink-faint" />}
    >
      {isLoading ? (
        <Spinner />
      ) : isError || !center ? (
        <QueryError onRetry={() => void refetch()} />
      ) : (
        <Membership center={center} t={t} />
      )}
    </SectionCard>
  )
}

function Membership({ center, t }: { center: MyCenterView; t: Dictionary }) {
  const { locale } = useLocale()
  const group = center.groupName?.trim() || null

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-extrabold tracking-tight text-ink">{center.centerName}</p>
        {group && <p className="text-support mt-0.5 text-sm">{fill(t.center.groupLine, { group })}</p>}
      </div>

      <MembershipState
        center={center}
        group={group}
        paidThrough={center.paidThrough ? formatDate(center.paidThrough, locale) : null}
        t={t}
      />
    </div>
  )
}

/**
 * The one sentence for where the learner stands.
 *
 * In order of what overrides what: a seat the center switched off says so whatever the
 * center's own state; a center that is not giving Pro today — not paid, not started, or the
 * seat still waiting — says it is waiting on the center; then an open seat, with the day the
 * center has paid it up to.
 */
function MembershipState({
  center,
  group,
  paidThrough,
  t,
}: {
  center: MyCenterView
  group: string | null
  /** The center's last paid day, already formatted for the learner's language. */
  paidThrough: string | null
  t: Dictionary
}) {
  const name = center.centerName

  if (center.status === 'deactivated') return <CenterLockNote lock="paused" />

  if (!center.centerActive || center.status === 'requested' || !center.hasPro) {
    return <CenterLockNote lock="pending" />
  }

  return (
    <div className="space-y-2">
      <p className="text-base leading-relaxed text-ink">
        {group
          ? fill(t.center.centerPaid, { center: name, group })
          : fill(t.center.centerPaidNoGroup, { center: name })}
      </p>
      {paidThrough && <Badge tone="milestone">{fill(t.center.paidThrough, { date: paidThrough })}</Badge>}
    </div>
  )
}
