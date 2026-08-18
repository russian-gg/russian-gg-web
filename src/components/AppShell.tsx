import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { planLabel } from '../lib/format'
import { useOpenGames } from '../lib/games'
import { useTheme } from '../lib/theme'
import { LOCALES, LOCALE_NAMES, fill, useLocale, useT } from '../lib/i18n'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { EntitlementView, ProgressView, WelcomeGiftStatus } from '../lib/types'
import { PhoneNumberPrompt } from './PhoneNumberPrompt'
import { Badge, Switch } from './ui'

const NAV = [
  { to: '/home', key: 'today', icon: TodayGlyph },
  { to: '/path', key: 'path', icon: PathGlyph },
  { to: '/practice', key: 'practice', icon: TasksGlyph },
  // No route: the chip says it is not built yet, so the row must not lead anywhere.
  { to: null, key: 'tests', icon: TestsGlyph, comingSoon: true },
  { to: '/progress', key: 'progress', icon: ProgressGlyph },
] as const

export function AppShell() {
  const t = useT()
  /*
   * The games row exists only when the panel has opened at least one. Everything is off by
   * default, so the ordinary state is no row at all — and a menu item leading to an empty
   * shelf is worse than no menu item.
   */
  const openGames = useOpenGames()
  const nav = useMemo(
    () =>
      openGames && openGames.length > 0
        ? [...NAV, { to: '/games', key: 'games' as const, icon: GamesGlyph }]
        : NAV,
    [openGames],
  )
  const { data: progress } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })

  const completedDays = Math.max(0, (progress?.currentDay ?? 1) - 1)

  return (
    <div className="min-h-dvh overflow-x-clip md:flex">
      {/* Phone: identity at the top, navigation at the bottom where the thumb is. */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-ground/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Wordmark />
          <ProfileMenu compact />
        </div>
      </header>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-hairline px-6 py-8 md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto">
        <Wordmark />

        <nav className="mt-12 flex flex-col gap-1" aria-label={t.nav.main}>
          {nav.map((item) => (
            <RailLink
              key={item.key}
              to={item.to}
              icon={item.icon}
              trailing={item.to === '/path' ? `${completedDays}/90` : undefined}
              trailingHint={fill(t.nav.daysDone, { count: completedDays })}
              comingSoon={'comingSoon' in item && item.comingSoon}
              comingSoonLabel={t.nav.comingSoon}
            >
              {t.nav[item.key]}
            </RailLink>
          ))}
        </nav>

        {/* Sign-out lives inside the menu, not beside it: one account surface, not two. */}
        <div className="mt-auto pt-8">
          <ProfileMenu />
        </div>
      </aside>

      <div className="fixed right-[5.75rem] top-[.8rem] z-30 md:right-6 md:top-6">
        <WelcomeDiscountCountdown />
      </div>

      {/*
        The bottom padding clears the tab bar plus the home indicator; without it the last
        card on every screen sits under the bar and cannot be reached.
      */}
      <main className="mx-auto w-full max-w-5xl px-5 pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-12 md:py-12 md:pb-12">
        <Outlet />
      </main>

      <PhoneNumberPrompt />

      <nav
        aria-label={t.nav.main}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-ground/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="flex items-stretch">
          {nav.map((item) => (
            <TabLink
              key={item.key}
              to={item.to}
              label={t.nav[item.key]}
              short={t.nav[`${item.key}Short`]}
              icon={item.icon}
              count={
                item.to === '/path'
                  ? fill(t.nav.daysDone, { count: completedDays })
                  : undefined
              }
              comingSoon={'comingSoon' in item && item.comingSoon}
              comingSoonHint={t.nav.comingSoon}
            />
          ))}
        </div>
      </nav>
    </div>
  )
}

function WelcomeDiscountCountdown() {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())
  const { data: welcomeGift } = useQuery({
    queryKey: ['welcome-gift'],
    queryFn: () => api.get<WelcomeGiftStatus>('/billing/welcome-gift'),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  })

  const secondsRemaining = welcomeGift?.expiresAt
    ? Math.max(0, Math.ceil((new Date(welcomeGift.expiresAt).getTime() - now) / 1000))
    : 0
  const isActive = Boolean(
    welcomeGift?.isDiscountActive && welcomeGift.discountPercent > 0 && secondsRemaining > 0,
  )

  useEffect(() => {
    if (!isActive) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isActive])

  if (!isActive) return null

  const urgent = secondsRemaining <= 180
  const time = formatCountdown(secondsRemaining)

  return (
    <div
      role="timer"
      aria-label={fill(t.welcomeGift.expiresIn, { time })}
      className={`rounded-full border bg-white/95 px-3 py-1.5 text-sm font-black tabular-nums shadow-sm ${
        urgent
          ? 'border-danger/30 bg-danger-soft text-danger'
          : 'border-hairline text-[#111827]'
      }`}
    >
      {time}
    </div>
  )
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function Wordmark() {
  return (
    <NavLink to="/home" className="text-xl font-semibold tracking-tight text-ink">
      russian<span className="text-signal">.gg</span>
    </NavLink>
  )
}

