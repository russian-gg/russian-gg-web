import type {
  CoursePhase,
  FormalityLevel,
  MissionCategory,
  MissionStepKind,
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
