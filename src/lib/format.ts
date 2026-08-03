import type { Dictionary, Locale } from './i18n'
import type { EntitlementView, MissionTopic } from './types'

/** Prices are stored in tiyin (1/100 UZS) and shown in whole so'm. */
export function formatPrice(tiyin: number, currency = 'UZS', locale: Locale = 'uz'): string {
  const whole = Math.round(tiyin / 100)
  const suffix = currency === 'UZS' ? { uz: "so'm", ru: 'сум', en: 'UZS' }[locale] : currency
  return `${whole.toLocaleString(INTL_TAG[locale])} ${suffix}`
}

const INTL_TAG: Record<Locale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' }

export function formatDate(iso: string | null | undefined, locale: Locale = 'uz'): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(INTL_TAG[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** The order situation chips appear in. Anything missing here sorts to the end. */
export const TOPIC_ORDER: Array<Exclude<MissionTopic, 'Unset'>> = [
  'Introductions',
  'Shopping',
  'CafeRestaurant',
  'Taxi',
  'Directions',
  'PhoneCall',
  'Pharmacy',
  'Doctor',
  'Gym',
  'Housing',
  'Bank',
  'Hotel',
  'Celebrations',
  'WorkAndProfession',
  'Delivery',
]

/**
 * The learner's plan, in one short phrase. Always read off `EntitlementView` — paid state is
 * the server's answer and is never re-derived from a tier string or an expiry date here
 * (PRD §11). Returns null while the entitlement is still loading, so a caller can hold the
 * space rather than briefly claim the learner is on the free plan.
 */
export function planLabel(
  entitlement: EntitlementView | undefined | null,
  t: Dictionary,
): string | null {
  if (!entitlement) return null

  if (entitlement.status === 'PastDue') return t.account.plan.pastDue
  if (!entitlement.hasProAccess) return t.account.plan.free
  if (entitlement.status === 'Trialing') return t.account.plan.trial
  if (entitlement.cancelAtPeriodEnd) return t.account.plan.ending

  return t.account.plan.pro
}

/** Signed delta for a trend chip; null when there is not enough history to be honest. */
export function formatDelta(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined) return null
  if (delta === 0) return '\u00b10'
  return delta > 0 ? `+${delta}` : `${delta}`
}