function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const t = useT()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const { data: entitlement } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    staleTime: 60_000,
    retry: false,
  })

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || t.account.learner
  // The plan, not the level: this row is the account, and the level already has a home on
  // the profile and progress screens.
  const subtitle = planLabel(entitlement, t)
  const initials = name.trim().slice(0, 2).toUpperCase()

  function go(path: string) {
    setOpen(false)
    navigate(path)
  }

  async function logout() {
    setOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-3 rounded-2xl border-2 border-hairline bg-ground-raised text-left transition hover:border-signal ${
          compact ? 'max-w-[10.5rem] px-2.5 py-2' : 'w-full px-3 py-2'
        }`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
          {initials}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-5 text-ink">{name}</span>
            {subtitle && <span className="block truncate text-sm text-ink-muted">{subtitle}</span>}
          </span>
        )}
        <ChevronGlyph direction={open ? 'up' : 'down'} />
      </button>

      {open && (
        <ProfilePopover
          anchor={triggerRef}
          compact={compact}
          label={t.account.menu}
          onDismiss={() => setOpen(false)}
        >
          {/* Account row first, exactly like the trigger it grew out of, so the menu reads
              as an expansion of the button rather than an unrelated list. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => go('/settings')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-ground-sunken"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-5 text-ink">{name}</span>
              {subtitle && <span className="block truncate text-sm text-ink-muted">{subtitle}</span>}
            </span>
            <ChevronGlyph direction="right" />
          </button>

          <div className="my-2 border-t border-hairline" />

          {/*
            Billing and profile used to sit here as their own destinations. They are tabs of
            Settings now: three menu rows that led to three pages covering the same account
            was three places to look for one thing.
          */}
          <MenuItem label={t.account.settings} icon={<GearGlyph />} onClick={() => go('/settings')} />
          <ThemeToggleItem />
          <LanguageItem />

          <div className="my-2 border-t border-hairline" />

          <MenuItem label={t.account.feedback} icon={<ChatGlyph />} onClick={() => go('/feedbacks')} />
          <MenuItem label={t.account.signOut} icon={<ExitGlyph />} onClick={() => void logout()} danger />
        </ProfilePopover>
      )}
    </>
  )
}

/**
 * The menu is portalled to the body. Rendering it inside the rail would clip it: the rail is
 * a scroll container (`overflow-y-auto`), and a scroll container cannot be escaped by
 * `position: absolute`. Coordinates are measured from the trigger and re-measured on scroll
 * and resize.
 */
function ProfilePopover({
  anchor,
  compact,
  label,
  onDismiss,
  children,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>
  compact: boolean
  label: string
  onDismiss: () => void
  children: ReactNode
}) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null)

  useLayoutEffect(() => {
    function place() {
      const trigger = anchor.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const gap = 8
      const width = Math.min(272, window.innerWidth - 24)

      setStyle(
        compact
          ? // Mobile: hangs below the avatar in the header, pinned to the right edge.
            { top: rect.bottom + gap, right: Math.max(12, window.innerWidth - rect.right), width }
          : // Desktop: opens upwards from the rail's footer.
            { bottom: window.innerHeight - rect.top + gap, left: rect.left, width },
      )
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, compact])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onDismiss} aria-hidden="true" />
      <div
        role="menu"
        aria-label={label}
        style={style ?? { visibility: 'hidden' }}
        className="fixed z-50 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-2 shadow-2xl"
      >
        {children}
      </div>
    </>,
    document.body,
  )
}

function ThemeToggleItem() {
  const t = useT()
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={isDark}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-ink transition-colors hover:bg-ground-sunken"
    >
      <span className="shrink-0" aria-hidden="true">
        <MoonGlyph />
      </span>
      <span className="flex-1">{t.account.darkMode}</span>
      <Switch checked={isDark} />
    </button>
  )
}

/**
 * Cycles through the three languages in place. A submenu would mean a second popover inside
 * a popover for a three-item list, and the current language is always visible on the row.
 */
function LanguageItem() {
  const t = useT()
  const { locale, setLocale } = useLocale()

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => setLocale(LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length])}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-ink transition-colors hover:bg-ground-sunken"
    >
      <span className="shrink-0" aria-hidden="true">
        <GlobeGlyph />
      </span>
      <span className="flex-1">{t.account.language}</span>
      <span className="text-sm font-medium text-ink-muted">{LOCALE_NAMES[locale]}</span>
    </button>
  )
}

function MenuItem({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-ground-sunken ${
        danger ? 'text-danger' : 'text-ink'
      }`}
    >
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  )
}

/* Abstract line glyphs — circle, line and wave motifs only (PRD §7). No emoji, no icon font. */

const glyph = 'size-[18px] fill-none stroke-current stroke-[1.6]'

