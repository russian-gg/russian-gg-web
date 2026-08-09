export type KeyValue = { label: string; value: number }
export type SeriesPoint = { date: string; value: number }
export type CostPoint = { date: string; value: number }
export type BillingPeriod = 'Monthly' | 'NinetyDay'
export type PromoDiscountType = 'Percentage' | 'FixedAmount'

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
  /** The half of the funnel that happens before an account exists. */
  visits: {
    uniqueVisitors: number
    visits: number
    /** Absent until visit counting is older than the window being divided over. */
    signupRate?: number | null
    countingSince?: string | null
  }
  visitorSeries: SeriesPoint[]
  trafficSources: KeyValue[]
  /** Operating system and browser, by visitor. In-app webviews are named, not folded in. */
  platforms: KeyValue[]
  browsers: KeyValue[]
  /**
   * The app on people's home screens. Counted by it being opened rather than by the browser's
   * install event, which iOS does not send at all.
   */
  installs: {
    /** Devices that have ever opened it installed. All time, not the window. */
    devices: number
    /** Of those, the ones first seen installed inside the window. */
    newDevices: number
    launches: number
    /** Absent where nobody visited — a rate over nobody is not zero. */
    shareOfVisitors?: number | null
  }
  installSeries: SeriesPoint[]
  installPlatforms: KeyValue[]
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
  costByDay: CostPoint[]
  byProvider: KeyValue[]
  byOperation: KeyValue[]
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
  device: string
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
  device: string
}

export type Transaction = {
  id: string
  displayName?: string | null
  email?: string | null
  amount: number
  originalAmount: number
  discountAmount: number
  promoCode?: string | null
  currency: string
  period: string
  status: string
  provider: string
  createdAt: string
  paidAt?: string | null
}

export type AdminPromoCode = {
  id: string
  code: string
  period: BillingPeriod
  discountType: PromoDiscountType
  percentOff?: number | null
  amountOffTiyin?: number | null
  validFrom: string
  validUntil: string
  isActive: boolean
  usageCount: number
  createdAt: string
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

export type MarketingStatus = 'Proposed' | 'Accepted' | 'Executed' | 'Reviewed' | 'Dismissed'
export type MarketingCategory =
  | 'Ugc'
  | 'Content'
  | 'Paid'
  | 'Product'
  | 'Retention'
  | 'Pricing'
  | 'Partnership'
export type MarketingEffort = 'Low' | 'Medium' | 'High'
export type MarketingDirection = 'Up' | 'Down' | 'Flat'
export type MarketingMetric =
  | 'TotalUsers'
  | 'NewUsers'
  | 'Dau'
  | 'Wau'
  | 'Mau'
  | 'DayRetention'
  | 'WeekRetention'
  | 'MonthRetention'
  | 'PaidUsers'
  | 'RevenueUzs'
  | 'PaidTransactions'
  | 'CompletedMissions'
  | 'SalesConversations'
  | 'SalesConversions'

export type MarketingPlanSummary = {
  id: string
  weekNumber: number
  status: MarketingStatus
  headlineUz: string
  initiativeCount: number
  generatedAt: string
  executedAt?: string | null
  reviewDueAt?: string | null
  reviewedAt?: string | null
}

export type MarketingExpectation = {
  metric: MarketingMetric
  baselineValue: number
  expectedValue: number
  direction: MarketingDirection
  confidence: number
  /** Absent until the week has been measured — never zero for "not yet". */
  measuredValue?: number | null
}

export type MarketingInitiative = {
  id: string
  category: MarketingCategory
  priority: number
  titleUz: string
  actionUz: string
  rationaleUz: string
  launchOn: string
  effort: MarketingEffort
  expectations: MarketingExpectation[]
}

export type MarketingPlan = {
  id: string
  weekNumber: number
  status: MarketingStatus
  headlineUz: string
  situationUz: string
  modelName: string
  generatedAt: string
  acceptedAt?: string | null
  executedAt?: string | null
  reviewDueAt?: string | null
  reviewedAt?: string | null
  reviewUz?: string | null
  initiatives: MarketingInitiative[]
}

export type MarketingStepState = 'Pending' | 'Active' | 'Done' | 'Failed'
export type MarketingRunState = 'Running' | 'Completed' | 'Failed'

export type MarketingRunStep = {
  key: string
  titleUz: string
  state: MarketingStepState
  /** What the step is doing right now, where it has something true to say. */
  detail?: string | null
}

export type MarketingRun = {
  id: string
  state: MarketingRunState
  steps: MarketingRunStep[]
  planId?: string | null
  error?: string | null
  startedAt: string
}

export type ChatSender = 'User' | 'Ai' | 'Admin'
export type SalesUserStatus =
  | 'Unregistered'
  | 'Registered'
  | 'DroppedAtPaywall'
  | 'AbandonedCheckout'
  | 'Trialing'
  | 'TrialExpired'
  | 'Paid'

export type SalesChatSummary = {
  id: string
  chatId: number
  displayName: string
  username?: string | null
  userId?: string | null
  status: SalesUserStatus
  aiAutoReply: boolean
  lastMessage?: string | null
  lastMessageFromUser: boolean
  lastInteractionAt: string
  messageCount: number
  /** 0-100, or absent where nothing has judged it yet. Absent is not zero. */
  readiness?: number | null
  readinessSignal?: string | null
  /** Customer messages since an operator last had this chat open. */
  unread: number
}

export type SalesUnread = {
  /** Conversations with something waiting — what the tab badge shows. */
  chats: number
  messages: number
}

export type SalesMessage = {
  id: string
  sender: ChatSender
  text: string
  occurredAt: string
}

export type SalesUserCard = {
  userId?: string | null
  email?: string | null
  status: SalesUserStatus
  registeredAt?: string | null
  lastActiveAt?: string | null
  completedLessons: number
  currentDay: number
  speakingLevel?: string | null
  triggerEvents: KeyValue[]
}

export type SalesChat = {
  chat: SalesChatSummary
  user: SalesUserCard
  messages: SalesMessage[]
}

export type SalesSettings = {
  systemPrompt: string
  isEnabled: boolean
  updatedAt: string
  botConfigured: boolean
  /** Last four characters only — the panel cannot read a token back out. */
  botTokenHint?: string | null
  botUsername?: string | null
  webhookUrl?: string | null
  webhookRegistered: boolean
  webhookLastError?: string | null
  webhookPendingUpdates: number
  /** What a fresh install starts with, so the panel can offer it back. */
  defaultPrompt: string
}

export type SalesDashboard = {
  days: number
  totalChats: number
  newChats: number
  activeChats: number
  customerMessages: number
  agentMessages: number
  operatorMessages: number
  handedOverChats: number
  /** Absent until something has been answered — never zero for "nothing yet". */
  averageReplySeconds?: number | null
  linkedChats: number
  convertedChats: number
  readinessBands: KeyValue[]
  statuses: KeyValue[]
  messagesByDay: KeyValue[]
  aiCalls: number
  aiFailures: number
  aiTokens: number
}
