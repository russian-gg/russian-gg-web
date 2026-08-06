import { useCallback, useEffect, useState } from 'react'

const STORAGE_PREFIX = import.meta.env.VITE_ADMIN_STORAGE_PREFIX ?? 'rgg.admin'
const TOKEN_KEY = `${STORAGE_PREFIX}.token`
const NAME_KEY = `${STORAGE_PREFIX}.name`
const SECTION_KEY = `${STORAGE_PREFIX}.section`
const ADMIN_API_BASE = (import.meta.env.VITE_ADMIN_API_BASE ?? '/api/admin-portal').replace(/\/$/, '')

/**
 * The session, held outside React so a 401 arriving from any request in flight can end it
 * once. Every screen fetches on its own; without a single place to drop the token, an expired
 * session showed up as five separate error boxes and the panel sat there, signed out in every
 * way except the one that matters.
 */
const listeners = new Set<() => void>()

export const session = {
  token: () => localStorage.getItem(TOKEN_KEY) ?? '',
  name: () => localStorage.getItem(NAME_KEY) ?? 'Russian.gg Admin',
  signIn(token: string, name: string) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(NAME_KEY, name)
    listeners.forEach((notify) => notify())
  },
  signOut() {
    localStorage.removeItem(TOKEN_KEY)
    listeners.forEach((notify) => notify())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    // Braced: an effect cleanup that returns a value is not a cleanup function.
    return () => {
      listeners.delete(listener)
    }
  },
}

export const adminSectionKey = SECTION_KEY

export function adminApiPath(path: string) {
  if (path.startsWith('/api/admin-portal')) {
    return `${ADMIN_API_BASE}${path.slice('/api/admin-portal'.length)}`
  }

  if (path.startsWith('/')) {
    return `${ADMIN_API_BASE}${path}`
  }

  return `${ADMIN_API_BASE}/${path}`
}

export function useSession() {
  const [token, setToken] = useState(session.token)
  const [name, setName] = useState(session.name)

  useEffect(() =>
    session.subscribe(() => {
      setToken(session.token())
      setName(session.name())
    }),
  [])

  return { token, name }
}

export class AdminRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/**
 * Every admin request goes through here so the expired-token case has exactly one answer:
 * drop the session, which puts the login screen back on the screen. The alternative — each
 * caller deciding for itself — is what let a panel keep rendering stale numbers behind an
 * error box after the token ran out.
 */
export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(adminApiPath(path), {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
      authorization: `Bearer ${session.token()}`,
    },
  })

  if (response.status === 401 || response.status === 403) {
    session.signOut()
    throw new AdminRequestError('Sessiya tugadi. Qaytadan kiring.', response.status)
  }

  if (!response.ok) {
    throw new AdminRequestError("So'rov bajarilmadi.", response.status)
  }

  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}

export function useAdminQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setLoading] = useState(Boolean(path))
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!path) {
      setLoading(false)
      return
    }

    let cancelled = false
    setError('')
    setLoading(true)

    adminFetch<T>(path)
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch((next: Error) => {
        if (!cancelled) setError(next.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [path, tick])

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  // Data is kept while a refetch runs, so a period switch redraws rather than blanking.
  return { data, error, isLoading, refresh }
}

const numbers = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export const formatNumber = (value: number) => numbers.format(value)

export const formatMoney = (value: number, currency = 'UZS') => `${numbers.format(value)} ${currency}`

/** Fractions of a cent are the normal case here, so the usual two decimals would read as zero. */
export const formatUsd = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`

export const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

/** Unmeasured is a dash, never a zero — the same rule the product applies to skills. */
export const formatPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value.toFixed(1)}%`
