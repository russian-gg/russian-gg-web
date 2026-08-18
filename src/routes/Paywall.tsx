import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, RequestError, track } from '../lib/api'
import { formatDate, formatPrice } from '../lib/format'
import { fill, useLocale, useT } from '../lib/i18n'
import type {
  BillingPeriod,
  CheckoutResponse,
  EntitlementView,
  PlansView,
  PromoCodePreview,
  SubscriptionActionResponse,
  WelcomeGiftStatus,
} from '../lib/types'
import { Badge, Button, Card, ErrorNote, SectionHeading, Spinner, UzHint } from '../components/ui'

const promoCelebrationPieces = Array.from({ length: 26 }, (_, index) => ({
  id: index,
  left: `${4 + ((index * 11) % 92)}%`,
  delay: `${(index % 6) * 0.12}s`,
  duration: `${2.4 + (index % 5) * 0.25}s`,
  size: 8 + (index % 4) * 4,
  rotate: (index % 2 === 0 ? 1 : -1) * (18 + index * 7),
  color:
    index % 4 === 0
      ? '#f7b500'
      : index % 4 === 1
        ? '#60a5fa'
        : index % 4 === 2
          ? '#34d399'
          : '#fb7185',
}))

function daysForPeriod(period: BillingPeriod) {
  return period === 'Monthly' ? 30 : 90
}

function monthsForPeriod(period: BillingPeriod) {
  return period === 'Monthly' ? 1 : 3
}

function perDayAmountTiyin(amountTiyin: number, period: BillingPeriod) {
  return Math.max(1, Math.round(amountTiyin / daysForPeriod(period)))
}

function perMonthAmountTiyin(amountTiyin: number, period: BillingPeriod) {
  return Math.max(1, Math.round(amountTiyin / monthsForPeriod(period)))
}

const futureListPriceTiyin: Partial<Record<BillingPeriod, number>> = {
  Monthly: 11_900_000,
  NinetyDay: 29_900_000,
}

