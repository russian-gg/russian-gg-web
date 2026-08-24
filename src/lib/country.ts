import type { UserProfile } from './types'

/**
 * A best-effort, first-party guess at whether the visitor is in Uzbekistan — used only to decide
 * which sign-in method to lead with and whether a phone is required. It reads the browser's own
 * timezone and language and nothing else: the product deliberately does not call a third-party
 * geo-IP service to answer this.
 *
 * Errs toward "yes": the audience is Uzbek, so an unreadable environment defaults to the local
 * experience rather than the foreign one.
 */
export function isLikelyUzbekistan(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
    if (tz === 'Asia/Tashkent' || tz === 'Asia/Samarkand') return true

    const languages = [navigator.language, ...(navigator.languages ?? [])]
      .filter(Boolean)
      .map((value) => value.toLowerCase())
    if (languages.some((value) => value.startsWith('uz'))) return true

    // A phone/computer set to a non-Uzbek timezone is our signal for "probably abroad".
    return tz === ''
  } catch {
    return true
  }
}

/**
 * A learner we should push to attach a verified phone: the primary credential is a phone, and we
 * want as many learners as possible to have one. Staff are exempt (they use email/password), and
 * so is anyone we think is abroad, where Google is the reasonable primary.
 */
export function needsPhone(user: UserProfile): boolean {
  return user.role === 'Learner' && !user.phoneNumberConfirmed && isLikelyUzbekistan()
}