function ChevronGlyph({ direction }: { direction: 'up' | 'down' | 'right' }) {
  const rotation = { up: 'rotate-180', down: '', right: '-rotate-90' }[direction]

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`size-4 shrink-0 fill-none stroke-current stroke-[1.8] text-ink-faint ${rotation}`}
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}



function GearGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2.6 3.1" />
    </svg>
  )
}

function ChatGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path d="M20 12a7.5 7.5 0 0 1-11 6.6L4.5 20l1.4-4.4A7.5 7.5 0 1 1 20 12Z" strokeLinejoin="round" />
    </svg>
  )
}

function MoonGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z" strokeLinejoin="round" />
    </svg>
  )
}

function GlobeGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z" />
    </svg>
  )
}

function ExitGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path d="M14 5.5H6.5v13H14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 12h6m0 0-2.6-2.6M19.5 12l-2.6 2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The phone tab bar. Icon-only by request, so every item carries an `aria-label` and
 * `NavLink` marks the active one with `aria-current` — the meaning must survive for anyone
 * not reading the glyph. Targets are a full 56px tall so they clear the 44px touch minimum.
 */
function TabLink({
  to,
  label,
  short,
  icon: Icon,
  count,
  comingSoon,
  comingSoonHint,
}: {
  to: string | null
  /** The full name, used for the accessible label. */
  label: string
  /** What fits under a 24px glyph on a phone. */
  short: string
  icon: () => ReactNode
  /** Announced to screen readers only: a pill over a 24px glyph hides the glyph. */
  count?: string
  comingSoon?: boolean
  comingSoonHint?: string
}) {
  const description = [label, count, comingSoon && comingSoonHint].filter(Boolean).join(', ')

  // Nothing to navigate to yet: rendered as plain, quiet text rather than a dead link.
  if (!to) {
    return (
      <span
        aria-label={description}
        className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 text-ink-faint opacity-60"
      >
        <span className="flex h-6 items-center" aria-hidden="true">
          <Icon />
        </span>
        <span aria-hidden="true" className="text-[11px] leading-none">
          {short}
        </span>
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      aria-label={description}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center gap-1.5 py-2.5 transition-colors ${
          isActive ? 'font-extrabold text-signal-ink' : 'font-bold text-ink-faint'
        }`
      }
    >
      <span className="flex h-6 items-center" aria-hidden="true">
        <Icon />
      </span>
      <span aria-hidden="true" className="text-[11px] leading-none">
        {short}
      </span>
    </NavLink>
  )
}

/* Abstract line glyphs for the tab bar — circle, line and wave motifs only (PRD §7). */

const navGlyph = 'size-6 fill-none stroke-current stroke-[1.7]'

function TodayGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={navGlyph}>
      <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M4.5 9.5h15" strokeLinecap="round" />
    </svg>
  )
}

function PathGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={navGlyph}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 7.5-2.2 5.8-5.8 2.2 2.2-5.8 5.8-2.2Z" strokeLinejoin="round" />
    </svg>
  )
}

function TasksGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={navGlyph}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5.25" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

/** A controller, read as a silhouette: two grips, a cross and a button. */
function GamesGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={navGlyph}>
      <path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 5.4l-.6 3A2.6 2.6 0 0 1 16 17.2L14.6 15H9.4L8 17.2a2.6 2.6 0 0 1-4.7-.8l-.6-3A4.5 4.5 0 0 1 7.5 8Z" />
      <path d="M7 10.6v2.2M5.9 11.7h2.2" strokeLinecap="round" />
      <circle cx="16.4" cy="11.6" r="1" />
    </svg>
  )
}

function TestsGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={navGlyph}>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M8.5 9h4M8.5 12.5h7" strokeLinecap="round" />
      <path d="m8.5 16.4 1.6 1.6 3.2-3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProgressGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={navGlyph}>
      <path d="M4 20h16M6 17v-6M12 17V5M18 17V9" strokeLinecap="round" />
    </svg>
  )
}

function RailLink({
  to,
  icon: Icon,
  children,
  trailing,
  trailingHint,
  comingSoon,
  comingSoonLabel,
}: {
  to: string | null
  icon: () => ReactNode
  children: ReactNode
  trailing?: string
  trailingHint?: string
  comingSoon?: boolean
  comingSoonLabel?: string
}) {
  if (!to) {
    return (
      <span className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-base font-bold text-ink-faint">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
            <Icon />
          </span>
          <span>{children}</span>
        </span>
        {comingSoon && comingSoonLabel && (
          <Badge tone="primary" size="sm">
            {comingSoonLabel}
          </Badge>
        )}
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `-mx-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-base transition-colors ${
          isActive
            ? 'bg-signal-soft font-extrabold text-signal-ink'
            : 'font-bold text-ink-muted hover:bg-ground-sunken hover:text-ink'
        }`
      }
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
          <Icon />
        </span>
        <span>{children}</span>
      </span>
      {trailing && (
        <Badge tone="neutral" size="sm">
          {trailing}
          {trailingHint && <span className="sr-only"> · {trailingHint}</span>}
        </Badge>
      )}
    </NavLink>
  )
}
