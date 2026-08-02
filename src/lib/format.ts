import type {
  CoursePhase,
  EntitlementView,
  FormalityLevel,
  MissionCategory,
  MissionStepKind,
  MissionTopic,
  ProficiencyLevel,
  SkillArea,
  WorkplaceAppropriateness,
} from './types'

/** Prices are stored in tiyin (1/100 UZS) and shown in whole so'm. */
export function formatPrice(tiyin: number, currency = 'UZS'): string {
  const whole = Math.round(tiyin / 100)
  return `${whole.toLocaleString('uz-UZ')} ${currency === 'UZS' ? "so'm" : currency}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export const phaseLabelUz: Record<CoursePhase, string> = {
  Foundation: 'Poydevor',
  Bridge: "Ko'prik",
  Immersion: 'Immersiya',
}

/**
 * Situation labels for the practice library. Ordered as the learner meets them: the
 * everyday errands first, then work, then the occasional ones. `Unset` is absent on
 * purpose — a mission without a situation must never be filed under an invented one.
 */
export const topicLabelUz: Record<Exclude<MissionTopic, 'Unset'>, string> = {
  Introductions: 'Tanishish',
  Shopping: "Do'kon",
  CafeRestaurant: 'Kafe va restoran',
  Taxi: 'Taksi',
  Directions: "Yo'l so'rash",
  PhoneCall: "Telefon qo'ng'irog'i",
  Pharmacy: 'Dorixona',
  Doctor: 'Shifokor',
  Gym: 'Trenirovka',
  Housing: 'Uy-joy',
  Bank: 'Bank',
  Hotel: 'Mehmonxona',
  Celebrations: 'Tug‘ilgan kun va tabriklar',
  WorkAndProfession: 'Kasb va ish',
  Delivery: 'Yetkazib berish',
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

export const categoryLabelUz: Record<MissionCategory, string> = {
  Work: 'Ish',
  DailyLife: 'Kundalik hayot',
  Social: 'Muloqot',
  StreetRussian: 'Jonli nutq',
  Repair: 'Mustahkamlash',
}

/**
 * Names the *next* step in the player's footer. Derived from the step kind rather than a
 * per-step title, so it stays honest without inventing content the editor did not write.
 */
export const stepLabelUz: Record<MissionStepKind, string> = {
  PhraseIntro: 'yangi iboralar',
  ListenAndUnderstand: 'tinglash',
  SpeakingTurn: 'javob berish',
  RolePlay: 'rol o’yini',
  Recap: 'xulosa',
}

export const skillLabelUz: Record<SkillArea, string> = {
  Listening: 'Tinglash',
  Speaking: 'Gapirish',
  Pronunciation: 'Talaffuz',
  Vocabulary: "So'z boyligi",
  Grammar: 'Grammatika',
}

export const formalityLabelUz: Record<FormalityLevel, string> = {
  Formal: 'Rasmiy',
  Neutral: 'Neytral',
  Informal: 'Norasmiy',
  Slang: 'Jargon',
}

/**
 * Every informal item carries this label. A learner must be able to see at a glance where a
 * phrase is safe to use (PRD principle 5).
 */
export const workplaceLabelUz: Record<WorkplaceAppropriateness, string> = {
  Safe: 'Ishda ishlatsa bo’ladi',
  UseWithCare: 'Ishda ehtiyot bo’ling',
  Avoid: 'Ishda ishlatmang',
}

/**
 * The learner's plan, in one short phrase. Always read off `EntitlementView` — paid state is
 * the server's answer and is never re-derived from a tier string or an expiry date here
 * (PRD §11). Returns null while the entitlement is still loading, so a caller can hold the
 * space rather than briefly claim the learner is on the free plan.
 */
export function planLabelUz(entitlement: EntitlementView | undefined | null): string | null {
  if (!entitlement) return null

  if (entitlement.status === 'PastDue') return "To'lov kutilmoqda"
  if (!entitlement.hasProAccess) return 'Bepul'
  if (entitlement.status === 'Trialing') return 'Pro · sinov'
  if (entitlement.cancelAtPeriodEnd) return 'Pro · tugaydi'

  return 'Pro'
}

export const levelDescriptionUz: Record<ProficiencyLevel, string> = {
  A0: 'Boshlang’ich',
  A1: 'Oddiy iboralar',
  A2: 'Kundalik muloqot',
  B1: 'Mustaqil muloqot',
  B2: 'Erkin muloqot',
}

/** Signed delta for a trend chip; null when there is not enough history to be honest. */
export function formatDelta(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined) return null
  if (delta === 0) return '±0'
  return delta > 0 ? `+${delta}` : `${delta}`
}
