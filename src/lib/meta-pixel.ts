// The Meta Pixel lives with the landing page instead of in index.html, and that placement is
// the point: the only visit an ad platform should be told about is one an ad could have caused.
// A learner opening the installed app every morning is not that visit, and letting those loads
// report PageView would quietly fill the audience the campaigns optimise against with people
// who already pay us. The landing route is public-only, so scoping the pixel to it leaves
// exactly the anonymous arrivals the ads are buying.

const PIXEL_ID = '1726106959239139'

/**
 * Meta's loader replaces `callMethod` once fbevents.js arrives and replays whatever the stub
 * collected in `queue`, so the shape below is not ours to simplify — it is the contract the
 * remote script expects to find on `window.fbq`.
 */
type Fbq = {
  (command: string, ...args: unknown[]): void
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  push: Fbq
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

let reported = false

/**
 * Reports a landing-page visit to Meta. Never throws and never blocks: an ad blocker that
 * refuses the request, or a network that drops it, must not stand between a visitor and the
 * page they came to read. Calling it again is a no-op — the pixel is initialised once per
 * document, so returning to the landing page in the same session does not double-count.
 */
export function trackLandingVisit() {
  if (reported) return
  reported = true
  try {
    installPixel()
    window.fbq?.('init', PIXEL_ID)
    window.fbq?.('track', 'PageView')
  } catch {
    // Analytics only.
  }
}

/**
 * Defines the `fbq` stub before requesting fbevents.js, which is what lets the two calls above
 * run immediately: they are held in `queue` and sent the moment the script loads.
 */
function installPixel() {
  if (window.fbq) return
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  }) as Fbq
  fbq.queue = []
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  window.fbq = fbq
  window._fbq ??= fbq

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
}
