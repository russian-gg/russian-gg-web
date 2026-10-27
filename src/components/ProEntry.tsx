import { useId } from 'react'
import { ArrowRight, Check, Crown, Lock, Mic, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cx } from '../lib/cx'
import { formatDate, planLabel } from '../lib/format'
import { fill, useLocale, useT } from '../lib/i18n'
import { COURSE_DAYS, useProOffer } from '../lib/pro-offer'
import { ButtonFace } from './ui'

/*
  The standing ways to Pro. Before these, a free learner met the plans only at a lock or deep in
  Settings; now the sidebar, the phone header and the account menu carry them on every screen,
  and Home, the path and Progress each say it once in their own terms. All of them stay away
  from a Pro learner — the sidebar keeps a quiet status line instead — and from a learner who
  already has the whole course open.

  Only the button leads anywhere — the cards are read, not clicked — and it has one verb on it
  ("See Pro"); the price rides underneath as a fact, not as the button's label: a button that
  only says "3,322 so'm a day" does not say what pressing it does.
*/

/** Shown to a free learner who still has days to sell, once the numbers are in. */
function useFreeOffer() {
  const offer = useProOffer()
  return offer.ready && offer.isFree && !offer.hasEverything ? offer : null
}

function CrownMark({ className = 'size-7 rounded-lg', iconClassName = 'size-4' }: { className?: string; iconClassName?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('flex shrink-0 items-center justify-center bg-coin text-coin-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]', className)}
    >
      <Crown strokeWidth={2.2} className={iconClassName} />
    </span>
  )
}

/** The verb on the button and the price under it — the same pair everywhere. */
function ProAction({ perDay, size = 'md', block = false }: { perDay: string | null; size?: 'sm' | 'md'; block?: boolean }) {
  const t = useT()
  return (
    <span className={cx('flex flex-col gap-1.5', block ? 'items-stretch' : 'items-start sm:items-end')}>
      <Link to="/paywall" className={cx('group rounded-[var(--radius-control)]', block ? 'block' : 'inline-block')}>
        <ButtonFace size={size} className={cx('gap-1.5', block && 'w-full')}>
          {t.path.seePro}
          <ArrowRight aria-hidden="true" strokeWidth={2.4} className="size-4 transition-transform group-hover:translate-x-0.5" />
        </ButtonFace>
      </Link>
      {perDay && (
        <span className={cx('text-xs font-bold text-ink-muted', block && 'text-center')}>
          {fill(t.pro.perDay, { amount: perDay })}
        </span>
      )}
    </span>
  )
}

/** One segment per free day: finished ones filled, the next one to do tinted. */
function FreeDaySegments({ done, className }: { done: boolean[]; className?: string }) {
  const next = done.indexOf(false)
  return (
    <span aria-hidden="true" className={cx('flex gap-1', className)}>
      {done.map((isDone, index) => (
        <span
          key={index}
          className={cx(
            'h-1.5 flex-1 rounded-full',
            isDone ? 'bg-milestone' : index === next ? 'bg-milestone/35' : 'bg-ground-sunken',
          )}
        />
      ))}
    </span>
  )
}

/** Sidebar footer, above the audio controls: the free days used and what comes after them. */
export function RailProCard() {
  const t = useT()
  const { locale } = useLocale()
  const offer = useProOffer()
  const free = useFreeOffer()

  if (offer.ready && offer.entitlement?.hasProAccess) {
    return (
      <Link
        to="/settings/billing"
        className="flex items-center gap-3 rounded-2xl border border-hairline bg-ground-raised px-3 py-2.5 text-sm font-extrabold text-ink transition-colors hover:border-coin-border"
      >
        <CrownMark className="size-8 rounded-xl" />
        <span className="min-w-0">
          <span className="block truncate">{planLabel(offer.entitlement, t)}</span>
          {offer.proUntil && (
            <span className="block truncate text-xs font-semibold text-ink-muted">
              {fill(t.pro.until, { date: formatDate(offer.proUntil, locale) })}
            </span>
          )}
        </span>
      </Link>
    )
  }
  if (!free) return null

  const left = free.freeDays - free.freeDaysDone
  const usedUp = left <= 0
  return (
    <div
      className={cx(
        'block rounded-2xl border-[1.5px] p-3',
        usedUp
          ? 'border-coin-strong bg-gradient-to-b from-coin-soft to-coin-faint'
          : 'border-coin-border bg-gradient-to-b from-coin-faint to-ground-raised',
      )}
    >
      <span className="flex items-center gap-2">
        <CrownMark />
        <span className="min-w-0 flex-1 text-sm font-extrabold text-ink">{t.pro.upgrade}</span>
        <span className="text-xs font-black text-ink-muted tabular-nums">
          {free.freeDaysDone}/{free.freeDays}
        </span>
      </span>
      <FreeDaySegments done={free.freeDayDone} className="mt-3" />
      <span className="mt-2 block text-xs leading-snug font-semibold text-ink-muted">
        {usedUp ? fill(t.pro.nextDayPro, { day: free.freeDays + 1 }) : fill(t.pro.freeLeft, { count: left })}
      </span>
      <span className="mt-3 block">
        <ProAction perDay={free.perDay} size="sm" block />
      </span>
    </div>
  )
}

