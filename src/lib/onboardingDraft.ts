const KEY = 'rgg.onboarding.trial'

/**
 * The token for a recording made before the learner had an account.
 *
 * They speak first — asking for a sign-up in front of the microphone charges the highest price
 * before showing any value — and the assessment is stored server-side against this token. It
 * is held only for the hop through sign-up: sessionStorage, so it dies with the tab and never
 * becomes a second, stale source of truth beside the server's own placement.
 *
 * It is not a credential. It grants no access; it only lets one already-paid-for assessment
 * attach itself to one new account, so nobody is measured twice.
 */
export const onboardingDraft = {
  save(token: string) {
    try {
      sessionStorage.setItem(KEY, token)
    } catch {
      // Private mode. They keep the result on screen either way; only the hand-over is lost.
    }
  },

  read(): string | null {
    try {
      return sessionStorage.getItem(KEY)
    } catch {
      return null
    }
  },

  exists() {
    return Boolean(this.read())
  },

  clear() {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      // Nothing to clear is the same outcome.
    }
  },
}
