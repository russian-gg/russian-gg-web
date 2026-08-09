import { useCallback, useEffect, useState } from 'react'

/**
 * Installing Russian.gg onto a phone.
 *
 * Two different things wear one name here. On Android and desktop Chrome the browser decides
 * the app is installable and hands us an event we can fire later — so the button really does
 * install it. On iOS there is no such event and never has been: Safari only installs from its
 * own Share menu, so the honest thing is to say where that menu is rather than to show a
 * button that cannot work.
 */

/** Chrome's install event. Not in the DOM types, because it is not in any specification. */
type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'rgg.install.dismissedAt'

/** Where the pre-mount listener in index.html leaves the event it caught. */
type WindowWithStash = Window & { __rggInstall?: InstallEvent }

/**
 * How long a "not now" is respected. Long enough not to nag somebody who meant it, short
 * enough that a learner who comes back for a second month is asked again.
 */
const QUIET_DAYS = 30

/** How long after arriving the offer appears. The first screen belongs to the product. */
const DELAY_MS = 12_000

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own flag, which is what iOS sets on an installed app.
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPads report as a Mac; a Mac with a touchscreen is the tell.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * iOS installs only from Safari's Share menu. Chrome, Firefox and every in-app browser on iOS
 * are the same engine wearing a different toolbar, and none of them has that menu item — so
 * telling their users to look for it sends them hunting for something that is not there.
 */
function isIosSafari() {
  return isIos() && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|opios/i.test(navigator.userAgent)
}

function recentlyDismissed() {
  const at = Number(localStorage.getItem(DISMISSED_KEY) ?? 0)

  return at > 0 && Date.now() - at < QUIET_DAYS * 24 * 60 * 60 * 1000
}

export type InstallState = {
  /** Whether to show the offer at all. */
  offered: boolean
  /** True where we can only point at the Share menu rather than install it ourselves. */
  manual: boolean
  install: () => Promise<void>
  dismiss: () => void
}

export function useInstallOffer(): InstallState {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [manual, setManual] = useState(false)
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    const onAvailable = (incoming: Event) => {
      // Chrome shows its own bar unless this is called, and two offers for one thing is worse
      // than either of them alone.
      incoming.preventDefault()
      setEvent(incoming as InstallEvent)
    }

    const onInstalled = () => {
      setHidden(true)
      // Never ask again: it is on the phone.
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    }

    // Whatever fired before this component existed.
    const stashed = (window as WindowWithStash).__rggInstall
    if (stashed) setEvent(stashed)

    window.addEventListener('beforeinstallprompt', onAvailable)
    window.addEventListener('appinstalled', onInstalled)

    // iOS never fires the event, so the offer there is on a timer alone.
    if (isIosSafari()) setManual(true)

    const timer = window.setTimeout(() => setReady(true), DELAY_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', onAvailable)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(timer)
    }
  }, [])

  const install = useCallback(async () => {
    if (!event) return

    await event.prompt()
    const { outcome } = await event.userChoice

    // Chrome allows one prompt per event, so it goes either way — including the copy the
    // page caught before React started.
    delete (window as WindowWithStash).__rggInstall
    setEvent(null)
    if (outcome === 'dismissed') localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setHidden(true)
  }, [event])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setHidden(true)
  }, [])

  return {
    offered: ready && !hidden && (manual || event !== null),
    manual,
    install,
    dismiss,
  }
}

/**
 * Registers the worker after the page has settled.
 *
 * Deliberately after `load`: on the cheap Android phones this product is used on, a worker
 * registering during the first render competes for the same single core the app is trying to
 * paint with.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // An install that fails is a page that works slightly worse offline. Nothing else.
    })
  })
}
