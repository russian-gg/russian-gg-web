import { useState, type FormEvent } from 'react'
import { Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, RequestError } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { fill, useLocale, useT, type Dictionary } from '../../lib/i18n'
import type { MyCenterView } from '../../lib/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Badge, Button, ErrorNote, Field, LinkButton, QueryError, Spinner } from '../../components/ui'
import { SectionCard } from './stats'

export const CENTER_QUERY_KEY = ['center'] as const

/** A center code: six letters and digits, the way the center's admin reads it out. */
const CODE_LENGTH = 6

/**
 * `/me/center` answers 204 for a learner who is in no center, which the client turns into
 * `undefined` — and React Query refuses `undefined` as data. `null` is the "no center" answer.
 */
async function fetchCenter(): Promise<MyCenterView | null> {
  return (await api.get<MyCenterView | undefined>('/me/center')) ?? null
}

/**
 * Joining or leaving a center can open or close Pro, and in "student pays" mode it changes the
 * monthly price the paywall quotes. Every view that shows a lock or a price has to ask again —
 * the same list the welcome gift refreshes when it opens bonus days.
 */
function refreshAccess(queryClient: QueryClient) {
  return Promise.all(
    ['entitlement', 'plans', 'course-map', 'day-missions', 'home', 'progress', 'mission-detail'].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  )
}

/**
 * The learner's language center: a code to join one, or where they stand in the one they are in.
 *
 * Every state is the server's. Whether the center pays, whether the membership is approved and
 * whether Pro is open all arrive on `/me/center`; this card only chooses the sentence. Paying
 * is not done here either — "student pays" sends the learner to the paywall on the monthly
 * plan, where the server has already swapped the list price for the center's.
 */
export function CenterCard() {
  const t = useT()

  const { data: center, isLoading, isError, refetch } = useQuery({
    queryKey: CENTER_QUERY_KEY,
    queryFn: fetchCenter,
    staleTime: 60_000,
    retry: false,
  })

  return (
    <SectionCard
      title={t.center.title}
      aside={<Building2 aria-hidden="true" strokeWidth={2} className="size-5 text-ink-faint" />}
    >
      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : center ? (
        <Membership center={center} t={t} />
      ) : (
        <JoinForm t={t} />
      )}
    </SectionCard>
  )
}

/* ---------------------------------------------------------------------------- join */

function JoinForm({ t }: { t: Dictionary }) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join(event: FormEvent) {
    event.preventDefault()
    if (code.length !== CODE_LENGTH || busy) return

    setBusy(true)
    setError(null)
    try {
      const joined = await api.post<MyCenterView>('/me/center/join', { code })
      queryClient.setQueryData(CENTER_QUERY_KEY, joined)
      void refreshAccess(queryClient)
    } catch (caught) {
      // "Wrong code" and "already in another center" are the server's sentences, in the
      // learner's language; only a failure with nothing to say falls back to ours.
      setError(caught instanceof RequestError ? caught.message : t.center.joinFailed)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void join(event)} className="space-y-4">
      <p className="text-support text-sm leading-relaxed">{t.center.joinIntro}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="sm:w-56">
          <Field
            name="center-code"
            label={t.center.codeLabel}
            hint={t.center.codeHint}
            placeholder={t.center.codePlaceholder}
            value={code}
            // Letters are folded to capitals and anything else is dropped as it is typed, so
            // "abc-123" pasted from a message arrives as the code the center printed.
            onChange={(event) =>
              setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))
            }
            maxLength={CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-extrabold tracking-[0.2em] uppercase"
          />
        </div>
        {/* Level with the input rather than under its hint: the label above it is 1.75rem. */}
        <Button
          type="submit"
          className="sm:mt-7"
          block
          disabled={code.length !== CODE_LENGTH || busy}
        >
          {busy ? t.center.joining : t.center.join}
        </Button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
    </form>
  )
}

/* ---------------------------------------------------------------------- membership */

function Membership({ center, t }: { center: MyCenterView; t: Dictionary }) {
  const { locale } = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function leave() {
    setBusy(true)
    setError(null)
    try {
      await api.delete('/me/center')
      queryClient.setQueryData(CENTER_QUERY_KEY, null)
      void refreshAccess(queryClient)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.center.leaveFailed)
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  const price = formatPrice(center.pricePerSeatTiyin, 'UZS', locale)
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
        price={price}
        t={t}
        onPay={() => navigate('/paywall?period=Monthly')}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Quiet and last: it is the one thing on this card nobody came here to do by accident. */}
      <div className="border-t border-hairline pt-3">
        <Button variant="ghost" size="sm" className="-ml-4" onClick={() => setConfirming(true)}>
          {t.center.leave}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t.center.leaveTitle}
        body={<p>{fill(t.center.leaveBody, { center: center.centerName })}</p>}
        confirmLabel={t.center.leave}
        danger
        busy={busy}
        onConfirm={() => void leave()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}

/**
 * The one sentence — and, where there is one, the one action — for where the learner stands.
 *
 * In order of what overrides what: a membership the center switched off says so whatever the
 * center's own state; a center that is not running says so before an approval that cannot
 * mean anything yet; then the two ways an active membership is paid for.
 */
function MembershipState({
  center,
  group,
  price,
  t,
  onPay,
}: {
  center: MyCenterView
  group: string | null
  price: string
  t: Dictionary
  onPay: () => void
}) {
  const name = center.centerName

  if (center.status === 'deactivated') {
    return (
      <div className="space-y-3">
        <Badge tone="caution">{t.center.deactivated}</Badge>
        {/* The center stopped paying for them, not the product: the ordinary offer still stands. */}
        {!center.hasPro && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-support text-sm">{t.center.deactivatedOffer}</p>
            <LinkButton to="/paywall" variant="secondary" size="md">
              {t.pro.upgrade}
            </LinkButton>
          </div>
        )}
      </div>
    )
  }

  if (!center.centerActive) return <Badge tone="neutral">{t.center.inactive}</Badge>

  if (center.status === 'requested') {
    return <p className="text-base leading-relaxed text-ink">{t.center.requested}</p>
  }

  if (center.payMode === 'center') {
    return (
      <p className="text-base leading-relaxed text-ink">
        {group
          ? fill(t.center.centerPaid, { center: name, group })
          : fill(t.center.centerPaidNoGroup, { center: name })}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-base leading-relaxed text-ink">
        {group ? fill(t.center.student, { center: name, group }) : fill(t.center.studentNoGroup, { center: name })}
      </p>
      {center.hasPro ? (
        <Badge tone="milestone">{t.center.proActive}</Badge>
      ) : (
        <>
          <p className="text-support text-sm">{fill(t.center.payBody, { price })}</p>
          {/* Full width on a phone, hugging its label from `sm`, like the banner's button. */}
          <Button block className="sm:w-auto sm:px-7" onClick={onPay}>
            {fill(t.center.pay, { price })}
          </Button>
        </>
      )}
    </div>
  )
}
