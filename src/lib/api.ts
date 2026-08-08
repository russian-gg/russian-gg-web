import type { ApiError, AuthResponse } from './types'

const ACCESS_KEY = 'rgg.access'
const REFRESH_KEY = 'rgg.refresh'
const PENDING_ACCESS_KEY = 'rgg.pending.access'
const PENDING_REFRESH_KEY = 'rgg.pending.refresh'

/**
 * Tokens live in localStorage so a refresh keeps the learner signed in on a phone that
 * backgrounds the tab aggressively. Nothing else is cached here: never audio, never a
 * payment state the server has not confirmed (PRD §11).
 */
export const tokenStore = {
  access: () => localStorage.getItem(ACCESS_KEY) ?? sessionStorage.getItem(PENDING_ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(PENDING_REFRESH_KEY),
  hasPending: () => !!sessionStorage.getItem(PENDING_ACCESS_KEY),
  set(auth: Pick<AuthResponse, 'accessToken' | 'refreshToken'>) {
    localStorage.setItem(ACCESS_KEY, auth.accessToken)
    localStorage.setItem(REFRESH_KEY, auth.refreshToken)
    sessionStorage.removeItem(PENDING_ACCESS_KEY)
    sessionStorage.removeItem(PENDING_REFRESH_KEY)
  },
  setPending(auth: Pick<AuthResponse, 'accessToken' | 'refreshToken'>) {
    sessionStorage.setItem(PENDING_ACCESS_KEY, auth.accessToken)
    sessionStorage.setItem(PENDING_REFRESH_KEY, auth.refreshToken)
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
  promotePending() {
    const access = sessionStorage.getItem(PENDING_ACCESS_KEY)
    const refresh = sessionStorage.getItem(PENDING_REFRESH_KEY)
    if (!access || !refresh) return

    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
    sessionStorage.removeItem(PENDING_ACCESS_KEY)
    sessionStorage.removeItem(PENDING_REFRESH_KEY)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(PENDING_ACCESS_KEY)
    sessionStorage.removeItem(PENDING_REFRESH_KEY)
  },
}

/**
 * The language the app is rendering, mirrored onto every request so the server can answer
 * its own messages in the same one. Set by the locale provider; defaults to Uzbek before it
 * mounts, which matches the product default.
 */
let requestLanguage = 'uz'

export function setRequestLanguage(language: string) {
  requestLanguage = language
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
  const response = await sendRaw(method, path, body, retry)

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

async function sendRaw(method: Method, path: string, body?: unknown, retry = true): Promise<Response> {
  const headers: Record<string, string> = { 'accept-language': requestLanguage }
  const access = tokenStore.access()
  if (access) headers.authorization = `Bearer ${access}`
  if (body !== undefined) headers['content-type'] = 'application/json'

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && retry && (await refreshAccessToken())) {
    return sendRaw(method, path, body, false)
  }

  return response
}

/**
 * A request the browser must finish even though the page is going away. `sendBeacon` cannot
 * carry an Authorization header, so this is a keepalive fetch instead: the browser keeps it
 * alive past unload, which is what closing a voice session on pagehide depends on.
 *
 * It never refreshes the token and never throws — there is no page left to show an error to.
 */
function sendOnExit(path: string, body: unknown) {
  const headers: Record<string, string> = {
    'accept-language': requestLanguage,
    'content-type': 'application/json',
  }
  const access = tokenStore.access()
  if (access) headers.authorization = `Bearer ${access}`

  try {
    void fetch(`/api${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Over the keepalive size limit, or the tab died first. Nothing left to do here; the
    // server reaps sessions the client never closed.
  }
}

export const api = {
  get: <T>(path: string) => send<T>('GET', path),
  post: <T>(path: string, body?: unknown) => send<T>('POST', path, body),
  postOnExit: sendOnExit,
  postForm: async <T>(path: string, body: FormData) => {
    const headers: Record<string, string> = { 'accept-language': requestLanguage }
    const access = tokenStore.access()
    if (access) headers.authorization = `Bearer ${access}`

    const response = await fetch(`/api${path}`, {
      method: 'POST',
      headers,
      body,
    })

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
  },
  postBlob: async (path: string, body?: unknown) => {
    const response = await sendRaw('POST', path, body)

    if (!response.ok) {
      const error = await response
        .json()
        .catch<ApiError>(() => ({ code: 'network_error', message: 'Request failed.' }))

      throw new RequestError(response.status, error.code, error.message)
    }

    return response.blob()
  },
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

/**
 * A first-party id the browser keeps, so a visitor who comes back twice is not counted twice.
 *
 * Not a person and not claimed to be one: clearing storage or opening another browser makes
 * another visitor. It is stored under our own origin, contains nothing about anybody, and is
 * never sent anywhere but here — which is the whole reason this is a homegrown counter rather
 * than a third-party script.
 */
function visitorId(): { id: string; isFirst: boolean } {
  const key = 'rgg.visitor'

  try {
    const existing = localStorage.getItem(key)
    if (existing) return { id: existing, isFirst: false }

    const id = crypto.randomUUID()
    localStorage.setItem(key, id)

    return { id, isFirst: true }
  } catch {
    // Private mode, or storage turned off. The visit still counts; it just counts as new.
    return { id: crypto.randomUUID(), isFirst: true }
  }
}

/**
 * A page opened, whether or not anybody has signed in. This is the only measurement the
 * product takes of people who have not registered, and every other number on the panel starts
 * after them.
 *
 * Sent once per path per tab: a learner moving back and forth between two screens is one
 * visit to each, not twenty. Failures are swallowed — a visitor who cannot be counted still
 * gets the site.
 */
const seenPaths = new Set<string>()

export function trackVisit(path: string) {
  if (seenPaths.has(path)) return
  seenPaths.add(path)

  const visitor = visitorId()

  void api
    .post('/analytics/visit', {
      visitorId: visitor.id,
      sessionId: sessionId(),
      path,
      referrer: document.referrer || null,
      source: new URLSearchParams(window.location.search).get('utm_source'),
      isFirstVisit: visitor.isFirst,
    })
    .catch(() => {})
}