/** Phone header, beside the avatar. The discount countdown takes this slot while it runs. */
export function HeaderProPill() {
  const t = useT()
  const free = useFreeOffer()
  if (!free || free.discountPercent) return null

  return (
    <Link
      to="/paywall"
      aria-label={t.pro.upgrade}
      className="raised raised-sm inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-coin-border bg-coin-soft pr-3 pl-1 text-[13px] font-black text-coin-ink"
    >
      <CrownMark className="size-6 rounded-full" iconClassName="size-3.5" />
      Pro
    </Link>
  )
}

/** Home's side column, first: what Pro opens from the next locked day, and its price. */
export function HomeProCard() {
  const t = useT()
  const free = useFreeOffer()
  if (!free) return null

  const left = free.freeDays - free.freeDaysDone
  return (
    <div
      className="relative block overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-coin-border bg-gradient-to-br from-coin-soft via-coin-faint to-ground-raised p-5"
    >
      {/* A large crown in the corner: the card is recognisable before it is read. */}
      <Crown aria-hidden="true" strokeWidth={1.4} className="pointer-events-none absolute -top-3 -right-3 size-24 rotate-12 text-coin/45" />
      <span className="relative flex items-center gap-2">
        <CrownMark className="size-7 rounded-lg" />
        <span className="text-xs font-black tracking-[0.14em] text-coin-ink uppercase">Pro</span>
      </span>
      <span className="relative mt-3 block text-lg leading-snug font-extrabold text-ink">
        {fill(t.pro.homeTitle, { day: free.freeDays + 1 })}
      </span>
      <span className="relative mt-1 block text-sm font-semibold text-ink-muted">
        {left > 0 ? fill(t.pro.freeLeft, { count: left }) : t.pro.freeUsed}
      </span>
      <ul className="relative mt-4 space-y-2 text-sm font-semibold text-ink">
        {t.billing.proBenefits.slice(0, 3).map((benefit) => (
          <li key={benefit} className="flex gap-2">
            <span aria-hidden="true" className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-milestone text-on-signal">
              <Check strokeWidth={3} className="size-3" />
            </span>
            {benefit}
          </li>
        ))}
      </ul>
      <span className="relative mt-5 block">
        <ProAction perDay={free.perDay} block />
      </span>
    </div>
  )
}

/** Four-point twinkles around the crowns, placed by the caller. */
function Sparkle({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cx('pointer-events-none absolute text-coin', className)}>
      <path fill="currentColor" d="M12 0c.6 5.6 2.4 8.4 12 12-9.6 3.6-11.4 6.4-12 12-.6-5.6-2.4-8.4-12-12C9.6 8.4 11.4 5.6 12 0Z" />
    </svg>
  )
}

