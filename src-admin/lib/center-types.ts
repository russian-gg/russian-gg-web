/*
 * Language centers (B2B). Mirrors the records in the server's CenterDirectory and
 * AdminCentersController; tiyin everywhere money appears, so divide by 100 for so'm.
 *
 * A center pays up front, a month at a time, for its student limit. Its students have Pro while
 * the center is switched on, its contract has started, and today falls in a paid month.
 */

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
  seats: number
  pricePerSeatTiyin: number
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
  maxStudents: number
  pricePerSeatTiyin: number
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
  /** Numbers left out because the center's limit was reached. */
  overLimit: string[]
  maxStudents: number
}

export type AdminCenterRow = {
  id: string
  name: string
  city: string | null
  status: CenterStatus
  access: CenterAccess
  pricePerSeatTiyin: number
  maxStudents: number
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
  maxStudents: number
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

export const leadStatusLabel: Record<LeadStatus, string> = {
  new: 'Yangi',
  contacted: "Bog'lanildi",
  demo: "Demo o'tkazildi",
  won: 'Shartnoma',
  lost: "Yo'qotildi",
}

export const somFromTiyin = (tiyin: number) => Math.round(tiyin / 100)
