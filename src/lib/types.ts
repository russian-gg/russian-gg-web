/**
 * Mirrors the server contracts in RussianGg.Application/Contracts. Enums travel as names,
 * so these are string unions rather than numbers.
 */

export type ProficiencyLevel = 'A0' | 'A1' | 'A2' | 'B1' | 'B2'
export type CoursePhase = 'Foundation' | 'Bridge' | 'Immersion'
export type LanguagePolicy = 'UzbekLed' | 'Balanced' | 'RussianFirst'
export type MissionCategory = 'Work' | 'DailyLife' | 'Social' | 'StreetRussian' | 'Repair'
export type SkillArea = 'Listening' | 'Speaking' | 'Pronunciation' | 'Vocabulary' | 'Grammar'
export type LearningGoal = 'Work' | 'DailyLife' | 'Both'
export type MissionStepKind =
  | 'PhraseIntro'
  | 'ListenAndUnderstand'
  | 'SpeakingTurn'
  | 'RolePlay'
  | 'Recap'
export type FormalityLevel = 'Formal' | 'Neutral' | 'Informal' | 'Slang'
export type WorkplaceAppropriateness = 'Safe' | 'UseWithCare' | 'Avoid'
export type DiagnosticItemKind = 'Listening' | 'Vocabulary' | 'Speaking'
export type UserRole = 'Learner' | 'ContentEditor' | 'Support' | 'Administrator'
export type PlanTier = 'Free' | 'Pro'
export type BillingPeriod = 'Monthly' | 'NinetyDay'
export type SubscriptionStatus =
  | 'None'
  | 'Trialing'
  | 'Active'
  | 'PastDue'
  | 'Cancelled'
  | 'Expired'
export type ContentReviewStatus =
  | 'Draft'
  | 'InReview'
  | 'ChangesRequested'
  | 'Approved'
  | 'Published'
  | 'Archived'
export type ConsentKind =
  | 'AudioRetention'
  | 'AudioHumanReview'
  | 'ProductReminders'
  | 'ProductAnalytics'

export interface UserProfile {
  id: string
  email: string
  displayName?: string | null
  role: UserRole
  uiLanguage: string
  timeZoneId: string
  hasCompletedDiagnostic: boolean
  tier: PlanTier
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
  user: UserProfile
}

export interface ConsentState {
  kind: ConsentKind
  granted: boolean
  recordedAt: string
  policyVersion: string
}

export interface DiagnosticItemView {
  code: string
  kind: DiagnosticItemKind
  promptRu: string
  promptUz?: string | null
  options: string[]
  isOptional: boolean
  audioUrl?: string | null
}

export interface DiagnosticSession {
  attemptId: string
  items: DiagnosticItemView[]
}

export interface DiagnosticAnswer {
  itemCode: string
  selectedOption?: string | null
  spokenTranscript?: string | null
  skipped: boolean
}

export interface DiagnosticResult {
  comprehension: ProficiencyLevel
  speaking: ProficiencyLevel
  recommendedStartDay: number
  startPhase: CoursePhase
  summaryUz: string
  firstMissionId: string
  firstMissionTitleUz: string
}

export interface MissionSummary {
  id: string
  slug: string
  titleUz: string
  titleRu: string
  objectiveUz: string
  category: MissionCategory
  phase: CoursePhase
  courseDay?: number | null
  estimatedMinutes: number
  targetLevel: ProficiencyLevel
  formality: FormalityLevel
  workplaceUse: WorkplaceAppropriateness
  isLocked: boolean
  lockReason?: string | null
  isCompleted: boolean
}

export interface TargetPhraseView {
  order: number
  russian: string
  transliteration?: string | null
  uzbekMeaning: string
  usageNoteUz?: string | null
  formality: FormalityLevel
  workplaceUse: WorkplaceAppropriateness
  audioUrl?: string | null
}

export interface MissionStepView {
  order: number
  kind: MissionStepKind
  promptRu: string
  promptUz?: string | null
  requiresVoice: boolean
  tutorInstruction?: string | null
  acceptedAnswers: string[]
  rubric?: string | null
}

export interface MissionDetail {
  summary: MissionSummary
  objectiveRu: string
  usageNoteUz?: string | null
  maxVoiceMinutes: number
  targetPhrases: TargetPhraseView[]
  steps: MissionStepView[]
}

export interface StartAttemptResponse {
  attemptId: string
  missionId: string
  currentStepIndex: number
  totalSteps: number
  isResumed: boolean
}

export interface TurnFeedback {
  turnIndex: number
  score: number
  strengthNote: string
  headlineCorrection: string
  canAdvance: boolean
  nextStepIndex: number
}

