import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, RequestError, track } from '../lib/api'
import { formatDate, formatPrice } from '../lib/format'
import { fill, useLocale, useT } from '../lib/i18n'
import type {
  BillingPeriod,
  CheckoutResponse,
  EntitlementView,
  PaymentProvider,
  PlanOption,
  PlansView,
  PromoCodePreview,
  SubscriptionActionResponse,
  WelcomeGiftStatus,
} from '../lib/types'
import { Badge, Button, Card, ErrorNote, QueryError, Spinner } from '../components/ui'
import { Reveal, Sequence } from '../components/motion'
import { stagger } from '../lib/motion'
import { PlanSelector, type PlanPricing } from './paywall/PlanSelector'
import { PromoCode } from './paywall/PromoCode'
import { PaymentMethodSelector } from './paywall/PaymentMethodSelector'
import { PaymentButton } from './paywall/PaymentButton'
import { FeatureComparison } from './paywall/FeatureComparison'

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

/**
 * The checkout.
 *
 * One decision per block, in the order it is made: which plan, any code, which provider, then
 * a single commitment. The screen used to end in two full-width pay buttons, one per provider,
 * which made "which app do I pay with" and "am I buying this" the same press and put two
 * primary actions on a page that has exactly one.
 *
 * The money is the server's throughout. `/billing/plans` quotes the prices, `/billing/promo`
 * prices a code, the welcome gift's percentage comes from `/billing/welcome-gift`, and
 * `/billing/checkout` is told the period and provider rather than an amount — this screen
 * never computes what will be charged, only what to show.
 */
export function Paywall() {
  const t = useT()
  const { locale } = useLocale()
  const [period, setPeriod] = useState<BillingPeriod>('NinetyDay')
  const [provider, setProvider] = useState<PaymentProvider>('click')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null)
  const [promoPreview, setPromoPreview] = useState<PromoCodePreview | null>(null)
  const [showPromoCelebration, setShowPromoCelebration] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const { data: plans, isLoading, isError, refetch } = useQuery({
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

  if (isLoading) return <Spinner />
  if (isError || !plans) return <QueryError onRetry={() => void refetch()} />

  async function checkout(provider: PaymentProvider) {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<CheckoutResponse>('/billing/checkout', {
        period,
        provider,
        returnUrl: `${window.location.origin}/billing/return`,
        promoCode: giftApplies ? undefined : promoPreview?.isValid ? promoPreview.code : undefined,
      })
      track('checkout_started', { period, provider })
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

  /**
   * What one plan costs after whatever discount actually reaches it.
   *
   * Three cases, and they are mutually exclusive by design. The welcome gift is a percentage
   * the server has already committed to and it only applies to the ninety-day plan, so it is
   * checked first and a code is not stacked on top of it — `checkout` sends no promo code when
   * the gift applies, and a card that showed both would be promising a discount the server
   * would decline to give. A code prices exactly one period, so it only marks that card. Any
   * other plan is at list price.
   */
  function pricingFor(option: PlanOption): PlanPricing {
    if (giftActive && option.period === 'NinetyDay') {
      const percent = welcomeGift!.discountPercent
      return {
        listAmountTiyin: option.amountTiyin,
        amountTiyin: option.amountTiyin - Math.floor((option.amountTiyin * percent) / 100),
        currency: option.currency,
        discountPercent: percent,
      }
    }

    if (promoPreview?.isValid && promoPreview.period === option.period) {
      return {
        listAmountTiyin: promoPreview.originalAmountTiyin,
        amountTiyin: promoPreview.finalAmountTiyin,
        currency: promoPreview.currency,
        discountPercent: promoPercent,
      }
    }

    return {
      listAmountTiyin: option.amountTiyin,
      amountTiyin: option.amountTiyin,
      currency: option.currency,
      discountPercent: 0,
    }
  }

  return (
    /*
      The screen where somebody decides to pay, so nothing here is hurried and nothing here is
      a flourish. The blocks arrive in the order the decision is made in: what this is, what it
      costs, whether a code applies, who takes the money, what it buys, and then the one press
      that commits to all of it.
    */
    <Sequence className="space-y-6" gap={stagger.base}>
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

      <Reveal as="section">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t.billing.title}</h1>
        <p className="text-support mt-2 max-w-2xl leading-relaxed">{t.billing.subtitle}</p>
      </Reveal>

      {error && <ErrorNote>{error}</ErrorNote>}

      {giftActive && (
        <Reveal>
          <Card className="border-coin-strong/30 bg-coin-faint/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="milestone">
                {fill(t.welcomeGift.discountPrize, { percent: welcomeGift!.discountPercent })}
              </Badge>
              <Gift aria-hidden="true" strokeWidth={1.9} className="size-7 text-coin-strong" />
            </div>
          </Card>
        </Reveal>
      )}

      {entitlement?.paymentProcessing && (
        <Reveal>
          <Card>
            <Badge tone="caution">{t.billing.processing}</Badge>
            <p className="mt-3 text-base text-ink">{t.billing.processingBody}</p>
          </Card>
        </Reveal>
      )}

      {entitlement?.hasProAccess ? (
        <Reveal>
          <ActiveSubscription entitlement={entitlement} />
        </Reveal>
      ) : (
        <>
          <Reveal as="section">
            <PlanSelector
              options={plans.options}
              period={period}
              onSelect={setPeriod}
              pricingFor={pricingFor}
            />
          </Reveal>

          {/* A code cannot be stacked on the welcome gift, so while the gift is live the
              field is not offered rather than offered and then refused. */}
          {!giftActive && (
            <Reveal as="section">
              <PromoCode
                code={promoCode}
                onCodeChange={setPromoCode}
                onApply={() => void applyPromoCode()}
                busy={promoBusy}
                feedback={promoFeedback}
                preview={promoPreview}
                percent={promoPercent}
              />
            </Reveal>
          )}

          <Reveal as="section">
            <Card>
              <h2 className="text-lg font-extrabold tracking-tight text-ink">
                {t.billing.paymentMethod}
              </h2>
              <div className="mt-4">
                <PaymentMethodSelector provider={provider} onSelect={setProvider} />
              </div>
            </Card>
          </Reveal>

          <Reveal as="section">
            <FeatureComparison />
          </Reveal>

          <Reveal>
            <PaymentButton
              provider={provider}
              amount={formatPrice(amountToPay, selected.currency, locale)}
              busy={busy}
              onPay={() => void checkout(provider)}
            />
          </Reveal>
        </>
      )}

      <Reveal>
        <p className="text-support border-t border-hairline pt-5 text-sm leading-relaxed">
          {t.billing.cancelNote}
        </p>
      </Reveal>
    </Sequence>
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
