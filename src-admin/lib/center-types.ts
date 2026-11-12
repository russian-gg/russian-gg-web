/*
 * Language centers (B2B). Mirrors the records in the server's CenterDirectory and
 * AdminCentersController; tiyin everywhere money appears, so divide by 100 for so'm.
 */

export type SeatStatus = 'active' | 'requested' | 'deactivated'

export type CenterPayMode = 'center' | 'student'

export type CenterStatus = 'active' | 'suspended' | 'archived'

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
  /** Student pays centers only. */
  paid: boolean | null
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

export type CenterOverview = {
  centerId: string
  name: string
  status: CenterStatus
  payMode: CenterPayMode
  pricePerSeatTiyin: number
  joinCode: string
  activeStudents: number
  requested: number
  deactivated: number
  notSignedIn: number
  weeklyActivePercent: number
  averageCourseDay: number | null
  atRisk: number
  billableThisMonth: number
  billSoFarTiyin: number
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
}

export type AdminCenterRow = {
  id: string
  name: string
  city: string | null
  status: CenterStatus
  payMode: CenterPayMode
  pricePerSeatTiyin: number
  joinCode: string
  activeStudents: number
  requested: number
  billableThisMonth: number
  billSoFarTiyin: number
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

export type CenterInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export type AdminCenterInvoice = {
  id: string
  centerId: string
  centerName: string
  month: string
  activeSeats: number
  pricePerSeatTiyin: number
  amountTiyin: number
  status: CenterInvoiceStatus
  sentAt: string | null
  paidAt: string | null
  note: string | null
}

export type AdminCenterDetail = {
  id: string
  name: string
  city: string | null
  contactName: string | null
  contactPhone: string | null
  status: CenterStatus
  payMode: CenterPayMode
  pricePerSeatTiyin: number
  joinCode: string
  contractStartsOn: string | null
  note: string | null
  createdAt: string
  admins: AdminCenterAccount[]
  invoices: AdminCenterInvoice[]
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

export const seatStatusLabel: Record<SeatStatus, string> = {
  active: 'Faol',
  requested: 'Kutilmoqda',
  deactivated: "O'chirilgan",
}

export const centerStatusLabel: Record<CenterStatus, string> = {
  active: 'Faol',
  suspended: "To'xtatilgan",
  archived: 'Arxiv',
}

export const payModeLabel: Record<CenterPayMode, string> = {
  center: "Markaz to'laydi",
  student: "O'quvchi to'laydi",
}

export const invoiceStatusLabel: Record<CenterInvoiceStatus, string> = {
  draft: 'Qoralama',
  sent: 'Yuborilgan',
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