export interface TurnDetail {
  stepIndex: number
  turnIndex: number
  learnerTranscript?: string | null
  score?: number | null
  pronunciationNote?: string | null
  wordChoiceNote?: string | null
  grammarNote?: string | null
  wasRetry: boolean
}

export interface MilestoneView {
  slug: string
  day: number
  titleUz: string
  titleRu: string
  outcomeUz: string
  isCompleted: boolean
  completedAt?: string | null
  daysRemaining: number
}

export interface MissionResult {
  attemptId: string
  overallScore: number
  strengthNoteUz: string
  headlineFeedbackUz: string
  headlineFeedbackRu: string
  skillScores: Partial<Record<SkillArea, number>>
  turns: TurnDetail[]
  newCurrentDay?: number | null
  unlockedMilestone?: MilestoneView | null
  enrichmentPending: boolean
}

export interface RepairSuggestion {
  id: string
  skill: SkillArea
  gapCode: string
  reasonUz: string
  missionId?: string | null
  missionTitleUz?: string | null
  evidenceCount: number
}

export interface HomeView {
  currentDay: number
  phase: CoursePhase
  languagePolicy: LanguagePolicy
  dayFocusUz: string
  todayMission?: MissionSummary | null
  nextMilestone?: MilestoneView | null
  speakingConfidence?: number | null
  speakingConfidenceDelta30d?: number | null
  skills: Partial<Record<SkillArea, number | null>>
  streakDays: number
  completedMissionsThisWeek: number
  tier: PlanTier
  practiceForToday: MissionSummary[]
  repairs: RepairSuggestion[]
}

export interface CourseDayView {
  day: number
  phase: CoursePhase
  focusUz: string
  focusRu: string
  requiredMissionCount: number
  completedMissionCount: number
  isUnlocked: boolean
  isFreePreview: boolean
}

export interface ProgressView {
  currentDay: number
  phase: CoursePhase
  comprehensionLevel: ProficiencyLevel
  speakingLevel: ProficiencyLevel
  confidenceIndex?: number | null
  confidenceDelta30d?: number | null
  skills: Partial<Record<SkillArea, number | null>>
  skillDeltas30d: Partial<Record<SkillArea, number | null>>
  milestones: MilestoneView[]
  totalMissionsCompleted: number
  streakDays: number
  repairs: RepairSuggestion[]
}

export interface VoiceSessionTicket {
  sessionId: string
  token: string
  connectUrl: string
  model: string
  expiresAt: string
  maxDurationSeconds: number
  resumeStepIndex: number
  languagePolicy: LanguagePolicy
}

export interface VoiceUnavailable {
  reason: string
  messageUz: string
  fallbackMode: string
}

export interface VoiceSessionOutcome {
  ticket?: VoiceSessionTicket | null
  unavailable?: VoiceUnavailable | null
  isAvailable: boolean
}

export interface PlanOption {
  period: BillingPeriod
  amountTiyin: number
  currency: string
  effectiveMonthlyTiyin: number
  savingsPercent: number
  labelUz: string
  labelRu: string
}

export interface PlansView {
  options: PlanOption[]
  trialDays: number
  trialAvailable: boolean
  proBenefitsUz: string[]
  freeLimitsUz: string[]
}

export interface EntitlementView {
  tier: PlanTier
  status: SubscriptionStatus
  hasProAccess: boolean
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
  graceEndsAt?: string | null
  cancelAtPeriodEnd: boolean
  maxUnlockedDay: number
  paymentProcessing: boolean
}

export interface CheckoutResponse {
  invoiceId: string
  checkoutUrl: string
  merchantTransId: string
  amountTiyin: number
}

export interface SubscriptionActionResponse {
  entitlement: EntitlementView
  messageUz: string
}

export interface MissionReviewView {
  id: string
  slug: string
  version: number
  titleRu: string
  category: MissionCategory
  courseDay?: number | null
  status: ContentReviewStatus
  formality: FormalityLevel
  workplaceUse: WorkplaceAppropriateness
  hasUsageNote: boolean
  targetPhraseCount: number
  stepCount: number
  updatedAt: string
}

export interface ContentReviewView {
  reviewerUserId: string
  fromStatus: ContentReviewStatus
  toStatus: ContentReviewStatus
  comment?: string | null
  wasAiDrafted: boolean
  decidedAt: string
}

export interface OperationsView {
  pendingJobs: number
  deadLetteredJobs: number
  unreconciledPaymentEvents: number
  missionsAwaitingReview: number
  activeVoiceSessions: number
  voiceProviderHealthy: boolean
}

export interface ApiError {
  code: string
  message: string
}