/** The gold crown over the call to action. Drawn, not an image, so it is crisp at any size. */
function CrownArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg aria-hidden="true" viewBox="0 0 120 96" className={className}>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a3" />
          <stop offset=".5" stopColor="#f4c84d" />
          <stop offset="1" stopColor="#d48f17" />
        </linearGradient>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6cc55" />
          <stop offset="1" stopColor="#b87410" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="90" rx="40" ry="5" fill="#d48f17" opacity=".18" />
      <path d="M14 34 36 56 60 18l24 38 22-22-8 44H22Z" fill={`url(#${id}-gold)`} stroke="#c98512" strokeWidth="2" strokeLinejoin="round" />
      <path d="M60 26 44 52" stroke="#fff6cf" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <rect x="20" y="72" width="80" height="13" rx="6.5" fill={`url(#${id}-band)`} stroke="#c98512" strokeWidth="2" />
      <circle cx="60" cy="14" r="7" fill={`url(#${id}-gold)`} stroke="#c98512" strokeWidth="2" />
      <circle cx="12" cy="30" r="6" fill={`url(#${id}-gold)`} stroke="#c98512" strokeWidth="2" />
      <circle cx="108" cy="30" r="6" fill={`url(#${id}-gold)`} stroke="#c98512" strokeWidth="2" />
      <circle cx="60" cy="78.5" r="3.4" fill="#fff6cf" />
      <circle cx="40" cy="78.5" r="2.6" fill="#fff6cf" opacity=".8" />
      <circle cx="80" cy="78.5" r="2.6" fill="#fff6cf" opacity=".8" />
    </svg>
  )
}

/** Above the course map: which days are free, what Pro adds, and the way to it — one card. */
export function PathProStrip() {
  const t = useT()
  const free = useFreeOffer()
  if (!free) return null

  // Up to seven free days and the first three Pro ones, so the line between them is seen.
  const freeShown = free.freeDayDone.slice(0, 7)
  const next = free.freeDayDone.indexOf(false)
  const proShown = Math.min(3, COURSE_DAYS - free.freeDays)
  const chip = 'flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-black'
  const benefits = [
    { icon: Crown, tone: 'bg-coin-soft text-coin-ink', title: t.pro.benefitPathTitle, body: t.pro.benefitPathBody },
    { icon: Mic, tone: 'bg-milestone-soft text-milestone', title: t.pro.benefitVoiceTitle, body: t.pro.benefitVoiceBody },
    { icon: Target, tone: 'bg-signal-soft text-signal-ink', title: t.pro.benefitRepairTitle, body: t.pro.benefitRepairBody },
  ]

  return (
    <div
      className="relative grid overflow-hidden rounded-[1.5rem] border-[1.5px] border-coin-border bg-gradient-to-br from-coin-faint via-ground-raised to-coin-faint shadow-[0_18px_40px_rgb(212_143_23/0.08)] xl:grid-cols-[minmax(0,1fr)_auto_auto]"
    >
      {/* What is free and what is not. */}
      <span className="relative flex min-w-0 flex-col gap-5 p-5 sm:p-7">
        <span className="flex items-start gap-4">
          <span className="relative shrink-0">
            <CrownMark className="size-14 rounded-2xl bg-coin-soft text-coin-ink" iconClassName="size-7" />
            <Sparkle className="-top-2 -right-2 size-4" />
            <Sparkle className="-bottom-1.5 -left-2 size-3" />
          </span>
          <span className="min-w-0">
            <span className="block text-xl leading-tight font-black tracking-tight text-ink sm:text-2xl">
              {free.freeDays > 1 ? fill(t.pro.pathFreeRange, { last: free.freeDays }) : t.pro.pathFree}{' '}
              <span className="text-coin-strong">{fill(t.pro.pathPro, { from: free.freeDays + 1, total: COURSE_DAYS })}</span>
            </span>
            <span className="mt-1.5 block text-sm leading-relaxed font-semibold text-ink-muted sm:text-base">
              {fill(t.pro.freeDone, { done: free.freeDaysDone, total: free.freeDays })} · {t.pro.pathSubtitle}
            </span>
          </span>
        </span>

        {/* The days themselves: free ones in green, a divider, then the Pro stretch in gold. */}
        <span aria-hidden="true" className="flex flex-wrap items-center gap-2">
          {freeShown.map((isDone, index) => (
            <span
              key={`f${index}`}
              className={cx(
                chip,
                isDone
                  ? 'bg-milestone text-on-signal shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)]'
                  : index === next
                    ? 'bg-ground-raised text-milestone ring-2 ring-milestone ring-inset'
                    : 'bg-milestone-soft text-milestone',
              )}
            >
              {isDone ? <Check strokeWidth={3} className="size-5" /> : index + 1}
            </span>
          ))}
          {free.freeDays > freeShown.length && <span className="px-0.5 font-black text-milestone">…</span>}

          <span className="mx-2 hidden h-9 w-px bg-hairline sm:block" />

          <span className="flex h-11 items-center gap-1.5 rounded-xl bg-coin px-3.5 text-sm font-black tracking-wide text-coin-ink uppercase shadow-[inset_0_-3px_0_rgb(0_0_0/0.1)]">
            <Crown strokeWidth={2.4} className="size-4" />
            Pro
          </span>

          {Array.from({ length: proShown }, (_, index) => (
            <span key={`p${index}`} className={cx(chip, 'border-[1.5px] border-dashed border-coin-border bg-coin-faint text-coin-ink')}>
              {index === 0 ? free.freeDays + 1 : <Lock strokeWidth={2.4} className="size-4" />}
            </span>
          ))}
          <span className="px-1 text-base font-black text-coin-ink">… {COURSE_DAYS}</span>
        </span>
      </span>

      {/* What Pro adds. */}
      <span className="grid content-center gap-4 border-t border-coin-border/60 px-5 py-5 sm:px-7 xl:w-[19rem] xl:border-t-0 xl:border-l xl:px-6">
        {benefits.map(({ icon: Icon, tone, title, body }) => (
          <span key={title} className="flex items-start gap-3">
            <span aria-hidden="true" className={cx('flex size-10 shrink-0 items-center justify-center rounded-full', tone)}>
              <Icon strokeWidth={2} className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-ink">{title}</span>
              <span className="block text-sm text-ink-muted">{body}</span>
            </span>
          </span>
        ))}
      </span>

      {/* The way to it. */}
      <span className="relative flex flex-col items-center justify-center gap-3 border-t border-coin-border/60 bg-gradient-to-br from-transparent via-coin-faint to-coin-soft/70 px-6 py-6 xl:w-[18rem] xl:border-t-0 xl:border-l">
        <span className="relative">
          <span aria-hidden="true" className="absolute inset-x-2 bottom-1 h-8 rounded-full bg-coin/40 blur-xl" />
          <CrownArt className="relative h-20 w-24" />
          <Sparkle className="-top-1 -right-6 size-5" />
          <Sparkle className="top-6 -left-6 size-3.5" />
          <Sparkle className="-right-9 bottom-1 size-4" />
        </span>
        <span className="w-full max-w-[15rem]">
          <ProAction perDay={free.perDay} block />
        </span>
      </span>
    </div>
  )
}