export function Paywall() {
  const t = useT()
  const { locale } = useLocale()
  const [period, setPeriod] = useState<BillingPeriod>('NinetyDay')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null)
  const [promoPreview, setPromoPreview] = useState<PromoCodePreview | null>(null)
  const [showPromoCelebration, setShowPromoCelebration] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<PlansView>('/billing/plans'),
  })

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  const { data: welcomeGift } = useQuery({
    queryKey: ['welcome-gift'],
    queryFn: () => api.get<WelcomeGiftStatus>('/billing/welcome-gift'),
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!welcomeGift?.isDiscountActive || !welcomeGift.expiresAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [welcomeGift?.expiresAt, welcomeGift?.isDiscountActive])

  useEffect(() => {
    setPromoPreview(null)
    setPromoFeedback(null)
  }, [period])

  useEffect(() => {
    if (!showPromoCelebration) return

    const timer = window.setTimeout(() => setShowPromoCelebration(false), 2600)
    return () => window.clearTimeout(timer)
  }, [showPromoCelebration])

  if (isLoading || !plans) return <Spinner />

  async function checkout() {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<CheckoutResponse>('/billing/checkout', {
        period,
        returnUrl: `${window.location.origin}/billing/return`,
        promoCode: giftApplies ? undefined : promoPreview?.isValid ? promoPreview.code : undefined,
      })
      track('checkout_started', { period })
      window.location.href = result.checkoutUrl
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.billing.checkoutFailed)
      setBusy(false)
    }
  }

  async function applyPromoCode() {
    setPromoBusy(true)
    setPromoFeedback(null)
    setPromoPreview(null)

    try {
      const result = await api.post<PromoCodePreview>('/billing/promo/preview', {
        period,
        code: promoCode,
      })

      setPromoPreview(result)
      setPromoFeedback(result.message ?? (result.isValid ? t.billing.promoApplied : null))
      setShowPromoCelebration(result.isValid)
    } catch (caught) {
      setPromoFeedback(caught instanceof RequestError ? caught.message : t.billing.checkoutFailed)
    } finally {
      setPromoBusy(false)
    }
  }

  const selected = plans.options.find((option) => option.period === period) ?? plans.options[0]
  const giftSecondsRemaining = welcomeGift?.expiresAt
    ? Math.max(0, Math.ceil((new Date(welcomeGift.expiresAt).getTime() - now) / 1000))
    : 0
  const giftActive = Boolean(
    welcomeGift?.isDiscountActive && welcomeGift.discountPercent > 0 && giftSecondsRemaining > 0,
  )
  const giftApplies = giftActive && period === 'NinetyDay'
  const giftDiscountAmount = giftApplies
    ? Math.floor((selected.amountTiyin * welcomeGift!.discountPercent) / 100)
    : 0
  const giftFinalAmount = selected.amountTiyin - giftDiscountAmount
  const amountToPay = giftApplies
    ? giftFinalAmount
    : promoPreview?.isValid
      ? promoPreview.finalAmountTiyin
      : selected.amountTiyin
  const promoPercent =
    promoPreview?.isValid && promoPreview.originalAmountTiyin > 0
      ? Math.max(1, Math.round((promoPreview.discountAmountTiyin / promoPreview.originalAmountTiyin) * 100))
      : 0

  return (
    <div className="space-y-8">
      {showPromoCelebration && promoPreview?.isValid && (
        <PromoCelebration
          discountAmount={formatPrice(promoPreview.discountAmountTiyin, promoPreview.currency, locale)}
          title={t.billing.promoApplied}
          percentLabel={fill(t.billing.promoPercent, { percent: promoPercent })}
          body={fill(t.billing.promoCelebrationBody, {
            amount: formatPrice(promoPreview.discountAmountTiyin, promoPreview.currency, locale),
          })}
        />
      )}

      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.billing.title}</h1>
        <p className="text-support mt-1">
          {t.billing.subtitle}
        </p>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      {giftActive && (
        <div className="rounded-[var(--radius-card)] border border-amber-300 bg-gradient-to-r from-amber-50 to-blue-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="milestone">
                {fill(t.welcomeGift.discountPrize, { percent: welcomeGift!.discountPercent })}
              </Badge>
            </div>
            <span className="text-3xl" aria-hidden="true">🎁</span>
          </div>
        </div>
      )}

      {entitlement?.paymentProcessing && (
        <Card>
          <Badge tone="caution">{t.billing.processing}</Badge>
          <p className="mt-3 text-base text-ink">
            {t.billing.processingBody}
          </p>
        </Card>
      )}

      {entitlement?.hasProAccess ? (
        <ActiveSubscription entitlement={entitlement} />
      ) : (
        <>
          <div className="space-y-3">
            {plans.options.map((option) => (
              (() => {
                const giftDiscounted = giftActive && option.period === 'NinetyDay'
                const promoDiscounted = promoPreview?.isValid && promoPreview.period === option.period
                const discounted = giftDiscounted || promoDiscounted
                const discountPercent = giftDiscounted ? welcomeGift!.discountPercent : promoPercent
                const discountedAmount = giftDiscounted
                  ? option.amountTiyin - Math.floor((option.amountTiyin * welcomeGift!.discountPercent) / 100)
                  : promoDiscounted
                    ? promoPreview.finalAmountTiyin
                    : option.amountTiyin
                const shownAmount = discountedAmount
                const shownCurrency = promoDiscounted && !giftDiscounted ? promoPreview.currency : option.currency
                const futurePrice = futureListPriceTiyin[option.period]
                const perDayPrice = formatPrice(
                  perDayAmountTiyin(shownAmount, option.period),
                  shownCurrency,
                  locale,
                )
                const currentPrice = formatPrice(option.amountTiyin, option.currency, locale)
                const futurePriceText = futurePrice
                  ? formatPrice(futurePrice, option.currency, locale)
                  : null

                return (
                  <button
                    key={option.period}
                    type="button"
                    aria-pressed={period === option.period}
                    onClick={() => setPeriod(option.period)}
                    className={`w-full rounded-[var(--radius-card)] border p-5 text-left transition ${
                      period === option.period
                        ? 'border-signal bg-signal-soft'
                        : 'border-hairline bg-ground-raised'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-base font-semibold text-ink">{t.billing.periodLabel[option.period]}</span>
                      {option.savingsPercent > 0 && (
                        <Badge tone="milestone">{fill(t.billing.savings, { percent: option.savingsPercent })}</Badge>
                      )}
                    </div>
                    {discounted ? (
                      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                        <p className="text-base font-semibold text-ink-muted line-through decoration-2">
                          {formatPrice(option.amountTiyin, option.currency, locale)}
                        </p>
                        <p className="text-2xl font-semibold tracking-tight text-ink">
                          {formatPrice(discountedAmount, shownCurrency, locale)}
                        </p>
                        <Badge tone="signal">{fill(t.billing.promoPercent, { percent: discountPercent })}</Badge>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                          {futurePriceText ? (
                            <span className="text-base font-semibold text-ink-muted line-through decoration-2">
                              {futurePriceText}
                            </span>
                          ) : null}
                          <span className="text-2xl font-semibold tracking-tight text-ink">{currentPrice}</span>
                        </div>
                        <div className="mt-4 border-t border-hairline pt-4">
                          <div className="flex flex-wrap items-end gap-x-1 gap-y-1">
                            <span className="text-3xl font-extrabold tracking-tight text-ink">{perDayPrice}</span>
                            <span className="pb-1 text-lg font-semibold text-ink-muted">/kun</span>
                          </div>
                          {futurePrice !== undefined ? (
                            <div className="mt-1 text-base font-semibold text-ink-faint line-through decoration-2">
                              {formatPrice(
                                perDayAmountTiyin(futurePrice, option.period),
                                option.currency,
                                locale,
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                    <div className="mt-1 space-y-0.5 text-support">
                      {option.period === 'NinetyDay' && (
                        <p>
                          {fill(t.billing.perMonth, {
                            amount: formatPrice(perMonthAmountTiyin(shownAmount, option.period), shownCurrency, locale),
                          })}
                        </p>
                      )}
                      <p>
                        {fill(t.billing.perDay, {
                          amount: formatPrice(perDayAmountTiyin(shownAmount, option.period), shownCurrency, locale),
                        })}
                      </p>
                    </div>
                  </button>
                )
              })()
            ))}
          </div>

          {!giftActive && <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="mb-1.5 block text-sm font-bold text-ink">{t.billing.promoTitle}</span>
                <input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                  placeholder={t.billing.promoPlaceholder}
                  className="h-11 w-full rounded-[var(--radius-control)] border-2 border-hairline bg-ground-raised px-4 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
                />
              </label>
              <Button variant="secondary" disabled={promoBusy} onClick={() => void applyPromoCode()}>
                {promoBusy ? t.billing.opening : t.billing.promoApply}
              </Button>
            </div>

            {promoFeedback && (
              <p className={`mt-3 text-sm ${promoPreview?.isValid ? 'text-milestone' : 'text-ink-muted'}`}>{promoFeedback}</p>
            )}

            {promoPreview?.isValid && (
              <div className="mt-4 rounded-[var(--radius-card)] border border-signal/30 bg-signal-soft/60 p-4 text-sm text-ink">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="signal">{fill(t.billing.promoPercent, { percent: promoPercent })}</Badge>
                  <span className="font-semibold text-ink">{promoPreview.code}</span>
                </div>
                <div>{fill(t.billing.promoDiscount, { amount: formatPrice(promoPreview.discountAmountTiyin, promoPreview.currency, locale) })}</div>
                <div className="font-bold">
                  {fill(t.billing.promoFinal, { amount: formatPrice(promoPreview.finalAmountTiyin, promoPreview.currency, locale) })}
                </div>
              </div>
            )}
          </Card>}

          {!giftActive && promoPreview?.isValid && (
            <div className="rounded-[var(--radius-card)] border border-signal/30 bg-signal-soft/50 px-4 py-3 text-sm text-ink">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{fill(t.billing.promoPercent, { percent: promoPercent })}</span>
                <span>{fill(t.billing.promoDiscount, { amount: formatPrice(promoPreview.discountAmountTiyin, promoPreview.currency, locale) })}</span>
              </div>
            </div>
          )}

          <Button size="lg" block disabled={busy} onClick={() => void checkout()}>
            {busy
              ? t.billing.opening
              : fill(t.billing.payWithClick, {
                  amount: formatPrice(amountToPay, selected.currency, locale),
                })}
          </Button>

          <UzHint>
            {t.billing.freeNote}
          </UzHint>
        </>
      )}

      <section>
        <SectionHeading>{t.billing.proUnlocks}</SectionHeading>
        <ul className="space-y-2">
          {t.billing.proBenefits.map((benefit) => (
            <li key={benefit} className="flex gap-3 text-base text-ink">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-signal" />
              {benefit}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading>{t.billing.freeLimits}</SectionHeading>
        <ul className="space-y-2">
          {t.billing.freeLimitItems.map((limit) => (
            <li key={limit} className="flex gap-3 text-base text-ink-muted">
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-faint"
              />
              {limit}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-support border-t border-hairline pt-5">
        {t.billing.cancelNote}
      </p>
    </div>
  )
}

function PromoCelebration({
  discountAmount,
  title,
  percentLabel,
  body,
}: {
  discountAmount: string
  title: string
  percentLabel: string
  body: string
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.24),transparent_44%),radial-gradient(circle_at_bottom,rgba(247,181,0,0.22),transparent_40%)]" />

      {promoCelebrationPieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-[-8%] rounded-full opacity-90"
          style={{
            left: piece.left,
            width: `${piece.size}px`,
            height: `${piece.size * 1.6}px`,
            background: piece.color,
            animationName: 'promo-confetti-fall',
            animationDuration: piece.duration,
            animationDelay: piece.delay,
            animationTimingFunction: 'ease-in',
            animationFillMode: 'forwards',
            transform: `rotate(${piece.rotate}deg)`,
            boxShadow: `0 0 20px ${piece.color}55`,
          }}
        />
      ))}

      <div className="absolute inset-x-4 top-8 mx-auto max-w-xl rounded-[32px] border border-white/15 bg-slate-950/78 px-6 py-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-1 text-sm font-bold text-amber-200">
          <span>{percentLabel}</span>
          <span>-</span>
          <span>{discountAmount}</span>
        </div>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white">{title}</h2>
        <p className="mt-2 text-base text-slate-200">{body}</p>
      </div>

      <style>{`
        @keyframes promo-confetti-fall {
          0% {
            transform: translate3d(0, -6vh, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate3d(-18px, 108vh, 0) rotate(540deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

function ActiveSubscription({ entitlement }: { entitlement: EntitlementView }) {
  const t = useT()
  const { locale } = useLocale()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function cancel() {
    if (!confirm(t.billing.cancelConfirm)) return
    setBusy(true)
    try {
      const result = await api.post<SubscriptionActionResponse>('/billing/cancel')
      setMessage(result.messageUz)
      await queryClient.invalidateQueries({ queryKey: ['entitlement'] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <Badge tone="milestone">
        {entitlement.status === 'Trialing' ? t.billing.trialActive : t.billing.proActive}
      </Badge>

      <p className="mt-3 text-base text-ink">
        {entitlement.status === 'Trialing'
          ? fill(t.billing.trialUntil, { date: formatDate(entitlement.trialEndsAt, locale) })
          : fill(t.billing.activeUntil, {
              date: formatDate(entitlement.currentPeriodEnd, locale),
            })}
      </p>

      {entitlement.cancelAtPeriodEnd && (
        <p className="text-support mt-2">
          {t.billing.cancelled}
        </p>
      )}

      {message && <p className="text-support mt-3">{message}</p>}

      {!entitlement.cancelAtPeriodEnd && (
        <Button variant="danger" className="mt-5" disabled={busy} onClick={() => void cancel()}>
          {t.billing.cancel}
        </Button>
      )}
    </Card>
  )
}

export function BillingReturn() {
  const t = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const { data, isLoading } = useQuery({
    queryKey: ['entitlement', 'return'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    refetchInterval: (query) => (query.state.data?.hasProAccess ? false : 2500),
  })

  if (isLoading) return <Spinner label={t.billing.returnChecking} />

  if (data?.hasProAccess) {
    track('payment_confirmed')
    return (
      <Card className="text-center">
        <Badge tone="milestone">{t.billing.returnConfirmed}</Badge>
        <h1 className="mt-4 text-xl font-extrabold text-ink">{t.billing.returnProOpen}</h1>
        <p className="text-support mt-2">{t.billing.returnProBody}</p>
        <Button className="mt-6" onClick={() => navigate('/home')}>
          {t.common.continue}
        </Button>
      </Card>
    )
  }

  return (
    <Card className="text-center">
      <Badge tone="caution">{t.billing.returnChecking}</Badge>
      <h1 className="mt-4 text-xl font-extrabold text-ink">{t.billing.returnPending}</h1>
      <p className="text-support mt-2">
        {t.billing.returnPendingBody}
      </p>
      {params.get('error') && <p className="text-support mt-3">{t.billing.returnError}</p>}
      <Button variant="secondary" className="mt-6" onClick={() => navigate('/home')}>
        {t.result.backHome}
      </Button>
    </Card>
  )
}
