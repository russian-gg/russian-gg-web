export type KeyValue = { label: string; value: number }
export type SeriesPoint = { date: string; value: number }
export type CostPoint = { date: string; value: number }

export type Paged<T> = { items: T[]; total: number }

export type Dashboard = {
  days: number
  audience: { totalUsers: number; newUsers: number; dau: number; wau: number; mau: number }
  /*
   * Optional, not just nullable. The API omits a null rather than sending one, so an
   * unmeasured cohort arrives as a missing key — code that only checks `=== null` walks
   * straight past it and formats `undefined`.
   */
  retention: { day?: number | null; week?: number | null; month?: number | null }
  userGrowth: SeriesPoint[]
  money: { revenue: number; currency: string; paidTransactions: number }
  transactions: SeriesPoint[]
  plans: KeyValue[]
  /** Ordered A0→B2 then "Aniqlanmagan". A level scale, so never re-sorted by size. */
  levels: KeyValue[]
  environment: string
}

export type Audience = {
  totalUsers: number
  levels: KeyValue[]
  languages: KeyValue[]
  plans: KeyValue[]
  signupMethods: KeyValue[]
  coursePhases: KeyValue[]
}

export type Clicks = { days: number; totalEvents: number; events: KeyValue[] }

export type AiCall = {
  id: string
  occurredAt: string
  provider: string
  operation: string
  model?: string | null
  isSuccess: boolean
  errorCode?: string | null
  /** Absent when the provider reported no usage — see the note on `retention` above. */
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  costUsd?: number | null
  durationMs: number
}

export type AiUsage = {
  days: number
  totalCalls: number
  succeeded: number
  failed: number
  totalTokens: number
  totalCostUsd: number
  aiCallCostUsd: number
  liveVoiceCostUsd: number
  costByDay: CostPoint[]
  byProvider: KeyValue[]
  byOperation: KeyValue[]
  userSummary: {
    activeUsers: number
    activeProUsers: number
    totalLiveVoiceSeconds: number
    averageCostPerActiveUserDayUsd: number
    projectedMonthlyCostPerActiveUserUsd: number
    averageCostPerProUserDayUsd: number
    projectedMonthlyCostPerProUserUsd: number
  }
  userCosts: Array<{
    userId: string
    displayName?: string | null
    email: string
    plan: string
    activeDays: number
    aiCallCount: number
    totalTokens: number
    liveVoiceSeconds: number
    aiCallCostUsd: number
    liveVoiceCostUsd: number
    totalEstimatedCostUsd: number
    averagePerActiveDayUsd: number
    projectedMonthlyCostUsd: number
  }>
  items: AiCall[]
}

export type UserItem = {
  id: string
  displayName?: string | null
  email: string
  phoneNumber?: string | null
  uiLanguage: string
  timeZoneId: string
  plan: string
  lastLoginAt?: string | null
  createdAt: string
  completedMissions: number
  /** Absent when nobody has measured it — not the A0 an enrollment starts on. */
  speakingLevel?: string | null
  currentDay?: number | null
}

export type UserDetail = UserItem & {
  role: string
  currentDay?: number | null
  recommendedStartDay?: number | null
  recentMissions: Array<{
    id: string
    missionId: string
    status: string
    overallScore?: number | null
    createdAt: string
    completedAt?: string | null
  }>
  speakingLevel?: string | null
  comprehensionLevel?: string | null
}

export type Transaction = {
  id: string
  displayName?: string | null
  email?: string | null
  amount: number
  currency: string
  period: string
  status: string
  provider: string
  createdAt: string
  paidAt?: string | null
}

export type FeedbackItem = {
  id: string
  userId: string
  displayName?: string | null
  email: string
  source: string
  issueType: string
  title: string
  message: string
  attachmentName?: string | null
  attachmentUrl?: string | null
  createdAt: string
}
