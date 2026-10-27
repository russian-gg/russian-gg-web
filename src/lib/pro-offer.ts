import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useAuth } from './auth-context'
import { readFoundationLessonProgress } from './demo-lesson-one'
import { hasFoundationLesson } from './foundation-days'
import { formatPrice } from './format'
import { useLocale } from './i18n'
import type { CourseDayView, EntitlementView, PlansView, ProgressView, WelcomeGiftStatus } from './types'

export const COURSE_DAYS = 90

/** The cheapest day of Pro across the plans on sale, in tiyin. */
export function cheapestDay(plans: PlansView | undefined) {
  return (
    plans?.options.reduce<{ tiyin: number; currency: string } | null>((best, option) => {
      const tiyin = Math.max(1, Math.round(option.amountTiyin / (option.period === 'Monthly' ? 30 : 90)))
      return !best || tiyin < best.tiyin ? { tiyin, currency: option.currency } : best
    }, null) ?? null
  )
}

/**
 * Everything the standing "get Pro" surfaces need — the sidebar card, the header pill, the
 * account menu, and the Home, path and progress cards. Each reads the same cached queries the
 * rest of the app already holds, so showing them costs no extra requests once a page is up.
 */
export function useProOffer() {
  const { locale } = useLocale()
  const { user } = useAuth()
  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    staleTime: 60_000,
    retry: false,
  })
  const { data: progress } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })
  const isFree = entitlement?.hasProAccess === false
  // The paywall's own query: a learner who follows one of these links finds the prices loaded.
  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<PlansView>('/billing/plans'),
    enabled: isFree,
    staleTime: 5 * 60_000,
  })
  const { data: gift } = useQuery({
    queryKey: ['welcome-gift'],
    queryFn: () => api.get<WelcomeGiftStatus>('/billing/welcome-gift'),
    enabled: isFree,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  })

  const { data: courseMap } = useQuery({
    queryKey: ['course-map'],
    queryFn: () => api.get<CourseDayView[]>('/course/map'),
    staleTime: 60_000,
    retry: false,
  })

  const freeDays = Math.min(COURSE_DAYS, entitlement?.maxUnlockedDay ?? 1)
  const currentDay = progress?.currentDay ?? 1
  /*
    Which free days are actually finished, counted the way the course map counts them: the
    server's record, or a lesson finished in this browser that has not synced yet. The course
    day is not used — it can run ahead of what was finished, and the card then claimed three
    days done beside a map that showed one.
  */
  const freeDayDone = Array.from({ length: freeDays }, (_, index) => {
    const day = courseMap?.find((entry) => entry.day === index + 1)
    if (!day) return false
    if (day.completedMissionCount >= day.requiredMissionCount) return true
    return day.isUnlocked && hasFoundationLesson(day.day) && readFoundationLessonProgress(user?.id, day.day).isComplete
  })
  const freeDaysDone = freeDayDone.filter(Boolean).length
  const cheapest = cheapestDay(plans)
  const discountActive = Boolean(
    gift?.isDiscountActive && gift.discountPercent > 0 && gift.expiresAt && new Date(gift.expiresAt).getTime() > Date.now(),
  )

  return {
    entitlement,
    /**
     * Both the plan and the learner's day are in. Until then the free-day counts would be
     * guesses (day 1 of 1), so the surfaces wait rather than flash wrong numbers.
     */
    ready: Boolean(entitlement && progress && courseMap),
    /** One entry per free day: finished or not. */
    freeDayDone,
    /** Known to be on the free plan — false while the entitlement is still loading. */
    isFree,
    /** The whole course already open (a long gift, or a future free tier): nothing to sell. */
    hasEverything: freeDays >= COURSE_DAYS,
    freeDays,
    freeDaysDone,
    currentDay,
    perDay: cheapest ? formatPrice(cheapest.tiyin, cheapest.currency, locale) : null,
    discountPercent: discountActive ? gift!.discountPercent : null,
    /** When the paid access runs to: the trial's end while trialing, else the period's end. */
    proUntil: entitlement?.status === 'Trialing' ? entitlement.trialEndsAt : entitlement?.currentPeriodEnd,
  }
}
