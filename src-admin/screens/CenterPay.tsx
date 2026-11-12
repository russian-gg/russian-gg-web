import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { adminApiPath, formatDate } from '../lib/api'
import { formatPeriod, formatSom } from '../lib/center-format'
import { type CenterPayView } from '../lib/center-types'
import { Card, ErrorNote, Loading } from '../components/ui'
import { InvoiceBadge, PayButtons } from '../components/center'

/**
 * A language center's invoice, opened from the link the team sent: what the month costs and a
 * Click or Payme button. No login — the link is the key — and nothing on it but this one
 * invoice, because it is forwarded to whoever at the center holds the money.
 *
 * The provider sends the payer back here. Its confirmation can arrive a few seconds after
 * that, so an unpaid invoice on return is checked again rather than shown as a failure.
 */
export function CenterPayPage({ token }: { token: string }) {
  const [data, setData] = useState<CenterPayView | null>(null)
  const [failure, setFailure] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setFailure('')
    try {
      const response = await fetch(adminApiPath(`/api/public/center-pay/${encodeURIComponent(token)}`))
      if (response.status === 404) throw new Error("Bu havola topilmadi. Russian.gg jamoasidan yangisini so'rang.")
      if (!response.ok) throw new Error("Ma'lumotni yuklab bo'lmadi. Birozdan keyin qayta urinib ko'ring.")
      setData((await response.json()) as CenterPayView)
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Ma'lumotni yuklab bo'lmadi.")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const open = data?.status === 'sent' || data?.status === 'overdue'

  // Back from Click or Payme with the invoice still open: the callback may be a few seconds
  // behind the redirect, so look again a few times before leaving it to the button.
  useEffect(() => {
    if (!open || !document.referrer || new URL(document.referrer).origin === window.location.origin) return
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      void load()
      if (tries >= 4) window.clearInterval(timer)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [open, load])

  return (
    <div className="flex min-h-screen items-start justify-center bg-ground-sunken px-4 py-10 sm:items-center">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center">
          <div className="text-2xl font-extrabold tracking-tight text-ink">
            russian<span className="text-signal-ink">.gg</span>
          </div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">O'quv markazlari uchun to'lov</div>
        </div>

        <Card as="div" className="space-y-6 sm:p-7">
          {loading && !data && <Loading />}
          {failure && <ErrorNote onRetry={load}>{failure}</ErrorNote>}

          {data && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">Markaz</p>
                  <h1 className="mt-0.5 truncate text-xl font-extrabold text-ink">{data.centerName}</h1>
                </div>
                <InvoiceBadge status={data.status} />
              </div>

              {/* What the money buys, read top to bottom: the sum, then the two things it is made of. */}
              <div className="rounded-[var(--radius-card)] border-2 border-hairline">
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">To'lanadigan summa</p>
                  <div className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums text-ink">{formatSom(data.amountTiyin)}</div>
                </div>
                <dl className="divide-y divide-hairline border-t-2 border-hairline text-sm">
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <dt className="flex items-center gap-2 text-ink-muted">
                      <CalendarDays aria-hidden="true" className="size-4" strokeWidth={1.8} />
                      Davr
                    </dt>
                    <dd className="text-right font-bold text-ink">{formatPeriod(data.periodStart, data.periodEnd)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <dt className="flex items-center gap-2 text-ink-muted">
                      <Users aria-hidden="true" className="size-4" strokeWidth={1.8} />
                      O'quvchilar
                    </dt>
                    <dd className="text-right font-bold text-ink tabular-nums">
                      {data.seats} × {formatSom(data.pricePerSeatTiyin)}
                    </dd>
                  </div>
                </dl>
              </div>

              {open && (
                <div className="space-y-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">To'lov usuli</p>
                  <PayButtons
                    token={token}
                    providers={data.providers}
                    returnUrl={window.location.href}
                    amountTiyin={data.amountTiyin}
                  />
                  <div className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-muted">
                    <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-milestone" strokeWidth={1.8} />
                    <p>
                      To'lov tanlangan xizmat sahifasida amalga oshiriladi. Pul tushishi bilan o'quvchilarda Russian.gg Pro{' '}
                      <b className="text-ink">{formatDate(data.periodEnd)}</b> gacha ochiladi.{' '}
                      <button
                        type="button"
                        onClick={() => void load()}
                        disabled={loading}
                        className="inline-flex items-center gap-1 font-bold text-signal-ink hover:underline disabled:opacity-50"
                      >
                        <RefreshCw aria-hidden="true" className={loading ? 'size-3 animate-spin' : 'size-3'} strokeWidth={2} />
                        {loading ? 'Tekshirilmoqda' : 'Holatni yangilash'}
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {data.status === 'paid' && (
                <div role="status" className="flex items-start gap-3 rounded-[var(--radius-control)] bg-milestone-soft px-4 py-3 text-sm text-milestone">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} />
                  <span>
                    <b>To'langan</b>
                    {data.paidAt && ` · ${formatDate(data.paidAt)}`}. O'quvchilarda Pro {formatDate(data.periodEnd)} gacha ochiq.
                    Rahmat!
                  </span>
                </div>
              )}

              {(data.status === 'cancelled' || data.status === 'draft') && (
                <p className="text-sm text-ink-muted">Bu hisob-faktura bekor qilingan. Russian.gg jamoasidan yangisini so'rang.</p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
