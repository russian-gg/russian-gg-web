import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Installing Russian.gg onto a phone.
 *
 * Two paths wear one name. Chrome on Android hands us an event we can fire, so the button
 * really does install it. Everywhere else — every browser on iOS, and Firefox and Samsung
 * Internet on Android — installing is a item in the browser's own menu that no page can
 * reach, so the button opens instructions instead. Either way pressing it does something,
 * which is the part that matters: a button that appears to do nothing reads as broken.
 */

/** Chrome's install event. Not in the DOM types, because it is not in any specification. */
type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Set once the app has been installed, which is the only thing that stops the offer for good. */
const INSTALLED_KEY = 'rgg.install.done'

/** Set the first time the offer is closed, which is what makes the next visit a returning one. */
const SEEN_KEY = 'rgg.install.seen'

/** Set when the learner asks not to be offered it again. Outranks everything below. */
const NEVER_KEY = 'rgg.install.never'

/** A first-time visitor gets the product to themselves for this long. */
const FIRST_DELAY_MS = 10_000

/** After that, and on every later visit, it comes back on this cadence. */
const REPEAT_MS = 60_000

export type InstallHow = 'prompt' | 'ios' | 'android'

export type InstallState = {
  offered: boolean
  /** How this browser installs: by our button, or by a menu we can only describe. */
  how: InstallHow
  /** Fires the browser's own dialog. Resolves false where there is nothing to fire. */
  install: () => Promise<boolean>
  dismiss: () => void
  /** The learner has asked not to be offered this again. */
  never: boolean
  setNever: (value: boolean) => void
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // Safari's own flag, and the only one iOS sets.
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
 * Phones and tablets only.
 *
 * A desktop browser that can install shows its own icon in the address bar, and a sheet over
 * the corner of a large screen is in the way of a thing somebody can already do.
 */
function isMobile() {
  return isIos() || /android|mobile/i.test(navigator.userAgent)
}

export function useInstallOffer(): InstallState {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [offered, setOffered] = useState(false)
  const [done, setDone] = useState(false)
  const [never, setNeverState] = useState(() => localStorage.getItem(NEVER_KEY) === 'true')

  /*
   * One timer, rescheduled rather than a repeating interval: the gap has to start when the
   * sheet is closed, not on a fixed grid that could bring it back a second later.
   */
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (
      isStandalone() ||
      !isMobile() ||
      localStorage.getItem(INSTALLED_KEY) === 'true' ||
      localStorage.getItem(NEVER_KEY) === 'true'
    ) {
      return
    }

    const show = () => setOffered(true)

    // Ten seconds on a first visit, and a minute on every visit after one that was closed.
    // Closing it should quiet it for a while, not end the conversation.
    const first = localStorage.getItem(SEEN_KEY) === 'true' ? REPEAT_MS : FIRST_DELAY_MS
    timer.current = window.setTimeout(show, first)

    const onAvailable = (incoming: Event) => {
      // Chrome shows a bar of its own unless this is called, and two offers for one thing is
      // worse than either alone.
      incoming.preventDefault()
      setEvent(incoming as InstallEvent)
    }

    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, 'true')
      setDone(true)
      setOffered(false)
    }

    // Whatever Chrome fired before this component existed; see the listener in index.html.
    const stashed = (window as Window & { __rggInstall?: InstallEvent }).__rggInstall
    if (stashed) setEvent(stashed)

    window.addEventListener('beforeinstallprompt', onAvailable)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onAvailable)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(timer.current)
    }
  }, [])

  /*
   * Written the moment the box is ticked rather than when the sheet is closed. Somebody who
   * ticks it and then wanders off to another page has already said what they want, and losing
   * that because they did not also press a button would be answering a plain "no" with the
   * same offer a minute later.
   *
   * The sheet stays up: ticking is a preference, not a close, and pulling the panel out from
   * under a finger is its own small rudeness. Untick puts it back.
   */
  const setNever = useCallback((value: boolean) => {
    localStorage.setItem(NEVER_KEY, String(value))
    setNeverState(value)
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(SEEN_KEY, 'true')
    setOffered(false)

    window.clearTimeout(timer.current)

    // Nothing is scheduled once they have asked to be left alone.
    if (localStorage.getItem(NEVER_KEY) === 'true') return

    timer.current = window.setTimeout(() => setOffered(true), REPEAT_MS)
  }, [])

  const install = useCallback(async () => {
    if (!event) return false

    await event.prompt()
    const { outcome } = await event.userChoice

    // Chrome allows one prompt per event, spent either way — including the copy the page
    // caught before React started.
    delete (window as Window & { __rggInstall?: InstallEvent }).__rggInstall
    setEvent(null)

    if (outcome === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, 'true')
      setDone(true)
      setOffered(false)

      return true
    }

    dismiss()

    return false
  }, [event, dismiss])

  return {
    offered: offered && !done,
    how: event ? 'prompt' : isIos() ? 'ios' : 'android',
    install,
    dismiss,
    never,
    setNever,
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
