import { api, RequestError } from './api'

/**
 * The Telegram chat somebody arrived from.
 *
 * The sales bot puts `?tg=<token>` on every sign-up and payment link it sends. Most people do
 * not sign up on the page they land on — they look around, leave, come back, go through Google
 * — so the token is kept in this browser until there is an account to hand it to. Handing it
 * back is what lets the bot, and the person reading its inbox, know who they were talking to.
 */

const STORAGE_KEY = 'rgg:telegram-claim'

/** As long as the server keeps it usable. Older ones are dropped rather than sent. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

const TOKEN = /^[a-f0-9]{32}$/

type Stored = { token: string; savedAt: number }

/**
 * Reads the token off the address and takes it out of the address bar, so it is not
 * bookmarked or shared along with the page. Runs once, before the router sees the URL.
 */
export function captureTelegramClaim() {
  try {
    const url = new URL(window.location.href)
    const token = url.searchParams.get('tg')
    if (!token) return

    url.searchParams.delete('tg')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)

    if (!TOKEN.test(token)) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, savedAt: Date.now() } satisfies Stored))
  } catch {
    // Storage blocked or a malformed address: the visitor still gets the page.
  }
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Stored
    if (!TOKEN.test(stored.token) || Date.now() - stored.savedAt > MAX_AGE_MS) {
      forget()
      return null
    }
    return stored
  } catch {
    return null
  }
}

function forget() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

let inFlight: Promise<void> | null = null

/**
 * Hands a captured token to the signed-in account. Kept when the network fails, so the next
 * session can try again; dropped once the server has answered either way, because a token it
 * refused once it will refuse again.
 */
export function claimTelegramChat(): Promise<void> {
  if (inFlight) return inFlight
  const stored = read()
  if (!stored) return Promise.resolve()

  inFlight = api
    .post('/integrations/telegram/claim', { token: stored.token })
    .then(() => forget())
    .catch((error: unknown) => {
      if (error instanceof RequestError && error.status < 500 && error.status !== 401 && error.status !== 429) {
        forget()
      }
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}