/** Progress, under the overall card: the whole course as one bar — what is open, what Pro adds. */
export function ProgressProCard() {
  const t = useT()
  const free = useFreeOffer()
  if (!free) return null

  const freeShare = (free.freeDays / COURSE_DAYS) * 100
  const doneShare = (free.freeDaysDone / COURSE_DAYS) * 100
  return (
    <div
      className="block rounded-[var(--radius-card)] border-[1.5px] border-coin-border bg-gradient-to-br from-coin-faint to-ground-raised p-5"
    >
      <span className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <CrownMark className="size-11 rounded-2xl" iconClassName="size-5" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold text-ink">{t.pro.progressTitle}</span>
          <span className="text-support mt-1 block text-sm">
            {fill(t.pro.progressBody, { from: free.freeDays + 1, total: COURSE_DAYS })}
          </span>
        </span>
        <ProAction perDay={free.perDay} />
      </span>

      {/* The 90 days to scale: done, still free, and the Pro stretch after them. */}
      <span aria-hidden="true" className="relative mt-5 block h-2.5 overflow-hidden rounded-full bg-coin-soft">
        <span className="absolute inset-y-0 left-0 bg-milestone/30" style={{ width: `${freeShare}%` }} />
        <span className="absolute inset-y-0 left-0 rounded-full bg-milestone" style={{ width: `${doneShare}%` }} />
      </span>
      <span className="mt-2 flex justify-between gap-3 text-xs font-bold">
        <span className="text-milestone">
          {free.freeDays > 1 ? fill(t.pro.pathFreeRange, { last: free.freeDays }) : t.pro.pathFree}
        </span>
        <span className="flex items-center gap-1 text-coin-ink">
          <Lock aria-hidden="true" strokeWidth={2.4} className="size-3" />
          {free.freeDays + 1}–{COURSE_DAYS} · Pro
        </span>
      </span>
    </div>
  )
}
