/*
 * Language centers (B2B). Mirrors the records in the server's CenterDirectory and
 * AdminCentersController; tiyin everywhere money appears, so divide by 100 for so'm.
 *
 * A center pays up front, a month at a time, for the students it has switched on. Its students
 * have Pro while the center is switched on, its contract has started, and today falls in a paid
 * month. There is no limit to buy: the bill follows the number of active students.
 */

/** What a center's students get: the full product, or the course without anything AI-run. */
export type CenterPlan = 'with_ai' | 'classroom'

export type SeatStatus = 'active' | 'requested' | 'deactivated'

export type CenterStatus = 'active' | 'suspended' | 'archived'

/** Why a center's students do or do not have Pro today. */
export type CenterAccess = 'open' | 'suspended' | 'archived' | 'not_started' | 'unpaid'

export type CenterStudent = {
  seatId: string
  userId: string | null
  name: string
  phone: string
  groupId: string | null
  groupName: string | null
  status: SeatStatus
  /** False while the phone the center added has no account behind it yet. */
  signedIn: boolean
  level: string | null
  courseDay: number | null
  streak: number
  lastActiveDate: string | null
  activeMinutes7d: number
  speakingMinutes7d: number
  missionsCompleted: number
  atRisk: boolean
  /** Optional; lets a Google or Apple sign-in claim the seat. */
  email?: string | null
  addedAt: string
}

export type CenterGroup = {
  id: string
  name: string
  level: string | null
  scheduleNote: string | null
  archived: boolean
  students: number
  activeStudents: number
  weeklyActivePercent: number
  averageCourseDay: number | null
  atRisk: number
}

export type CenterInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export type CenterInvoice = {
  id: string
  periodStart: string
  periodEnd: string
  /** Students switched on, paid for the month ahead. */
  seats: number
  /**
   * Students who joined during the previous paid month and were on no invoice. A student active
   * for one day pays that month, so they are charged here, a month late.
   */
  arrearsSeats: number
  plan: CenterPlan
  pricePerSeatTiyin: number
  /** (seats + arrearsSeats) × pricePerSeatTiyin. */
  amountTiyin: number
  status: CenterInvoiceStatus
  /** The secret in the public pay link, /pay/{token}. */
  payToken: string
  sentAt: string | null
  paidAt: string | null
  /** "click", "payme", or "admin:{login}" for a bank transfer marked by hand. */
  paidVia: string | null
  note: string | null
}

export type CenterOverview = {
  centerId: string
  name: string
  status: CenterStatus
  access: CenterAccess
  contractStartsOn: string | null
  paidThrough: string | null
  /** Today's plan, and what one student costs for one month on it. */
  plan: CenterPlan
  pricePerSeatTiyin: number
  /**
   * A plan change the center asked for while a month was already paid: it starts on
   * `pendingPlanFrom`, the day after that month ends. All three are null when nothing is waiting.
   */
  pendingPlan?: CenterPlan | null
  pendingPlanFrom?: string | null
  pendingPricePerSeatTiyin?: number | null
  joinCode: string
  activeStudents: number
  requested: number
  deactivated: number
  notSignedIn: number
  weeklyActivePercent: number
  averageCourseDay: number | null
  atRisk: number
  openInvoice: CenterInvoice | null
  groups: CenterGroup[]
  /** Whether students' read-aloud recordings are sent to the center's teacher for a mark. */
  teacherReview: boolean
  /** Recordings no teacher has marked yet. */
  recordingsWaiting: number
}

/** One dialogue line a student read aloud, and the teacher's mark once it has one. */
export type CenterRecording = {
  id: string
  seatId: string
  studentName: string
  groupName: string | null
  courseDay: number | null
  /** The line that was read, in Russian. */
  lineText: string
  /** Signed, and good for 30 minutes from the moment the list was fetched. */
  audioUrl: string
  recordedAt: string
  /** 1 to 5; null while it waits. Marking again replaces it. */
  mark: number | null
  comment: string | null
  reviewedBy: string | null
  reviewedAt: string | null
}

export type CenterStudentProfile = {
  student: CenterStudent
  placement: {
    comprehension: string | null
    speaking: string | null
    recommendedStartDay: number
    completedAt: string | null
  } | null
  skills: Array<{ skill: string; score: number; previous: number | null; measurements: number }>
  recentMissions: Array<{ title: string; courseDay: number | null; score: number | null; completedAt: string | null }>
  history: Array<{ at: string; action: string; summary: string | null }>
}

