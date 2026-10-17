// The pixel itself is loaded by the snippet in index.html, which defines `fbq` before React
// mounts. Calls made before fbevents.js arrives are queued by that stub and sent once it loads.

declare global {
  interface Window {
    fbq?: (command: 'track', event: string, parameters?: Record<string, string>) => void
  }
}

/**
 * Tells Meta a new account was opened. Never throws: an ad blocker that removed `fbq` must not
 * stand between a learner and the page after sign-up.
 */
export function trackMetaRegistration(method: 'phone' | 'google') {
  try {
    window.fbq?.('track', 'CompleteRegistration', { registration_method: method })
  } catch {
    // Analytics only.
  }
}
