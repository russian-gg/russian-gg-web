import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChevronRight, TriangleAlert, X } from 'lucide-react'
import { adminFetch, formatDateTime, formatMoney, formatNumber } from '../lib/api'
import type { SmsHealth } from '../lib/types'
import { Button, Card, IconButton } from './ui'
import { cx } from '../../src/lib/cx'
import { useFocusTrap } from '../../src/lib/focus-trap'
import { Overlay } from '../../src/components/motion'

/** Often enough that a refusal is on screen before the next learner gives up on their code. */
const POLL_MS = 60_000

/**
 * The Eskiz account, read once a minute and on return to the tab. One poll for the layout, so
 * the sidebar figure and the warning strip can never disagree.
 *
 * Off for anyone but an admin: the endpoint is theirs, and a 403 would sign a sales account out.
 * A failed read keeps the last answer rather than clearing it — a warning about the warning
 * would only teach people to ignore the strip.
 */
export function useSmsHealth(enabled: boolean) {
  const [health, setHealth] = useState<SmsHealth | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setHealth(null)
      return
    }

    let cancelled = false

    const load = () =>
      adminFetch<SmsHealth>('/system/sms')
        .then((next) => {
          if (!cancelled) setHealth(next)
        })
        .catch(() => {})

    load()
    const timer = window.setInterval(load, POLL_MS)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])

  return { health, reload }
}

const smsStates: Record<SmsHealth['status'], { dot: string; text: string; label: string; meaning: string }> = {
  ok: {
    dot: 'bg-signal',
    text: 'text-signal-ink',
    label: 'Ishlayapti',
    meaning: 'Tasdiqlash kodlari yuborilmoqda.',
  },
  low_balance: {
    dot: 'bg-caution',
    text: 'text-caution',
    label: 'Balans kam',
    meaning: "Kodlar hali yuborilmoqda, lekin balans ogohlantirish chegarasidan past. Tez orada to'ldiring.",
  },
  failing: {
    dot: 'bg-danger',
    text: 'text-danger',
    label: 'Yuborilmayapti',
    meaning:
      "Eskiz SMS yuborishni rad etyapti — telefon orqali ro'yxatdan o'tayotganlar kod olmayapti. Balans va akkauntni tekshiring.",
  },
  disabled: {
    dot: 'bg-ink-faint',
    text: 'text-ink-muted',
    label: 'Sozlanmagan',
    meaning:
      "Serverda Eskiz login va paroli yo'q, shuning uchun kodlar SMS bo'lib ketmaydi — faqat server logiga yoziladi. Bu faqat lokal muhit uchun normal.",
  },
}

const money = (value: number | null) => (value === null ? '—' : formatMoney(value, "so'm"))

/**
 * The balance in the sidebar, on every screen — topping up is planned from the figure, not from
 * the alarm. Collapsed to its dot on the icon rail, with the figure as the tooltip. A click opens
 * everything else that is known about the account.
 */