export type AddStudentsResult = {
  added: number
  alreadyHere: string[]
  inOtherCenter: string[]
  invalid: string[]
  /** Numbers left out by the 10 000-student safety ceiling. Empty in practice. */
  overLimit: string[]
}

export type AdminCenterRow = {
  id: string
  name: string
  city: string | null
  status: CenterStatus
  access: CenterAccess
  pricePerSeatTiyin: number
  plan: CenterPlan
  contractStartsOn: string | null
  paidThrough: string | null
  joinCode: string
  activeStudents: number
  requested: number
  /** What its unpaid invoices add up to. */
  openAmountTiyin: number
  overdue: boolean
  admins: string[]
  createdAt: string
}

export type AdminCenterAccount = {
  id: string
  username: string
  displayName: string
  isActive: boolean
  lastLoginAt: string | null
  /** The generated password, only while the admin has never signed in with it. */
  pendingPassword?: string | null
}

export type AdminCenterInvoice = {
  centerId: string
  centerName: string
  invoice: CenterInvoice
}

export type AdminCenterDetail = {
  id: string
  name: string
  city: string | null
  contactName: string | null
  contactPhone: string | null
  status: CenterStatus
  pricePerSeatTiyin: number
  plan: CenterPlan
  joinCode: string
  contractStartsOn: string | null
  paidThrough: string | null
  createdAt: string
  admins: AdminCenterAccount[]
  invoices: CenterInvoice[]
  overview: CenterOverview
}

export type LeadStatus = 'new' | 'contacted' | 'demo' | 'won' | 'lost'

export type AdminCenterLead = {
  id: string
  centerName: string
  city: string | null
  contactName: string
  phone: string
  studentBand: string | null
  status: LeadStatus
  note: string | null
  centerId: string | null
  createdAt: string
}

/** What a pay link shows: the month, the sum, and nothing else about the center. */
export type CenterPayView = {
  centerName: string
  periodStart: string
  periodEnd: string
  seats: number
  /** Students charged for the month before; see `CenterInvoice.arrearsSeats`. */
  arrearsSeats: number
  pricePerSeatTiyin: number
  amountTiyin: number
  status: CenterInvoiceStatus
  paidAt: string | null
  /** The rails that can take this payment: "click", "payme". */
  providers: string[]
}

export const seatStatusLabel: Record<SeatStatus, string> = {
  active: 'Faol',
  requested: 'Kutilmoqda',
  deactivated: "O'chirilgan",
}

export const centerStatusLabel: Record<CenterStatus, string> = {
  active: 'Faol',
  suspended: "O'chirilgan",
  archived: 'Arxiv',
}

export const accessLabel: Record<CenterAccess, string> = {
  open: 'Pro ochiq',
  suspended: "Markaz o'chirilgan",
  archived: 'Arxivda',
  not_started: 'Shartnoma hali boshlanmagan',
  unpaid: "To'lanmagan",
}

export const invoiceStatusLabel: Record<CenterInvoiceStatus, string> = {
  draft: 'Qoralama',
  sent: "To'lov kutilmoqda",
  paid: "To'langan",
  overdue: "Muddati o'tgan",
  cancelled: 'Bekor qilingan',
}

/**
 * The two plans as they are sold: the name, the list price a switch uses, and what a center is
 * told it gets. One table, so the team's form and the center's own page never disagree.
 */
export const centerPlans: Record<CenterPlan, { label: string; listPriceSom: number; features: string[] }> = {
  with_ai: {
    label: 'AI bilan',
    listPriceSom: 99_000,
    features: [
      '90 kunlik kurs, barcha darslar va testlar',
      'AI bilan jonli suhbatlar',
      'Javob va talaffuzni AI baholaydi',
      "Barcha o'yinlar",
    ],
  },
  classroom: {
    label: 'Sinf',
    listPriceSom: 49_000,
    features: [
      '90 kunlik kurs, barcha darslar va testlar',
      'Dialog ustaxonasi va interaktiv hikoyalar',
      "Javoblar aniq qoidalar bo'yicha tekshiriladi",
      "Sun'iy intellekt ishlatilmaydi",
    ],
  },
}

export const centerPlanIds = Object.keys(centerPlans) as CenterPlan[]

export const leadStatusLabel: Record<LeadStatus, string> = {
  new: 'Yangi',
  contacted: "Bog'lanildi",
  demo: "Demo o'tkazildi",
  won: 'Shartnoma',
  lost: "Yo'qotildi",
}

export const somFromTiyin = (tiyin: number) => Math.round(tiyin / 100)
