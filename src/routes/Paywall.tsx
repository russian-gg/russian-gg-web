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
} from '../lib/types'
import { Badge, Button, Card, ErrorNote, SectionHeading, Spinner, UzHint } from '../components/ui'

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

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<PlansView>('/billing/plans'),
  })

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  if (isLoading || !plans) return <Spinner />

  useEffect(() => {
    setPromoPreview(null)
    setPromoFeedback(null)
  }, [period])

  async function checkout() {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<CheckoutResponse>('/billing/checkout', {
        period,
        returnUrl: `${window.location.origin}/billing/return`,
        promoCode: promoPreview?.isValid ? promoPreview.code : undefined,
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
    } catch (caught) {
      setPromoFeedback(caught instanceof RequestError ? caught.message : t.billing.checkoutFailed)
    } finally {
      setPromoBusy(false)
    }
  }

  const selected = plans.options.find((option) => option.period === period) ?? plans.options[0]
  const amountToPay = promoPreview?.isValid ? promoPreview.finalAmountTiyin : selected.amountTiyin

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t.billing.title}</h1>
        <p className="text-support mt-1">
          {t.billing.subtitle}
        </p>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

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
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {formatPrice(option.amountTiyin, option.currency, locale)}
                </p>
                {option.period === 'NinetyDay' && (
                  <p className="text-support">
                    {fill(t.billing.perMonth, {
                      amount: formatPrice(option.effectiveMonthlyTiyin, option.currency, locale),
                    })}
                  </p>
                )}
              </button>
            ))}
          </div>

          <Card>
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
              <div className="mt-4 space-y-1 text-sm text-ink">
                <div>{fill(t.billing.promoDiscount, { amount: formatPrice(promoPreview.discountAmountTiyin, promoPreview.currency, locale) })}</div>
                <div className="font-bold">
                  {fill(t.billing.promoFinal, { amount: formatPrice(promoPreview.finalAmountTiyin, promoPreview.currency, locale) })}
                </div>
              </div>
            )}
          </Card>

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
