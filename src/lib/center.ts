import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useAuth } from './auth-context'
import type { Dictionary } from './i18n'
import type { EntitlementView, MyCenterView } from './types'

/*
  A language center's student pays nothing and buys nothing: the center registers them by
  phone, the server links the account when they sign in, and the center's admin is the only
  one who can take them off again. So for as long as the server names a center, the app has
  no plans to show, no trial to start and no gift to open — checkout and trial refuse them
  anyway ("center_student"). When the center removes them the name goes away, and every
  surface that asked this module comes back on its own.
*/

export const CENTER_QUERY_KEY = ['center'] as const

/**
 * `/me/center` answers 204 for a learner who is in no center, which the client turns into
 * `undefined` — and React Query refuses `undefined` as data. `null` is the "no center" answer.
 */
export async function fetchCenter(): Promise<MyCenterView | null> {
  return (await api.get<MyCenterView | undefined>('/me/center')) ?? null
}

/**
 * Why a center student's Pro is closed. `paused`: the center switched their seat off.
 * `pending`: anything else — the center has not paid, or has not started yet.
 */
export type CenterLock = 'pending' | 'paused'

export interface CenterStudent {
  /** The learner belongs to a center: nothing about Pro is for sale to them. */
  isCenterStudent: boolean
  centerName: string | null
  /** Set while the center does not give Pro right now; null when it does, or for nobody's student. */
  lock: CenterLock | null
}

/**
 * Whether the signed-in learner is a center's student, from the queries the app already holds.
 *
 * The entitlement wins once it is in: it is the one refetched after access changes, so it is
 * what notices the center letting a learner go. Until then the profile from `/auth/me` answers,
 * which keeps an upsell from flashing on the first paint. The center's own view is asked for
 * only when Pro is closed, to tell a paused seat from an unpaid center.
 */
export function useCenterStudent(): CenterStudent {
  const { user } = useAuth()
  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    staleTime: 60_000,
    retry: false,
    enabled: Boolean(user),
  })

  const centerName = (entitlement ? entitlement.centerName : user?.centerName)?.trim() || null
  const isCenterStudent = Boolean(user && centerName)
  const closed = isCenterStudent && entitlement?.hasProAccess === false

  const { data: center } = useQuery({
    queryKey: CENTER_QUERY_KEY,
    queryFn: fetchCenter,
    staleTime: 60_000,
    retry: false,
    enabled: closed,
  })

  return {
    isCenterStudent,
    centerName,
    lock: closed ? (center?.status === 'deactivated' ? 'paused' : 'pending') : null,
  }
}

/** The one sentence a center student gets where everyone else gets an offer. */
export function centerLockText(lock: CenterLock, t: Dictionary) {
  return lock === 'paused' ? t.center.lockPaused : t.center.lockPending
}
