import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, RequestError, track } from '../lib/api'
import { formatDate, formatPrice } from '../lib/format'
import { fill, useLocale, useT } from '../lib/i18n'
import type { BillingPeriod, CheckoutResponse, EntitlementView, PlansView, SubscriptionActionResponse } from '../lib/types'
import { Badge, Button, Card, ErrorNote, SectionHeading, Spinner, UzHint } from '../components/ui'

export function Paywall() {
  const t = useT()
  const { locale } = useLocale()
  const [period, setPeriod] = useState<BillingPeriod>('NinetyDay')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<PlansView>('/billing/plans'),
  })

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  if (isLoading || !plans) return <Spinner />

  async function checkout() {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<CheckoutResponse>('/billing/checkout', {
        period,
        returnUrl: `${window.location.origin}/billing/return`,
      })
      track('checkout_started', { period })
      window.location.href = result.checkoutUrl
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : t.billing.checkoutFailed)
      setBusy(false)
    }
  }

  const selected = plans.options.find((option) => option.period === period) ?? plans.options[0]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.billing.title}</h1>
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
                  <span className="text-base font-semibold text-ink">{option.labelUz}</span>
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

          <Button size="lg" block disabled={busy} onClick={() => void checkout()}>
            {busy
              ? t.billing.opening
              : fill(t.billing.payWithClick, {
                  amount: formatPrice(selected.amountTiyin, selected.currency, locale),
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
          {plans.proBenefitsUz.map((benefit) => (
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
          {plans.freeLimitsUz.map((limit) => (
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
        <h1 className="mt-4 text-xl font-semibold text-ink">{t.billing.returnProOpen}</h1>
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
      <h1 className="mt-4 text-xl font-semibold text-ink">{t.billing.returnPending}</h1>
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
