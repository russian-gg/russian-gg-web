import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, RequestError, track } from '../lib/api'
import { formatDate, formatPrice } from '../lib/format'
import type {
  BillingPeriod,
  CheckoutResponse,
  EntitlementView,
  PlansView,
  SubscriptionActionResponse,
} from '../lib/types'
import { Badge, Button, Card, ErrorNote, SectionHeading, Spinner, UzHint } from '../components/ui'

export function Paywall() {
  const [period, setPeriod] = useState<BillingPeriod>('NinetyDay')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<PlansView>('/billing/plans'),
  })

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
  })

  if (isLoading || !plans) return <Spinner />

  async function startTrial() {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<SubscriptionActionResponse>('/billing/trial')
      track('trial_started')
      await queryClient.invalidateQueries()
      setError(null)
      alert(result.messageUz)
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : 'Sinovni boshlab bo’lmadi.')
    } finally {
      setBusy(false)
    }
  }

  async function checkout() {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<CheckoutResponse>('/billing/checkout', {
        period,
        returnUrl: `${window.location.origin}/billing/return`,
      })
      track('checkout_started', { period })
      // Click hosts the payment form; the server is the only thing that decides paid state.
      window.location.href = result.checkoutUrl
    } catch (caught) {
      setError(caught instanceof RequestError ? caught.message : 'To’lovni boshlab bo’lmadi.')
      setBusy(false)
    }
  }

  const selected = plans.options.find((option) => option.period === period) ?? plans.options[0]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Pro bilan to’liq yo’l</h1>
        <p className="text-support mt-1">
          Bepul rejada daraja testi va birinchi 3 kun ochiq. Pro 90 kunlik to’liq yo’lni ochadi.
        </p>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      {entitlement?.paymentProcessing && (
        // Paid state is never taken on trust from the client (PRD §11).
        <Card>
          <Badge tone="caution">To’lov tekshirilmoqda</Badge>
          <p className="mt-3 text-base text-ink">
            To’lovingiz qabul qilindi va tasdiqlanmoqda. Tasdiqlangach Pro avtomatik ochiladi.
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
                    <Badge tone="milestone">{option.savingsPercent}% tejash</Badge>
                  )}
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {formatPrice(option.amountTiyin, option.currency)}
                </p>
                {option.period === 'NinetyDay' && (
                  <p className="text-support">
                    Oyiga {formatPrice(option.effectiveMonthlyTiyin, option.currency)}
                  </p>
                )}
              </button>
            ))}
          </div>

          <Button size="lg" block disabled={busy} onClick={() => void checkout()}>
            {busy
              ? 'Ochilmoqda…'
              : `Click orqali to’lash · ${formatPrice(selected.amountTiyin, selected.currency)}`}
          </Button>

          {plans.trialAvailable && (
            <>
              <Button variant="secondary" block disabled={busy} onClick={() => void startTrial()}>
                {plans.trialDays} kunlik bepul sinov
              </Button>
              <UzHint>
                Sinov muddati tugaganda avtomatik to’lov olinmaydi. Xohlasangiz keyin to’laysiz.
              </UzHint>
            </>
          )}
        </>
      )}

      <section>
        <SectionHeading>Pro nimani ochadi</SectionHeading>
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
        <SectionHeading>Bepul rejada</SectionHeading>
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

      {/* Cancellation is stated plainly, never hidden (PRD §13). */}
      <p className="text-support border-t border-hairline pt-5">
        Obunani istalgan vaqtda Sozlamalar bo’limidan bekor qilishingiz mumkin. Bekor qilganingizda
        to’langan muddat oxirigacha Pro ochiq qoladi.
      </p>
    </div>
  )
}

function ActiveSubscription({ entitlement }: { entitlement: EntitlementView }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function cancel() {
    if (!confirm('Obunani bekor qilishni tasdiqlaysizmi?')) return
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
        {entitlement.status === 'Trialing' ? 'Sinov muddati' : 'Pro faol'}
      </Badge>

      <p className="mt-3 text-base text-ink">
        {entitlement.status === 'Trialing'
          ? `Sinov ${formatDate(entitlement.trialEndsAt)} gacha.`
          : `Amal qilish muddati ${formatDate(entitlement.currentPeriodEnd)}.`}
      </p>

      {entitlement.cancelAtPeriodEnd && (
        <p className="text-support mt-2">
          Obuna bekor qilingan. Muddat tugagach bepul rejaga o’tasiz.
        </p>
      )}

      {message && <p className="text-support mt-3">{message}</p>}

      {!entitlement.cancelAtPeriodEnd && (
        <Button variant="danger" className="mt-5" disabled={busy} onClick={() => void cancel()}>
          Obunani bekor qilish
        </Button>
      )}
    </Card>
  )
}

/**
 * Landing page after Click. Shows a verifying state rather than claiming success: only the
 * server's entitlement response is authoritative.
 */
export function BillingReturn() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const { data, isLoading } = useQuery({
    queryKey: ['entitlement', 'return'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    // Click's callback may land a moment after the browser redirect.
    refetchInterval: (query) => (query.state.data?.hasProAccess ? false : 2500),
  })

  if (isLoading) return <Spinner label="To’lov tekshirilmoqda" />

  if (data?.hasProAccess) {
    track('payment_confirmed')
    return (
      <Card className="text-center">
        <Badge tone="milestone">To’lov tasdiqlandi</Badge>
        <h1 className="mt-4 text-xl font-semibold text-ink">Pro ochildi</h1>
        <p className="text-support mt-2">90 kunlik to’liq yo’l endi sizga ochiq.</p>
        <Button className="mt-6" onClick={() => navigate('/home')}>
          Davom etish
        </Button>
      </Card>
    )
  }

  return (
    <Card className="text-center">
      <Badge tone="caution">Tekshirilmoqda</Badge>
      <h1 className="mt-4 text-xl font-semibold text-ink">To’lov tasdiqlanmoqda</h1>
      <p className="text-support mt-2">
        Bu bir necha daqiqa olishi mumkin. Tasdiqlangach Pro avtomatik ochiladi — bu sahifani
        yopsangiz ham.
      </p>
      {params.get('error') && (
        <p className="text-support mt-3">To’lov tizimidan xatolik kodi qaytdi.</p>
      )}
      <Button variant="secondary" className="mt-6" onClick={() => navigate('/home')}>
        Bugungi sahifaga qaytish
      </Button>
    </Card>
  )
}
