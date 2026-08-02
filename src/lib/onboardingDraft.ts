import type { DiagnosticAnswer, LearningGoal } from './types'

const KEY = 'rgg.onboarding.draft'

/**
 * A placement run taken before the learner has an account. It is held only for the hop
 * through sign-up — sessionStorage, so it dies with the tab and never becomes a second,
 * stale source of truth next to the server's attempt.
 */
export interface OnboardingDraft {
  goal: LearningGoal
  selfRatedComprehension: number
  selfRatedSpeaking: number
  answers: DiagnosticAnswer[]
}

export const onboardingDraft = {
  save(draft: OnboardingDraft) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(draft))
    } catch {
      // A private-mode storage failure must not lose the learner their answers mid-flow;
      // the caller keeps them in component state either way.
    }
  },

  read(): OnboardingDraft | null {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as OnboardingDraft
      return Array.isArray(parsed.answers) && parsed.goal ? parsed : null
    } catch {
      return null
    }
  },

  exists: () => sessionStorage.getItem(KEY) !== null,

  clear() {
    sessionStorage.removeItem(KEY)
  },
}
