import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, ChevronRight, GraduationCap, Headphones, ShieldCheck, TriangleAlert, Users, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CENTER_QUERY_KEY, fetchCenter, useCenterStudent } from '../lib/center'
import { cx } from '../lib/cx'
import { fill, useLocale, useT, type Locale } from '../lib/i18n'

/*
  Where a language center's student sees that they are one.

  The center pays for their course and its teacher may be marking what they read aloud, yet the
  only trace of it in the app was one grey line under their name in the account menu. These two
  pieces say it where it is looked at: a card on Home, and a block under the wordmark on every
  screen.
*/

function useMyCenter() {
  const { isCenterStudent, centerName, lock } = useCenterStudent()
  // Asked for every student of a center, not only a locked-out one: the card shows their group
  // and how long the center has paid for.
  const { data: center } = useQuery({
    queryKey: CENTER_QUERY_KEY,
    queryFn: fetchCenter,
    staleTime: 60_000,
    retry: false,
    enabled: isCenterStudent,
  })
  return { isCenterStudent, centerName, lock, center: center ?? null }
}

const DATE_TAG: Record<Locale, string> = { uz: 'uz', ru: 'ru-RU', en: 'en-GB' }

/** "17-dekabr": the day a center has paid up to is a day and a month, not a row of digits. */
function dayAndMonth(iso: string, locale: Locale) {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(iso)
  // Browsers have no Uzbek month names (the same call answers "M12 17"), so they are written here.
  if (locale === 'uz') return `${date.getDate()}-${UZ_MONTHS[date.getMonth()]}`
  return date.toLocaleDateString(DATE_TAG[locale], { day: 'numeric', month: 'long' })
}

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
]

/**
 * The center's card on Home: its name on the center's own colour, and under it the facts a
 * student asks about — is my course open, until when, which group am I in, who checks me.
 */
export function CenterHomeCard({ className }: { className?: string }) {
  const t = useT().center
  const { locale } = useLocale()
  const { isCenterStudent, centerName, lock, center } = useMyCenter()
  if (!isCenterStudent || !centerName) return null

  return (
    <Link
      to="/settings"
      className={cx(
        'group block overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-ground-raised shadow-[0_8px_24px_rgb(22_24_29/0.06)] transition-shadow hover:shadow-[0_10px_28px_rgb(31_111_224/0.16)]',
        className,
      )}
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-signal to-[#1d4fb8] px-5 py-4 text-white">
        {/* The cap, large and faint behind the name: the card reads as a membership card at a glance. */}
        <GraduationCap aria-hidden="true" strokeWidth={1.4} className="pointer-events-none absolute -right-3 -bottom-5 size-28 rotate-[-12deg] text-white/15" />
        <p className="text-[11px] font-extrabold tracking-[0.16em] text-white/80 uppercase">{t.yours}</p>
        <p className="mt-1 flex items-center gap-2">
          <strong className="min-w-0 truncate text-xl leading-tight font-black">{centerName}</strong>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />
        </p>
      </div>

      <ul className="divide-y divide-hairline px-5">
        {lock ? (
          <Fact Icon={TriangleAlert} tone="caution">{lock === 'paused' ? t.lockPaused : t.lockPending}</Fact>
        ) : (
          <Fact Icon={ShieldCheck} tone="milestone" value={center?.paidThrough ? fill(t.until, { date: dayAndMonth(center.paidThrough, locale) }) : undefined}>
            {t.proOpen}
          </Fact>
        )}
        {center?.groupName && <Fact Icon={Users} value={center.groupName}>{t.group}</Fact>}
        {center?.teacherReview && <Fact Icon={Headphones}>{t.teacherChecks}</Fact>}
        {!lock && <Fact Icon={BadgeCheck}>{t.paidByCenter}</Fact>}
      </ul>
    </Link>
  )
}

function Fact({ Icon, tone = 'plain', value, children }: {
  Icon: LucideIcon
  tone?: 'plain' | 'milestone' | 'caution'
  /** The answer, set against the right edge: a date, a group's name. */
  value?: string
  children: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <span
        aria-hidden="true"
        className={cx(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          tone === 'milestone' ? 'bg-milestone-soft text-milestone' : tone === 'caution' ? 'bg-caution-soft text-caution' : 'bg-signal-soft text-signal-ink',
        )}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <span className={cx('min-w-0 flex-1 font-bold', tone === 'caution' ? 'text-caution' : 'text-ink')}>{children}</span>
      {value && <span className="max-w-[55%] shrink-0 truncate text-right font-extrabold text-ink-muted">{value}</span>}
    </li>
  )
}

/** Under the wordmark, on every screen: the center's name with its own mark, linking to its details. */
export function CenterChip({ className }: { className?: string }) {
  const t = useT().center
  const { isCenterStudent, centerName } = useCenterStudent()
  if (!isCenterStudent || !centerName) return null

  return (
    <Link
      to="/settings"
      title={fill(t.profileLine, { center: centerName })}
      className={cx(
        'flex min-w-0 items-center gap-2.5 rounded-2xl border border-signal/20 bg-signal-soft/70 p-2 transition-colors hover:border-signal',
        className,
      )}
    >
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-signal to-[#1d4fb8] text-white">
        <GraduationCap className="size-5" strokeWidth={1.9} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] leading-tight font-extrabold tracking-[0.12em] text-signal-ink uppercase">{t.title}</span>
        <span className="block truncate text-sm leading-tight font-black text-ink">{centerName}</span>
      </span>
    </Link>
  )
}
