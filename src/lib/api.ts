import type { ApiError, AuthResponse } from './types'

const ACCESS_KEY = 'rgg.access'
const REFRESH_KEY = 'rgg.refresh'

/**
 * Tokens live in localStorage so a refresh keeps the learner signed in on a phone that
 * backgrounds the tab aggressively. Nothing else is cached here: never audio, never a
 * payment state the server has not confirmed (PRD §11).
 */
export const tokenStore = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set(auth: Pick<AuthResponse, 'accessToken' | 'refreshToken'>) {
    localStorage.setItem(ACCESS_KEY, auth.accessToken)
    localStorage.setItem(REFRESH_KEY, auth.refreshToken)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'RequestError'
  }

  /** The learner is authenticated but needs Pro for this. */
  get isPaywall() {
    return this.status === 402
  }

  get isUnauthorized() {
    return this.status === 401
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

let refreshInFlight: Promise<boolean> | null = null

/**
 * Refreshes at most once at a time. Several parallel requests hitting a just-expired token
 * would otherwise each rotate the refresh token, and all but one would be rejected as a
 * replay.
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStore.refresh()
  if (!refreshToken) return false

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        tokenStore.clear()
        return false
      }

      tokenStore.set((await response.json()) as AuthResponse)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

async function send<T>(method: Method, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {}
  const access = tokenStore.access()
  if (access) headers.authorization = `Bearer ${access}`
  if (body !== undefined) headers['content-type'] = 'application/json'

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && retry && (await refreshAccessToken())) {
    return send<T>(method, path, body, false)
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch<ApiError>(() => ({ code: 'network_error', message: 'Request failed.' }))

    throw new RequestError(response.status, error.code, error.message)
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string) => send<T>('GET', path),
  post: <T>(path: string, body?: unknown) => send<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => send<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => send<T>('PUT', path, body),
  delete: <T>(path: string) => send<T>('DELETE', path),
}

/**
 * Fire-and-forget product events. Never awaited by a screen: analytics must not be able to
 * slow down or break a learner's flow.
 */
export function track(name: string, properties?: Record<string, string>) {
  if (!tokenStore.access()) return
  void api.post('/analytics/events', { name, properties, sessionId: sessionId() }).catch(() => {})
}

function sessionId(): string {
  const key = 'rgg.session'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}