export function SmsBalanceWidget({
  health,
  collapsed,
  onReload,
}: {
  health: SmsHealth | null
  collapsed: boolean
  onReload: () => void
}) {
  const [open, setOpen] = useState(false)

  if (!health) return null

  const state = smsStates[health.status]
  const figure = health.status === 'disabled' ? state.label : money(health.balance)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`SMS balans: ${figure} · ${state.label}`}
        aria-haspopup="dialog"
        className={cx(
          'group flex w-full items-center gap-3 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised px-3 py-2.5 text-left transition-colors',
          'hover:border-ink-faint hover:bg-ground-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal',
          collapsed && 'lg:justify-center lg:px-2',
        )}
      >
        <span aria-hidden="true" className={cx('size-2.5 shrink-0 rounded-full', state.dot)} />
        <span className={cx('min-w-0 flex-1', collapsed && 'lg:hidden')}>
          <span className="block text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-faint">
            SMS balans
          </span>
          <span className="block truncate text-sm font-extrabold tabular-nums text-ink">{figure}</span>
          {health.status !== 'disabled' && (
            <span className={cx('block text-xs font-bold', state.text)}>{state.label}</span>
          )}
        </span>
        <ChevronRight
          aria-hidden="true"
          strokeWidth={1.8}
          className={cx(
            'size-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5',
            collapsed && 'lg:hidden',
          )}
        />
      </button>

      {open && <SmsHealthDialog health={health} onReload={onReload} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Everything known about the Eskiz account, and the two things an admin can do about it. */
function SmsHealthDialog({
  health,
  onReload,
  onClose,
}: {
  health: SmsHealth
  onReload: () => void
  onClose: () => void
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>()
  const state = smsStates[health.status]
  const configured = health.status !== 'disabled'

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <Overlay open onDismiss={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="SMS (Eskiz)"
        className="w-full max-w-lg"
      >
        <Card as="div" className="w-full" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-ink">SMS (Eskiz)</h2>
              <div className={cx('mt-1 flex items-center gap-2 text-sm font-bold', state.text)}>
                <span aria-hidden="true" className={cx('size-2.5 rounded-full', state.dot)} />
                {state.label}
              </div>
            </div>
            <IconButton label="Yopish" onClick={onClose}>
              <X aria-hidden="true" className="size-4" strokeWidth={1.8} />
            </IconButton>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{state.meaning}</p>

          {configured && (
            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Fact label="Balans">
                <span className="text-xl">{money(health.balance)}</span>
                {health.balance === null && (
                  <span className="block text-xs font-normal text-ink-muted">Eskizdan o'qib bo'lmadi</span>
                )}
              </Fact>
              <Fact label="Ogohlantirish chegarasi">{money(health.lowBalanceThreshold)}</Fact>
              <Fact label="Oxirgi yuborilgan SMS">{formatDateTime(health.lastSuccessAt)}</Fact>
              <Fact label="Ketma-ket xatolar">{formatNumber(health.consecutiveFailures)}</Fact>
              <Fact label="Oxirgi xato" wide>
                {formatDateTime(health.lastFailureAt)}
                {health.lastFailureReason && (
                  <span className="mt-1 block rounded-[var(--radius-card)] bg-ground-sunken px-3 py-2 text-sm font-normal break-words text-ink-muted">
                    {health.lastFailureReason}
                  </span>
                )}
              </Fact>
            </dl>
          )}

          <p className="mt-5 text-xs leading-relaxed text-ink-faint">
            Holat har daqiqada yangilanadi, balans esa Eskizdan 5 daqiqada bir marta o'qiladi.
          </p>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onReload}>
              Yangilash
            </Button>
            {configured && (
              <a
                href="https://my.eskiz.uz"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center rounded-[var(--radius-control)] bg-signal px-4 text-sm font-bold text-white transition-colors hover:opacity-90"
              >
                Eskiz kabineti
              </a>
            )}
          </div>
        </Card>
      </div>
    </Overlay>
  )
}

function Fact({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cx(wide && 'sm:col-span-2')}>
      <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
      <dd className="mt-1 font-extrabold tabular-nums text-ink">{children}</dd>
    </div>
  )
}

/**
 * A strip over every screen while phone sign-up codes are not going out, or are about to stop.
 * Eskiz refusing a send — an empty balance, a login it no longer accepts — used to reach only
 * the server log, and the first anybody heard of it was a learner who never got a code.
 */
export function SmsHealthBanner({ health }: { health: SmsHealth | null }) {
  if (!health || (health.status !== 'failing' && health.status !== 'low_balance')) return null

  const failing = health.status === 'failing'
  const balance = health.balance === null ? null : formatMoney(health.balance, "so'm")

  return (
    <div
      role="alert"
      className={cx(
        'mb-5 flex gap-3 rounded-[var(--radius-card)] border-2 px-4 py-3 text-sm',
        failing ? 'border-danger bg-danger-soft text-danger' : 'border-caution bg-caution-soft text-caution',
      )}
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} />
      <div className="min-w-0 space-y-1">
        <div className="font-extrabold">
          {failing ? 'SMS kodlar yuborilmayapti' : 'Eskiz balansi tugab qolmoqda'}
        </div>
        <p>
          {failing
            ? "Telefon orqali ro'yxatdan o'tayotganlar tasdiqlash kodini olmayapti. Eskiz balansi va akkauntini tekshiring."
            : `Balans ${formatMoney(health.lowBalanceThreshold, "so'm")} dan kam. To'ldirilmasa, SMS kodlar to'xtaydi.`}
        </p>
        <p className="break-words opacity-90">
          {balance !== null && <>Balans: <b>{balance}</b>. </>}
          {failing && health.lastFailureReason && <>Eskiz javobi: «{health.lastFailureReason}». </>}
          {failing && health.lastFailureAt && <>Oxirgi xato: {formatDateTime(health.lastFailureAt)}. </>}
          {failing && health.consecutiveFailures > 0 && <>Ketma-ket xatolar: {health.consecutiveFailures}. </>}
        </p>
      </div>
    </div>
  )
}
