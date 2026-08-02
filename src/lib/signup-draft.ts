import type { DiagnosticAnswer, DiagnosticItemView, LearningGoal } from './types'

const SIGNUP_DRAFT_KEY = 'rgg.signup-draft'
const ONBOARDING_DRAFT_KEY = 'rgg.onboarding-draft'

export type SignupDraft =
  | {
      kind: 'email'
      email: string
      password: string
      displayName?: string
    }
  | {
      kind: 'google'
      credential: string
      displayName?: string
    }

export interface OnboardingDraft {
  clientAttemptId: string
  goal: LearningGoal
  selfRatedComprehension: number
  selfRatedSpeaking: number
  items: DiagnosticItemView[]
  answers: DiagnosticAnswer[]
}

export const signupDraftStore = {
  get(): SignupDraft | null {
    return readJson<SignupDraft>(SIGNUP_DRAFT_KEY)
  },
  set(value: SignupDraft) {
    sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(value))
  },
  clear() {
    sessionStorage.removeItem(SIGNUP_DRAFT_KEY)
  },
}

export const onboardingDraftStore = {
  get(): OnboardingDraft | null {
    return readJson<OnboardingDraft>(ONBOARDING_DRAFT_KEY)
  },
  set(value: OnboardingDraft) {
    sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(value))
  },
  clear() {
    sessionStorage.removeItem(ONBOARDING_DRAFT_KEY)
  },
}

function readJson<T>(key: string): T | null {
  const raw = sessionStorage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    sessionStorage.removeItem(key)
    return null
  }
}
